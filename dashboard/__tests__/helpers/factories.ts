import type { GHIssue, GHPR, StatusLogEntry, ClaudeTask, TaskPhase, DecisionRequest } from '@/lib/types';
import type { WorkerEntry } from '@/lib/registry';

export function makeStatusLogEntry(overrides?: Partial<StatusLogEntry>): StatusLogEntry {
  return {
    timestamp: '2026-04-08T10:00:00Z',
    task_id: 'issue-42',
    type: 'task_start',
    phase: '',
    branch: 'fix/issue-42',
    pr_number: null,
    status: 'ok',
    detail: '',
    ...overrides,
  };
}

export function makeTask(overrides?: Partial<ClaudeTask>): ClaudeTask {
  return {
    taskId: 'issue-42',
    issueNumber: 42,
    phase: 'planned' as TaskPhase,
    branch: 'fix/issue-42',
    prNumber: null,
    lastUpdate: '2026-04-08T10:00:00Z',
    detail: '',
    events: [],
    ...overrides,
  };
}

export function makeIssue(overrides?: Partial<GHIssue>): GHIssue {
  return {
    number: 42,
    title: 'Fix the login bug',
    labels: [{ name: 'bug' }],
    assignees: [{ login: 'testuser' }],
    updatedAt: '2026-04-08T10:00:00Z',
    createdAt: '2026-04-07T09:00:00Z',
    url: 'https://github.com/owner/repo/issues/42',
    milestone: null,
    state: 'open',
    ...overrides,
  };
}

export function makePR(overrides?: Partial<GHPR>): GHPR {
  return {
    number: 100,
    title: 'Fix login bug (#42)',
    headRefName: 'fix/issue-42',
    isDraft: false,
    createdAt: '2026-04-08T10:00:00Z',
    reviewDecision: '',
    statusCheckRollup: [],
    url: 'https://github.com/owner/repo/pull/100',
    body: 'Fixes #42',
    comments: { totalCount: 0 },
    reviews: { totalCount: 0 },
    reviewRequests: [],
    ...overrides,
  };
}

export function makeDecision(overrides?: Partial<DecisionRequest>): DecisionRequest {
  return {
    taskId: 'issue-42',
    issueNumber: 42,
    phase: 'implementing',
    question: 'Should we add error handling?',
    options: ['Yes', 'No'],
    context: 'During implementation...',
    timestamp: '2026-04-08T10:00:00Z',
    ...overrides,
  };
}

export function makeWorkerEntry(overrides?: Partial<WorkerEntry>): WorkerEntry {
  return {
    taskId: 'issue-42',
    issueUrl: 'https://github.com/owner/repo/issues/42',
    startedAt: '2026-04-08T10:00:00Z',
    status: 'running',
    ...overrides,
  };
}
