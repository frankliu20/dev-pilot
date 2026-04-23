import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makePR, makeIssue } from '../helpers/factories';

// We need to mock exec so that promisify(exec) returns a controllable async fn.
// vi.hoisted ensures the variable is available when vi.mock factory runs (hoisted).
const execAsyncMock = vi.hoisted(() => vi.fn());

vi.mock('util', async (importOriginal) => {
  const original = await importOriginal<typeof import('util')>();
  return {
    ...original,
    promisify: (fn: any) => {
      // If promisifying exec (from child_process), return our mock
      if (fn?.name === 'exec' || fn?.__isMockExec) {
        return execAsyncMock;
      }
      return original.promisify(fn);
    },
  };
});

vi.mock('child_process', () => {
  const execFn: any = vi.fn();
  execFn.__isMockExec = true;
  return {
    exec: execFn,
    execSync: vi.fn(),
    spawn: vi.fn(),
  };
});

vi.mock('@/lib/config', () => ({
  getConfig: vi.fn(() => ({
    workspace: '/mock/workspace',
    repos: ['owner/repo'],
    platform: 'github',
    skills: [],
  })),
  getRepo: vi.fn(() => 'owner/repo'),
  getRepoSlug: vi.fn((repo?: string) => repo || 'owner/repo'),
  getReviewRepos: vi.fn(() => ['owner/repo']),
  getWorkspace: vi.fn(() => '/mock/workspace'),
}));

import { exec } from 'child_process';

import {
  classifyPRAction,
  fetchMyOpenIssues,
  fetchMyOpenPRs,
  fetchReviewRequestedPRs,
  fetchUnresolvedThreadCounts,
  fetchIssueDetail,
  fetchTodayCommits,
} from '@/lib/github';

/**
 * Helper: mock execAsync (the promisified exec) to resolve with given stdout.
 */
function mockExecResult(stdout: string) {
  execAsyncMock.mockResolvedValue({ stdout, stderr: '' });
}

function mockExecError(error: Error) {
  execAsyncMock.mockRejectedValue(error);
}

beforeEach(() => {
  execAsyncMock.mockReset();
  mockExecResult('[]');
});

// ── classifyPRAction (PURE) ──────────────────────────────────────────────

