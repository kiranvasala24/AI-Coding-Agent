/**
 * Repository Tools
 * 
 * Safe read-only tools for exploring the repository.
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join, relative } from 'path';
import { spawn } from 'child_process';
import { config } from '../config';

export interface ListFilesResult {
  files: string[];
  count: number;
  truncated: boolean;
}

export interface SearchResult {
  file: string;
  line: number;
  content: string;
  matchStart: number;
  matchEnd: number;
}

export interface OpenFileResult {
  file: string;
  content: string;
  lines: Array<{ number: number; content: string }>;
  totalLines: number;
  truncated: boolean;
}

/**
 * List files matching a glob pattern
 */
export async function listFiles(pattern: string, maxDepth = 10): Promise<ListFilesResult> {
  const { glob } = await import('glob');
  
  const files = await glob(pattern, {
    cwd: config.repoPath,
    nodir: true,
    maxDepth,
    ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
  });
  
  const maxFiles = 100;
  const truncated = files.length > maxFiles;
  
  return {
    files: files.slice(0, maxFiles),
    count: files.length,
    truncated,
  };
}

/**
 * Search repository using ripgrep (falls back to simple search)
 */
export async function search(query: string, filePattern?: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  
  try {
    // Try ripgrep first
    const args = ['--json', '--max-count', '5', query];
    if (filePattern) {
      args.push('--glob', filePattern);
    }
    args.push('.');
    
    const rg = spawn('rg', args, { cwd: config.repoPath });
    
    return new Promise((resolve, reject) => {
      let output = '';
      
      rg.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      rg.on('close', (code) => {
        if (code === 0 || code === 1) {
          // Parse ripgrep JSON output
          const lines = output.trim().split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.type === 'match') {
                const match = parsed.data;
                results.push({
                  file: match.path.text,
                  line: match.line_number,
                  content: match.lines.text.trim(),
                  matchStart: match.submatches[0]?.start || 0,
                  matchEnd: match.submatches[0]?.end || 0,
                });
              }
            } catch {
              // Skip malformed lines
            }
          }
          resolve(results.slice(0, config.maxSearchResults || 20));
        } else {
          reject(new Error(`ripgrep exited with code ${code}`));
        }
      });
      
      rg.on('error', () => {
        // Ripgrep not available, fall back to simple search
        resolve(fallbackSearch(query, filePattern));
      });
    });
  } catch {
    return fallbackSearch(query, filePattern);
  }
}

/**
 * Fallback search when ripgrep is not available
 */
async function fallbackSearch(query: string, filePattern?: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const pattern = filePattern || '**/*.{ts,tsx,js,jsx,json,md}';
  const { files } = await listFiles(pattern);
  
  const regex = new RegExp(query, 'gi');
  
  for (const file of files.slice(0, 20)) {
    try {
      const content = await readFile(join(config.repoPath, file), 'utf-8');
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const match = regex.exec(lines[i]);
        if (match) {
          results.push({
            file,
            line: i + 1,
            content: lines[i].trim().slice(0, 200),
            matchStart: match.index,
            matchEnd: match.index + match[0].length,
          });
          
          if (results.length >= (config.maxSearchResults || 20)) {
            return results;
          }
        }
        regex.lastIndex = 0; // Reset for next line
      }
    } catch {
      // Skip unreadable files
    }
  }
  
  return results;
}

/**
 * Open and read a file
 */
export async function openFile(
  file: string,
  startLine?: number,
  endLine?: number
): Promise<OpenFileResult> {
  const fullPath = join(config.repoPath, file);
  
  // Security: ensure path is within repo
  const resolved = join(config.repoPath, file);
  if (!resolved.startsWith(config.repoPath)) {
    throw new Error('Path traversal detected');
  }
  
  const content = await readFile(fullPath, 'utf-8');
  const allLines = content.split('\n');
  
  const start = startLine ? Math.max(1, startLine) : 1;
  const end = endLine ? Math.min(allLines.length, endLine) : Math.min(allLines.length, config.maxFileLines || 500);
  
  const lines = allLines
    .slice(start - 1, end)
    .map((content, idx) => ({
      number: start + idx,
      content,
    }));
  
  return {
    file,
    content: lines.map(l => l.content).join('\n'),
    lines,
    totalLines: allLines.length,
    truncated: end < allLines.length,
  };
}

/**
 * Get repository info (package.json, tsconfig, etc.)
 */
export async function getRepoInfo() {
  const info: Record<string, unknown> = {};
  
  try {
    const pkgPath = join(config.repoPath, 'package.json');
    const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
    info.packageJson = {
      name: pkg.name,
      scripts: Object.keys(pkg.scripts || {}),
      dependencies: Object.keys(pkg.dependencies || {}).length,
      devDependencies: Object.keys(pkg.devDependencies || {}).length,
    };
  } catch {
    info.packageJson = null;
  }
  
  try {
    const tsconfigPath = join(config.repoPath, 'tsconfig.json');
    await stat(tsconfigPath);
    info.hasTypescript = true;
  } catch {
    info.hasTypescript = false;
  }
  
  return info;
}
