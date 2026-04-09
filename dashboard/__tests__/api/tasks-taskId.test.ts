import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/registry', () => ({
  registry: {
    cancel: vi.fn(),
  },
}));

import { DELETE } from '@/app/api/tasks/[taskId]/route';
import { registry } from '@/lib/registry';

function createRequest(): NextRequest {
  return new NextRequest(new URL('/api/tasks/issue-42', 'http://localhost:3000'), {
    method: 'DELETE',
  });
}

describe('DELETE /api/tasks/[taskId]', () => {
  it('returns 200 when task cancelled successfully', async () => {
    vi.mocked(registry.cancel).mockReturnValue(true);

    const res = await DELETE(
      createRequest(),
      { params: Promise.resolve({ taskId: 'issue-42' }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toBe('Task issue-42 cancelled');
    expect(registry.cancel).toHaveBeenCalledWith('issue-42');
  });

  it('returns 404 when task is not running', async () => {
    vi.mocked(registry.cancel).mockReturnValue(false);

    const res = await DELETE(
      createRequest(),
      { params: Promise.resolve({ taskId: 'issue-99' }) },
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('not running');
  });

  it('returns 400 when taskId is missing (empty string)', async () => {
    const res = await DELETE(
      createRequest(),
      { params: Promise.resolve({ taskId: '' }) },
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing taskId');
  });
});
