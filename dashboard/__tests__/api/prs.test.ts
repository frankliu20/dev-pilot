import { describe, it, expect, vi } from 'vitest';
import { makePR } from '../helpers/factories';

vi.mock('@/lib/github', () => ({
  fetchMyOpenPRs: vi.fn(),
  fetchReviewRequestedPRs: vi.fn(),
  fetchUnresolvedThreadCounts: vi.fn(),
  classifyPRAction: vi.fn(),
}));

import { GET } from '@/app/api/prs/route';
import {
  fetchMyOpenPRs,
  fetchReviewRequestedPRs,
  fetchUnresolvedThreadCounts,
  classifyPRAction,
} from '@/lib/github';

describe('GET /api/prs', () => {
  it('returns enriched PRs with unresolvedThreadCount and action', async () => {
    const myPR = makePR({ number: 100 });
    const reviewPR = makePR({ number: 200 });
    const countMap = new Map([[100, 3], [200, 0]]);

    vi.mocked(fetchMyOpenPRs).mockResolvedValue([myPR]);
    vi.mocked(fetchReviewRequestedPRs).mockResolvedValue([reviewPR]);
    vi.mocked(fetchUnresolvedThreadCounts).mockResolvedValue(countMap);
    vi.mocked(classifyPRAction).mockReturnValue('review_pending');

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.prs).toHaveLength(1);
    expect(body.prs[0].unresolvedThreadCount).toBe(3);
    expect(body.prs[0].action).toBe('review_pending');

    expect(body.reviewRequested).toHaveLength(1);
    expect(body.reviewRequested[0].unresolvedThreadCount).toBe(0);
  });

  it('handles empty PR arrays', async () => {
    vi.mocked(fetchMyOpenPRs).mockResolvedValue([]);
    vi.mocked(fetchReviewRequestedPRs).mockResolvedValue([]);
    vi.mocked(fetchUnresolvedThreadCounts).mockResolvedValue(new Map());

    const res = await GET();
    const body = await res.json();
    expect(body.prs).toHaveLength(0);
    expect(body.reviewRequested).toHaveLength(0);
  });

  it('calls classifyPRAction for each PR', async () => {
    const prs = [makePR({ number: 1 }), makePR({ number: 2 })];
    vi.mocked(fetchMyOpenPRs).mockResolvedValue(prs);
    vi.mocked(fetchReviewRequestedPRs).mockResolvedValue([]);
    vi.mocked(fetchUnresolvedThreadCounts).mockResolvedValue(new Map());
    vi.mocked(classifyPRAction).mockReturnValue('waiting');

    await GET();
    expect(classifyPRAction).toHaveBeenCalledTimes(2);
  });
});