describe('classifyPRAction', () => {
  it('returns "draft" for draft PRs', () => {
    expect(classifyPRAction(makePR({ isDraft: true }))).toBe('draft');
  });

  it('returns "draft" for draft PRs even with CI failures', () => {
    expect(classifyPRAction(makePR({
      isDraft: true,
      statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'FAILURE' }],
    }))).toBe('draft');
  });

  it('returns "ci_failing" when any check has FAILURE', () => {
    expect(classifyPRAction(makePR({
      statusCheckRollup: [
        { status: 'COMPLETED', conclusion: 'SUCCESS' },
        { status: 'COMPLETED', conclusion: 'FAILURE' },
      ],
    }))).toBe('ci_failing');
  });

  it('returns "ci_failing" when all checks are FAILURE', () => {
    expect(classifyPRAction(makePR({
      statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'FAILURE' }],
    }))).toBe('ci_failing');
  });

  it('returns "changes_requested" when reviewDecision is CHANGES_REQUESTED', () => {
    expect(classifyPRAction(makePR({
      statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'SUCCESS' }],
      reviewDecision: 'CHANGES_REQUESTED',
    }))).toBe('changes_requested');
  });

  it('returns "has_unresolved_comments" when unresolvedThreadCount > 0', () => {
    expect(classifyPRAction(makePR({
      statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'SUCCESS' }],
      reviewDecision: 'APPROVED',
      unresolvedThreadCount: 3,
    }))).toBe('has_unresolved_comments');
  });

  it('returns "ready_to_merge" when CI passes and approved', () => {
    expect(classifyPRAction(makePR({
      statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'SUCCESS' }],
      reviewDecision: 'APPROVED',
    }))).toBe('ready_to_merge');
  });

  it('returns "ready_to_merge" with unresolvedThreadCount=0', () => {
    expect(classifyPRAction(makePR({
      statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'SUCCESS' }],
      reviewDecision: 'APPROVED',
      unresolvedThreadCount: 0,
    }))).toBe('ready_to_merge');
  });

  it('returns "review_pending" when reviewDecision is REVIEW_REQUIRED', () => {
    expect(classifyPRAction(makePR({
      statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'SUCCESS' }],
      reviewDecision: 'REVIEW_REQUIRED',
    }))).toBe('review_pending');
  });

  it('returns "review_pending" when reviewDecision is empty string', () => {
    expect(classifyPRAction(makePR({
      statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'SUCCESS' }],
      reviewDecision: '',
    }))).toBe('review_pending');
  });

  it('returns "waiting" when CI is pending and approved', () => {
    expect(classifyPRAction(makePR({
      statusCheckRollup: [{ status: 'IN_PROGRESS', conclusion: '' }],
      reviewDecision: 'APPROVED',
    }))).toBe('waiting');
  });

  it('returns "review_pending" when statusCheckRollup is empty and no review', () => {
    expect(classifyPRAction(makePR({
      statusCheckRollup: [],
      reviewDecision: '',
    }))).toBe('review_pending');
  });

  it('returns "review_pending" when statusCheckRollup is empty and REVIEW_REQUIRED', () => {
    expect(classifyPRAction(makePR({
      statusCheckRollup: [],
      reviewDecision: 'REVIEW_REQUIRED',
    }))).toBe('review_pending');
  });

  // Priority order tests
  it('ci_failing takes priority over changes_requested', () => {
    expect(classifyPRAction(makePR({
      statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'FAILURE' }],
      reviewDecision: 'CHANGES_REQUESTED',
    }))).toBe('ci_failing');
  });

  it('changes_requested takes priority over has_unresolved_comments', () => {
    expect(classifyPRAction(makePR({
      statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'SUCCESS' }],
      reviewDecision: 'CHANGES_REQUESTED',
      unresolvedThreadCount: 5,
    }))).toBe('changes_requested');
  });

  it('has_unresolved_comments takes priority over ready_to_merge', () => {
    expect(classifyPRAction(makePR({
      statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'SUCCESS' }],
      reviewDecision: 'APPROVED',
      unresolvedThreadCount: 1,
    }))).toBe('has_unresolved_comments');
  });

  it('treats all SUCCESS checks as CI pass', () => {
    expect(classifyPRAction(makePR({
      statusCheckRollup: [
        { status: 'COMPLETED', conclusion: 'SUCCESS' },
        { status: 'COMPLETED', conclusion: 'SUCCESS' },
        { status: 'COMPLETED', conclusion: 'SUCCESS' },
      ],
      reviewDecision: 'APPROVED',
    }))).toBe('ready_to_merge');
  });

  it('treats mixed COMPLETED/IN_PROGRESS as pending CI', () => {
    expect(classifyPRAction(makePR({
      statusCheckRollup: [
        { status: 'COMPLETED', conclusion: 'SUCCESS' },
        { status: 'IN_PROGRESS', conclusion: '' },
      ],
      reviewDecision: 'APPROVED',
    }))).toBe('waiting');
  });

  it('returns "ci_failing" even when approved if CI fails', () => {
    expect(classifyPRAction(makePR({
      statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'FAILURE' }],
      reviewDecision: 'APPROVED',
    }))).toBe('ci_failing');
  });

  it('treats undefined unresolvedThreadCount as no unresolved comments', () => {
    expect(classifyPRAction(makePR({
      statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'SUCCESS' }],
      reviewDecision: 'APPROVED',
      unresolvedThreadCount: undefined,
    }))).toBe('ready_to_merge');
  });

  it('treats NEUTRAL conclusion as CI pass', () => {
    expect(classifyPRAction(makePR({
      statusCheckRollup: [
        { status: 'COMPLETED', conclusion: 'SUCCESS' },
        { status: 'COMPLETED', conclusion: 'NEUTRAL' },
      ],
      reviewDecision: 'APPROVED',
    }))).toBe('ready_to_merge');
  });

  it('treats SKIPPED conclusion as CI pass', () => {
    expect(classifyPRAction(makePR({
      statusCheckRollup: [
        { status: 'COMPLETED', conclusion: 'SUCCESS' },
        { status: 'COMPLETED', conclusion: 'SKIPPED' },
      ],
      reviewDecision: 'APPROVED',
    }))).toBe('ready_to_merge');
  });
});

