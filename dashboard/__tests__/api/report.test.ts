import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/github', () => ({
  fetchTodayCommits: vi.fn(),
  fetchRecentPRs: vi.fn(),
  fetchClosedIssues: vi.fn(),
  fetchMyOpenIssues: vi.fn(),
  fetchMyOpenPRs: vi.fn(),
  classifyPRAction: vi.fn(),
}));

vi.mock('@/lib/types', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/types')>()),
  REPO: 'owner/repo',
}));

import { GET } from '@/app/api/report/route';
import {
  fetchTodayCommits,
  fetchRecentPRs,
  fetchClosedIssues,
  fetchMyOpenIssues,
  fetchMyOpenPRs,
  classifyPRAction,
} from '@/lib/github';
import { makeIssue, makePR } from '../helpers/factories';

describe('GET /api/report', () => {
  it('returns 200 with aggregated report data', async () => {
    const today = new Date().toISOString().substring(0, 10);

    vi.mocked(fetchTodayCommits).mockResolvedValue([
      { hash: 'abc1234', message: 'fix: something' },
    ]);
    vi.mocked(fetchRecentPRs).mockResolvedValue([
      {
        number: 100,
        title: 'Fix bug (#42)',
        state: 'MERGED',
        createdAt: today + 'T08:00:00Z',
        mergedAt: today + 'T09:00:00Z',
        reviewDecision: 'APPROVED',
        ciStatus: 'pass',
      },
    ]);
    vi.mocked(fetchClosedIssues).mockResolvedValue([
      { number: 42, title: 'Login bug', closedAt: today + 'T09:30:00Z' },
    ]);
    vi.mocked(fetchMyOpenIssues).mockResolvedValue([
      makeIssue({ number: 50, title: 'New feature' }),
    ]);
    vi.mocked(fetchMyOpenPRs).mockResolvedValue([
      makePR({ number: 200, title: 'WIP: feature (#50)' }),
    ]);
    vi.mocked(classifyPRAction).mockReturnValue('review_pending');

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.date).toBe(today);
    expect(body.commits).toHaveLength(1);
    expect(body.mergedPRs).toHaveLength(1);
    expect(body.completedIssues).toHaveLength(1);
    expect(body.openPRs).toHaveLength(1);
    expect(body.carryOver).toHaveLength(1);
    expect(body.stats.issuesClosed).toBe(1);
    expect(body.stats.prsMerged).toBe(1);
    expect(body.stats.commits).toBe(1);
  });

  it('handles empty activity (no commits, PRs, issues)', async () => {
    vi.mocked(fetchTodayCommits).mockResolvedValue([]);
    vi.mocked(fetchRecentPRs).mockResolvedValue([]);
    vi.mocked(fetchClosedIssues).mockResolvedValue([]);
    vi.mocked(fetchMyOpenIssues).mockResolvedValue([]);
    vi.mocked(fetchMyOpenPRs).mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(body.commits).toHaveLength(0);
    expect(body.mergedPRs).toHaveLength(0);
    expect(body.completedIssues).toHaveLength(0);
    expect(body.openPRs).toHaveLength(0);
    expect(body.carryOver).toHaveLength(0);
    expect(body.stats.issuesClosed).toBe(0);
    expect(body.stats.prsMerged).toBe(0);
  });

  it('linkedPR heuristic matches by issue number in PR title', async () => {
    const today = new Date().toISOString().substring(0, 10);

    vi.mocked(fetchTodayCommits).mockResolvedValue([]);
    vi.mocked(fetchRecentPRs).mockResolvedValue([
      {
        number: 101,
        title: 'Fix crash (#77)',
        state: 'MERGED',
        createdAt: today + 'T08:00:00Z',
        mergedAt: today + 'T09:00:00Z',
        reviewDecision: 'APPROVED',
        ciStatus: 'pass',
      },
    ]);
    vi.mocked(fetchClosedIssues).mockResolvedValue([
      { number: 77, title: 'App crashes on startup', closedAt: today + 'T09:30:00Z' },
    ]);
    vi.mocked(fetchMyOpenIssues).mockResolvedValue([]);
    vi.mocked(fetchMyOpenPRs).mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    // Issue #77 should have linkedPR = PR #101 (title contains "#77")
    expect(body.completedIssues[0].linkedPR).toBeDefined();
    expect(body.completedIssues[0].linkedPR.number).toBe(101);
  });

  it('carryOver marks backlog issues', async () => {
    vi.mocked(fetchTodayCommits).mockResolvedValue([]);
    vi.mocked(fetchRecentPRs).mockResolvedValue([]);
    vi.mocked(fetchClosedIssues).mockResolvedValue([]);
    vi.mocked(fetchMyOpenIssues).mockResolvedValue([
      makeIssue({ number: 10, labels: [{ name: 'backlog' }] }),
      makeIssue({ number: 11, labels: [{ name: 'bug' }] }),
    ]);
    vi.mocked(fetchMyOpenPRs).mockResolvedValue([]);
    vi.mocked(classifyPRAction).mockReturnValue('waiting');

    const res = await GET();
    const body = await res.json();

    const backlog = body.carryOver.find((i: { number: number }) => i.number === 10);
    expect(backlog.isBacklog).toBe(true);

    const nonBacklog = body.carryOver.find((i: { number: number }) => i.number === 11);
    expect(nonBacklog.isBacklog).toBe(false);
  });
});
