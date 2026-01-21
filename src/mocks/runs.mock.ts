import type { Run, RunEvent } from '@/types/run';

export const mockRun: Run = {
  runId: 'run_001',
  status: 'awaiting_approval',
  createdAt: '2025-01-07T10:30:00Z',
  updatedAt: '2025-01-07T10:32:45Z',
  task: 'Add caching to token validation in AuthService',
  
  plan: {
    task: 'Add caching to token validation',
    steps: [
      {
        id: 'step_1',
        action: 'analyze',
        target: 'src/auth/AuthService.ts',
        reason: 'Understand current validation flow',
        status: 'completed'
      },
      {
        id: 'step_2',
        action: 'analyze',
        target: 'src/cache/CacheService.ts',
        reason: 'Review cache interface and methods',
        status: 'completed'
      },
      {
        id: 'step_3',
        action: 'modify',
        target: 'src/auth/AuthService.ts',
        reason: 'Add cache lookup before DB query',
        changes: 'Add cache.get() call, cache.set() on success',
        status: 'completed'
      },
      {
        id: 'step_4',
        action: 'test',
        target: 'bun test auth',
        reason: 'Verify auth tests pass',
        expected: 'All auth tests pass',
        status: 'completed'
      }
    ],
    risks: [
      'Cache invalidation timing may cause stale tokens',
      'Memory usage increase with large token volume'
    ],
    affectedExports: ['validateToken', 'TokenResult'],
    acceptanceCriteria: [
      'Token validation returns cached result when available',
      'Cache miss falls back to database lookup',
      'All existing auth tests pass'
    ]
  },
  
  toolCalls: [
    {
      id: 'tool_1',
      name: 'search',
      args: { query: 'validateToken', path: 'src/auth' },
      startedAt: '2025-01-07T10:30:15Z',
      finishedAt: '2025-01-07T10:30:16Z',
      status: 'completed',
      resultSummary: 'Found 3 matches in src/auth/AuthService.ts'
    },
    {
      id: 'tool_2',
      name: 'open',
      args: { file: 'src/auth/AuthService.ts', startLine: 1, endLine: 50 },
      startedAt: '2025-01-07T10:30:17Z',
      finishedAt: '2025-01-07T10:30:17Z',
      status: 'completed',
      resultSummary: 'Opened AuthService.ts (50 lines)'
    },
    {
      id: 'tool_3',
      name: 'open',
      args: { file: 'src/cache/CacheService.ts', startLine: 1, endLine: 30 },
      startedAt: '2025-01-07T10:30:18Z',
      finishedAt: '2025-01-07T10:30:18Z',
      status: 'completed',
      resultSummary: 'Opened CacheService.ts (30 lines)'
    },
    {
      id: 'tool_4',
      name: 'propose_patch',
      args: { 
        file: 'src/auth/AuthService.ts',
        diff: '...'
      },
      startedAt: '2025-01-07T10:31:00Z',
      finishedAt: '2025-01-07T10:31:02Z',
      status: 'completed',
      resultSummary: 'Proposed patch with 8 additions, 2 deletions'
    },
    {
      id: 'tool_5',
      name: 'sandbox_run',
      args: { command: 'bun test auth' },
      startedAt: '2025-01-07T10:31:30Z',
      finishedAt: '2025-01-07T10:32:45Z',
      status: 'completed',
      resultSummary: 'All 12 tests passed'
    }
  ],
  
  patches: [
    {
      patchId: 'patch_001',
      summary: 'Add cache layer to validateToken method',
      filesChanged: [
        {
          path: 'src/auth/AuthService.ts',
          additions: 8,
          deletions: 2,
          diff: [
            { type: 'header', content: ' -15,7 +15,12 @@ export class AuthService {' },
            { type: 'context', content: '  constructor(private db: Database) {}', lineNumber: { old: 15, new: 15 } },
            { type: 'context', content: '', lineNumber: { old: 16, new: 16 } },
            { type: 'removed', content: '  async validateToken(token: string) {', lineNumber: { old: 17 } },
            { type: 'removed', content: '    return this.db.tokens.find(token);', lineNumber: { old: 18 } },
            { type: 'added', content: '  async validateToken(token: string): Promise<TokenResult> {', lineNumber: { new: 17 } },
            { type: 'added', content: '    const cached = await this.cache.get(token);', lineNumber: { new: 18 } },
            { type: 'added', content: '    if (cached) return { valid: true, user: cached };', lineNumber: { new: 19 } },
            { type: 'added', content: '', lineNumber: { new: 20 } },
            { type: 'added', content: '    const result = await this.db.tokens.find(token);', lineNumber: { new: 21 } },
            { type: 'added', content: '    if (result) await this.cache.set(token, result);', lineNumber: { new: 22 } },
            { type: 'added', content: '    return result ?? { valid: false };', lineNumber: { new: 23 } },
            { type: 'context', content: '  }', lineNumber: { old: 19, new: 24 } },
            { type: 'context', content: '}', lineNumber: { old: 20, new: 25 } }
          ]
        }
      ],
      totalAdditions: 8,
      totalDeletions: 2,
      createdAt: '2025-01-07T10:31:02Z',
      reasoning: 'Adding a cache layer before database lookup reduces latency for repeated token validations. The cache is populated on successful lookups.',
      constraintsUsed: ['max-diff-lines: 300', 'path-allowlist: src/**']
    }
  ],
  
  verification: {
    commands: [
      {
        command: 'bunx tsc --noEmit',
        status: 'passed',
        startedAt: '2025-01-07T10:31:30Z',
        finishedAt: '2025-01-07T10:31:35Z',
        exitCode: 0,
        logs: [
          '$ bunx tsc --noEmit',
          'Checking types...',
          '✓ No type errors found'
        ]
      },
      {
        command: 'bun test auth',
        status: 'passed',
        startedAt: '2025-01-07T10:31:36Z',
        finishedAt: '2025-01-07T10:32:45Z',
        exitCode: 0,
        logs: [
          '$ bun test auth',
          '',
          'src/auth/__tests__/AuthService.test.ts:',
          '  ✓ validateToken returns valid for known token (2ms)',
          '  ✓ validateToken returns invalid for unknown token (1ms)',
          '  ✓ validateToken caches successful lookups (3ms)',
          '  ✓ validateToken returns cached result on subsequent calls (1ms)',
          '  ✓ validateToken handles cache miss gracefully (2ms)',
          '',
          'src/auth/__tests__/TokenManager.test.ts:',
          '  ✓ creates token with correct expiry (1ms)',
          '  ✓ revokes token successfully (1ms)',
          '  ✓ refreshToken extends expiry (2ms)',
          '',
          'src/auth/__tests__/Session.test.ts:',
          '  ✓ creates session for valid user (2ms)',
          '  ✓ invalidates expired sessions (1ms)',
          '  ✓ refreshes session correctly (2ms)',
          '  ✓ handles concurrent sessions (3ms)',
          '',
          '12 tests passed (21ms)'
        ]
      }
    ],
    overallStatus: 'passed',
    startedAt: '2025-01-07T10:31:30Z',
    finishedAt: '2025-01-07T10:32:45Z'
  },
  
  approval: {
    required: true
  },
  
  riskAssessment: {
    score: 'medium',
    factors: [
      {
        reason: 'Modifies public export: validateToken',
        severity: 'medium'
      },
      {
        reason: 'Adds new dependency on CacheService',
        severity: 'low'
      },
      {
        reason: 'Changes return type signature',
        severity: 'medium'
      }
    ]
  },
  
  impactedFiles: [
    'src/auth/AuthService.ts',
    'src/api/routes/auth.ts',
    'src/middleware/authenticate.ts'
  ],
  
  impactedSymbols: [
    'validateToken',
    'TokenResult'
  ]
};

