/**
 * Risk Assessment Tool
 * 
 * Evaluates the risk of a proposed patch based on files changed,
 * complexity, and critical paths.
 */

export interface RiskFactor {
    reason: string;
    severity: 'low' | 'medium' | 'high';
}

export interface RiskAssessment {
    score: 'low' | 'medium' | 'high';
    factors: RiskFactor[];
}

const CRITICAL_PATHS = [
    'auth',
    'security',
    'api',
    'database',
    'config',
    '.env',
    'middleware',
    'hooks/use-auth'
];

/**
 * Assess the risk of a patch
 */
export function assessRisk(
    files: Array<{ path: string; additions: number; deletions: number }>,
    task: string
): RiskAssessment {
    const factors: RiskFactor[] = [];
    let riskPoints = 0;

    // 1. Check for file count
    if (files.length > 5) {
        factors.push({ reason: `Large number of files changed (${files.length})`, severity: 'medium' });
        riskPoints += 2;
    }

    // 2. Check for total lines changed
    const totalLines = files.reduce((sum, f) => sum + f.additions + f.deletions, 0);
    if (totalLines > 100) {
        factors.push({ reason: `Large diff size (${totalLines} lines)`, severity: 'medium' });
        riskPoints += 2;
    } else if (totalLines > 300) {
        factors.push({ reason: `Very large diff size (${totalLines} lines)`, severity: 'high' });
        riskPoints += 4;
    }

    // 3. Check for critical paths
    const involvedCriticalPaths = files.filter(f =>
        CRITICAL_PATHS.some(cp => f.path.toLowerCase().includes(cp))
    );

    if (involvedCriticalPaths.length > 0) {
        factors.push({
            reason: `Affects critical paths: ${involvedCriticalPaths.map(p => p.path).slice(0, 2).join(', ')}`,
            severity: 'high'
        });
        riskPoints += 5;
    }

    // 4. Check for destructive tasks
    const destructiveKeywords = ['delete', 'remove', 'reset', 'drop', 'wipe'];
    if (destructiveKeywords.some(kw => task.toLowerCase().includes(kw))) {
        factors.push({ reason: 'Task contains potentially destructive keywords', severity: 'medium' });
        riskPoints += 2;
    }

    // Determine overall score
    let score: 'low' | 'medium' | 'high' = 'low';
    if (riskPoints >= 7) {
        score = 'high';
    } else if (riskPoints >= 3) {
        score = 'medium';
    }

    // Fallback factor if no risks found
    if (factors.length === 0) {
        factors.push({ reason: 'Minor implementation change', severity: 'low' });
    }

    return { score, factors };
}
