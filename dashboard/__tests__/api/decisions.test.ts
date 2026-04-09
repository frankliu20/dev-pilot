import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/decisions', () => ({
  dismissDecision: vi.fn(),
}));

import { DELETE } from '@/app/api/decisions/route';
import { dismissDecision } from '@/lib/decisions';

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: 'DELETE',
  });
}

describe('DELETE /api/decisions', () => {
  it('returns 200 with success:true when decision dismissed', async () => {
    vi.mocked(dismissDecision).mockReturnValue(true);

    const res = await DELETE(createRequest('/api/decisions?taskId=issue-42'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(dismissDecision).toHaveBeenCalledWith('issue-42');
  });

  it('returns 400 when taskId is missing', async () => {
    const res = await DELETE(createRequest('/api/decisions'));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('taskId is required');
  });

  it('returns success:false when decision not found', async () => {
    vi.mocked(dismissDecision).mockReturnValue(false);

    const res = await DELETE(createRequest('/api/decisions?taskId=issue-999'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
