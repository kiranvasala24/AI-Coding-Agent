/**
 * Patch Tools
 * 
 * Apply unified diff patches to the repository with safety constraints.
 */

import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import { join, dirname, extname, relative, resolve } from 'path';
import { applyPatch, parsePatch } from 'diff';
import { config } from '../config';
import { markPatchApplied, postEvents, supabase } from '../supabase';

export interface PatchFile {
  path: string;
  additions: number;
  deletions: number;
  diff: string;
}

export interface ApplyResult {
  success: boolean;
  filesAffected: number;
  errors: string[];
  warnings: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a path is within the repo and not in denylist
 */
function validatePath(filePath: string): { valid: boolean; error?: string } {
  const { patchConstraints, repoPath } = config;
  
  // Resolve to absolute and check it's within repo
  const absolutePath = resolve(repoPath, filePath);
  const relativePath = relative(repoPath, absolutePath);
  
  // Path traversal check
  if (relativePath.startsWith('..') || !absolutePath.startsWith(repoPath)) {
    return { valid: false, error: `Path traversal detected: ${filePath}` };
  }
  
  // Check denylist
  for (const denied of patchConstraints.pathDenylist) {
    if (relativePath === denied || 
        relativePath.startsWith(denied + '/') ||
        relativePath.includes('/' + denied + '/') ||
        relativePath.endsWith('/' + denied)) {
      return { valid: false, error: `Path is in denylist: ${filePath} (matches ${denied})` };
    }
  }
  
  // Check binary extensions
  const ext = extname(filePath).toLowerCase();
  if (patchConstraints.binaryExtensions.includes(ext)) {
    return { valid: false, error: `Binary file not allowed: ${filePath}` };
  }
  
  return { valid: true };
}

/**
 * Validate a complete patch before applying
 */
export function validatePatch(files: PatchFile[]): ValidationResult {
  const { patchConstraints } = config;
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check file count
  if (files.length > patchConstraints.maxFilesChanged) {
    errors.push(`Too many files changed: ${files.length} > ${patchConstraints.maxFilesChanged}`);
  }
  
  // Check total diff lines
  let totalLines = 0;
  for (const file of files) {
    const lines = file.diff.split('\n').length;
    totalLines += lines;
    
    // Validate each path
    const pathCheck = validatePath(file.path);
    if (!pathCheck.valid) {
      errors.push(pathCheck.error!);
    }
    
    // Warn about large individual files
    if (lines > 200) {
      warnings.push(`Large diff for ${file.path}: ${lines} lines`);
    }
  }
  
  if (totalLines > patchConstraints.maxDiffLines) {
    errors.push(`Total diff too large: ${totalLines} > ${patchConstraints.maxDiffLines} lines`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Parse a unified diff and extract file changes
 */
export function parseDiff(diff: string): PatchFile[] {
  const patches = parsePatch(diff);
  
  return patches.map(patch => {
    const path = patch.newFileName?.replace(/^[ab]\//, '') || '';
    let additions = 0;
    let deletions = 0;
    
    for (const hunk of patch.hunks) {
      for (const line of hunk.lines) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          additions++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          deletions++;
        }
      }
    }
    
    return {
      path,
      additions,
      deletions,
      diff: patch.hunks.map(h => h.lines.join('\n')).join('\n'),
    };
  });
}

/**
 * Apply a unified diff patch to the repository with safety checks
 */
export async function applyDiff(diff: string): Promise<ApplyResult> {
  const patches = parsePatch(diff);
  const errors: string[] = [];
  const warnings: string[] = [];
  let filesAffected = 0;
  
  // Pre-validate all files
  const filesToPatch = patches.map(p => ({
    path: p.newFileName?.replace(/^[ab]\//, '') || '',
    oldPath: p.oldFileName?.replace(/^[ab]\//, ''),
  }));
  
  for (const file of filesToPatch) {
    if (!file.path) continue;
    const pathCheck = validatePath(file.path);
    if (!pathCheck.valid) {
      errors.push(pathCheck.error!);
    }
  }
  
  // If any validation failed, don't apply anything
  if (errors.length > 0) {
    return { success: false, filesAffected: 0, errors, warnings };
  }
  
  for (const patch of patches) {
    const oldPath = patch.oldFileName?.replace(/^[ab]\//, '');
    const newPath = patch.newFileName?.replace(/^[ab]\//, '');
    
    if (!newPath) {
      errors.push(`Missing file path in patch`);
      continue;
    }
    
    const fullPath = join(config.repoPath, newPath);
    
    try {
      // Handle new files
      if (oldPath === '/dev/null' || !oldPath) {
        const newContent = patch.hunks
          .flatMap(h => h.lines.filter(l => l.startsWith('+')).map(l => l.slice(1)))
          .join('\n');
        
        await mkdir(dirname(fullPath), { recursive: true });
        await writeFile(fullPath, newContent, 'utf-8');
        filesAffected++;
        console.log(`[patch] Created new file: ${newPath}`);
        continue;
      }
      
      // Handle deleted files
      if (newPath === '/dev/null') {
        // For safety, we don't actually delete files - just warn
        warnings.push(`File deletion requested but skipped for safety: ${oldPath}`);
        continue;
      }
      
      // Check file exists
      try {
        await stat(fullPath);
      } catch {
        errors.push(`File not found: ${newPath}`);
        continue;
      }
      
      // Apply patch to existing file
      const original = await readFile(fullPath, 'utf-8');
      const patched = applyPatch(original, patch);
      
      if (patched === false) {
        errors.push(`Failed to apply patch to ${newPath} - content may have changed`);
        continue;
      }
      
      await writeFile(fullPath, patched, 'utf-8');
      filesAffected++;
      console.log(`[patch] Updated file: ${newPath}`);
    } catch (err) {
      errors.push(`Error patching ${newPath}: ${err}`);
    }
  }
  
  return {
    success: errors.length === 0,
    filesAffected,
    errors,
    warnings,
  };
}

/**
 * Watch for approved patches and apply them
 */
export async function watchForApprovals(runId: string) {
  console.log(`[patch] Watching for approved patches for run ${runId}...`);
  
  // Poll for approved patches
  const checkApprovals = async () => {
    const { data: patches, error } = await supabase
      .from('patches')
      .select('*')
      .eq('run_id', runId)
      .eq('approved', true)
      .eq('applied', false);
    
    if (error) {
      console.error('[patch] Error checking approvals:', error);
      return;
    }
    
    for (const patch of patches || []) {
      console.log(`[patch] Applying approved patch ${patch.id}...`);
      
      // Get the files_changed data
      const filesChanged = patch.files_changed as PatchFile[];
      
      // Validate before applying
      const validation = validatePatch(filesChanged);
      if (!validation.valid) {
        console.error('[patch] Validation failed:', validation.errors);
        await postEvents(runId, [{
          type: 'ERROR',
          payload: {
            message: `Patch validation failed: ${validation.errors.join(', ')}`,
            patchId: patch.id,
          },
        }]);
        continue;
      }
      
      if (validation.warnings.length > 0) {
        console.warn('[patch] Warnings:', validation.warnings);
      }
      
      // Reconstruct diff from files_changed
      const fullDiff = filesChanged.map(f => f.diff).join('\n');
      
      const result = await applyDiff(fullDiff);
      
      if (result.success) {
        await markPatchApplied(runId, patch.id, result.filesAffected);
        
        await postEvents(runId, [{
          type: 'PATCH_APPLIED',
          payload: {
            patchId: patch.id,
            filesAffected: result.filesAffected,
            warnings: result.warnings,
          },
        }]);
        
        console.log(`[patch] Successfully applied patch ${patch.id}`);
      } else {
        console.error(`[patch] Failed to apply patch:`, result.errors);
        
        await postEvents(runId, [{
          type: 'ERROR',
          payload: {
            message: `Failed to apply patch: ${result.errors.join(', ')}`,
            patchId: patch.id,
            warnings: result.warnings,
          },
        }]);
      }
    }
  };
  
  // Check immediately and then periodically
  await checkApprovals();
  
  const interval = setInterval(checkApprovals, 2000);
  
  // Return cleanup function
  return () => clearInterval(interval);
}
