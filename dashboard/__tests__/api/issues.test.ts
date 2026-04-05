import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { makeIssue } from '../helpers/factories';

vi.mock('@/lib/github', () => ({
  fetchMyOpenIssues: vi.fn(),
  fetchIssueDetail: vi.fn(),
}));

import { GET } from '@/app/api/issues/route';
import { fetchMyOpenIssues, fetchIssueDetail } from '@/lib/github';

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'));
}

describe('GET /api/issues', () => {
  it('returns list of issues when no number param', async () => {
    const issues = [makeIssue({ number: 1 }), makeIssue({ number: 2 })];
    vi.mocked(fetchMyOpenIssues).mockResolvedValue(issues);

    const res = await GET(createRequest('/api/issues'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.issues).toHaveLength(2);
    expect(body.issues[0].number).toBe(1);
    expect(fetchMyOpenIssues).toHaveBeenCalledOnce();
  });

  it('returns single issue detail when number param provided', async () => {
    const issue = makeIssue({ number: 42 });
    vi.mocked(fetchIssueDetail).mockResolvedValue(issue);

    const res = await GET(createRequest('/api/issues?number=42'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.issue.number).toBe(42);
    expect(fetchIssueDetail).toHaveBeenCalledWith(42);
  });

  it('returns 404 when issue not found', async () => {
    vi.mocked(fetchIssueDetail).mockResolvedValue(null);

    const res = await GET(createRequest('/api/issues?number=999'));
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBe('Issue not found');
  });

  it('propagates errors from fetchMyOpenIssues', async () => {
    vi.mocked(fetchMyOpenIssues).mockRejectedValue(new Error('GitHub API error'));

    await expect(GET(createRequest('/api/issues'))).rejects.toThrow('GitHub API error');
  });
});