export const mockEvents: RunEvent[] = [
  {
    eventId: 'evt_001',
    runId: 'run_001',
    type: 'RUN_CREATED',
    timestamp: '2025-01-07T10:30:00Z',
    payload: { task: 'Add caching to token validation in AuthService' }
  },
  {
    eventId: 'evt_002',
    runId: 'run_001',
    type: 'PLAN_CREATED',
    timestamp: '2025-01-07T10:30:10Z',
    payload: { stepsCount: 4, risks: 2 }
  },
  {
    eventId: 'evt_003',
    runId: 'run_001',
    type: 'TOOL_CALLED',
    timestamp: '2025-01-07T10:30:15Z',
    payload: { toolName: 'search', args: { query: 'validateToken' } }
  },
  {
    eventId: 'evt_004',
    runId: 'run_001',
    type: 'TOOL_COMPLETED',
    timestamp: '2025-01-07T10:30:16Z',
    payload: { toolName: 'search', result: '3 matches found' }
  },
  {
    eventId: 'evt_005',
    runId: 'run_001',
    type: 'PATCH_PROPOSED',
    timestamp: '2025-01-07T10:31:02Z',
    payload: { patchId: 'patch_001', additions: 8, deletions: 2 }
  },
  {
    eventId: 'evt_006',
    runId: 'run_001',
    type: 'VERIFY_STARTED',
    timestamp: '2025-01-07T10:31:30Z',
    payload: { commands: ['bunx tsc --noEmit', 'bun test auth'] }
  },
  {
    eventId: 'evt_007',
    runId: 'run_001',
    type: 'VERIFY_FINISHED',
    timestamp: '2025-01-07T10:32:45Z',
    payload: { status: 'passed', testsPassed: 12 }
  },
  {
    eventId: 'evt_008',
    runId: 'run_001',
    type: 'NEEDS_APPROVAL',
    timestamp: '2025-01-07T10:32:46Z',
    payload: { riskScore: 'medium', patchId: 'patch_001' }
  }
];

export const mockRunsList: Pick<Run, 'runId' | 'status' | 'task' | 'createdAt' | 'updatedAt'>[] = [
  {
    runId: 'run_001',
    status: 'awaiting_approval',
    task: 'Add caching to token validation in AuthService',
    createdAt: '2025-01-07T10:30:00Z',
    updatedAt: '2025-01-07T10:32:45Z'
  },
  {
    runId: 'run_002',
    status: 'completed',
    task: 'Fix null pointer in UserService.getProfile',
    createdAt: '2025-01-07T09:15:00Z',
    updatedAt: '2025-01-07T09:18:30Z'
  },
  {
    runId: 'run_003',
    status: 'failed',
    task: 'Add pagination to /api/users endpoint',
    createdAt: '2025-01-07T08:00:00Z',
    updatedAt: '2025-01-07T08:05:12Z'
  }
];