// ── fetchMyOpenIssues ────────────────────────────────────────────────────

describe('fetchMyOpenIssues', () => {
  it('fetches and parses issues from all repos', async () => {
    const issues = [makeIssue({ number: 1 }), makeIssue({ number: 2 })];
    mockExecResult(JSON.stringify(issues));

    const result = await fetchMyOpenIssues();
    expect(result).toHaveLength(2);
  });

  it('returns empty array when gh command fails', async () => {
    mockExecError(new Error('gh failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await fetchMyOpenIssues();
    expect(result).toEqual([]);
  });

  it('sorts issues by updatedAt descending', async () => {
    const issues = [
      makeIssue({ number: 1, updatedAt: '2026-04-07T10:00:00Z' }),
      makeIssue({ number: 2, updatedAt: '2026-04-08T10:00:00Z' }),
    ];
    mockExecResult(JSON.stringify(issues));

    const result = await fetchMyOpenIssues();
    expect(result[0].number).toBe(2);
    expect(result[1].number).toBe(1);
  });

  it('returns empty array when runGH errors (returns "[]")', async () => {
    mockExecError(new Error('bad'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await fetchMyOpenIssues();
    expect(result).toEqual([]);
  });
});

// ── fetchMyOpenPRs ───────────────────────────────────────────────────────

describe('fetchMyOpenPRs', () => {
  it('fetches and parses PRs', async () => {
    const prs = [makePR({ number: 100 })];
    mockExecResult(JSON.stringify(prs));

    const result = await fetchMyOpenPRs();
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(100);
  });

  it('sorts PRs by createdAt descending', async () => {
    const prs = [
      makePR({ number: 1, createdAt: '2026-04-07T10:00:00Z' }),
      makePR({ number: 2, createdAt: '2026-04-08T10:00:00Z' }),
    ];
    mockExecResult(JSON.stringify(prs));

    const result = await fetchMyOpenPRs();
    expect(result[0].number).toBe(2);
  });

  it('returns empty array on error', async () => {
    mockExecError(new Error('failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await fetchMyOpenPRs();
    expect(result).toEqual([]);
  });
});

// ── fetchReviewRequestedPRs ──────────────────────────────────────────────

describe('fetchReviewRequestedPRs', () => {
  it('fetches review-requested PRs from review repos', async () => {
    const prs = [makePR({ number: 200, author: { login: 'other' } })];
    mockExecResult(JSON.stringify(prs));

    const result = await fetchReviewRequestedPRs();
    expect(result).toHaveLength(1);
  });

  it('returns empty array on error', async () => {
    mockExecError(new Error('failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await fetchReviewRequestedPRs();
    expect(result).toEqual([]);
  });
});

// ── fetchUnresolvedThreadCounts ──────────────────────────────────────────

describe('fetchUnresolvedThreadCounts', () => {
  it('returns empty map for empty input', async () => {
    const result = await fetchUnresolvedThreadCounts([]);
    expect(result.size).toBe(0);
  });

  it('returns unresolved counts from GraphQL response', async () => {
    const graphqlResponse = {
      data: {
        repository: {
          pr_100: {
            reviewThreads: {
              nodes: [
                { isResolved: false },
                { isResolved: true },
                { isResolved: false },
              ],
            },
          },
        },
      },
    };
    mockExecResult(JSON.stringify(graphqlResponse));

    const pr = makePR({ number: 100, url: 'https://github.com/owner/repo/pull/100' });
    const result = await fetchUnresolvedThreadCounts([pr]);
    expect(result.get(100)).toBe(2);
  });

  it('handles GraphQL errors gracefully', async () => {
    mockExecError(new Error('graphql failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const pr = makePR({ number: 100, url: 'https://github.com/owner/repo/pull/100' });
    const result = await fetchUnresolvedThreadCounts([pr]);
    expect(result.size).toBe(0);
  });

  it('skips PRs without valid URL', async () => {
    const pr = makePR({ number: 100, url: '' });
    mockExecResult(JSON.stringify({ data: { repository: {} } }));
    const result = await fetchUnresolvedThreadCounts([pr]);
    expect(result.size).toBe(0);
  });

  it('groups PRs by repo correctly', async () => {
    const pr1 = makePR({ number: 1, url: 'https://github.com/owner/repo1/pull/1' });
    const pr2 = makePR({ number: 2, url: 'https://github.com/owner/repo2/pull/2' });

    const resp1 = {
      data: {
        repository: {
          pr_1: { reviewThreads: { nodes: [{ isResolved: false }] } },
        },
      },
    };
    const resp2 = {
      data: {
        repository: {
          pr_2: { reviewThreads: { nodes: [] } },
        },
      },
    };

    execAsyncMock
      .mockResolvedValueOnce({ stdout: JSON.stringify(resp1), stderr: '' })
      .mockResolvedValueOnce({ stdout: JSON.stringify(resp2), stderr: '' });

    const result = await fetchUnresolvedThreadCounts([pr1, pr2]);
    expect(result.get(1)).toBe(1);
    expect(result.get(2)).toBe(0);
  });
});

// ── fetchIssueDetail ─────────────────────────────────────────────────────

describe('fetchIssueDetail', () => {
  it('fetches issue detail using primary repo when no URL provided', async () => {
    const issue = makeIssue({ number: 42, body: 'details' });
    mockExecResult(JSON.stringify(issue));

    const result = await fetchIssueDetail(42);
    expect(result).toBeDefined();
    expect(result!.number).toBe(42);
  });

  it('extracts repo from issue URL when provided', async () => {
    const issue = makeIssue({ number: 42 });
    mockExecResult(JSON.stringify(issue));

    await fetchIssueDetail(42, 'https://github.com/other/repo/issues/42');

    // execAsyncMock is the promisified version called with (cmd, opts)
    const calls = execAsyncMock.mock.calls;
    const ghCall = calls.find((c: any[]) => String(c[0]).includes('gh issue view'));
    expect(ghCall).toBeDefined();
    expect(String(ghCall![0])).toContain('other/repo');
  });

  it('returns null on malformed JSON response', async () => {
    execAsyncMock.mockResolvedValue({ stdout: 'not-valid-json{', stderr: '' });
    const result = await fetchIssueDetail(42);
    expect(result).toBeNull();
  });

  it('returns parsed "[]" when gh command errors', async () => {
    mockExecError(new Error('not found'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // runGH returns '[]' on error, JSON.parse('[]') = []
    const result = await fetchIssueDetail(42);
    expect(result).toEqual([]);
  });
});

// ── fetchTodayCommits ────────────────────────────────────────────────────

describe('fetchTodayCommits', () => {
  it('parses git log output into CommitInfo objects', async () => {
    mockExecResult('abc1234 Fix the login bug\ndef5678 Add tests');

    const result = await fetchTodayCommits();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ hash: 'abc1234', message: 'Fix the login bug' });
    expect(result[1]).toEqual({ hash: 'def5678', message: 'Add tests' });
  });

  it('returns empty array when no commits', async () => {
    mockExecResult('');
    const result = await fetchTodayCommits();
    expect(result).toEqual([]);
  });

  it('returns empty array on git error', async () => {
    mockExecError(new Error('not a git repo'));
    const result = await fetchTodayCommits();
    expect(result).toEqual([]);
  });
});

// ── runGH error handling (tested via public functions) ────────────────────

describe('runGH error handling', () => {
  it('returns "[]" on gh command failure, parsed as empty array', async () => {
    mockExecError(new Error('auth failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await fetchMyOpenIssues();
    expect(result).toEqual([]);
  });

  it('logs error to console on failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockExecError(new Error('timeout'));

    await fetchMyOpenIssues();
    expect(consoleSpy).toHaveBeenCalled();
  });
});
