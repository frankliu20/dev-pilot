import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { makeWorkerEntry } from '../helpers/factories';

vi.mock('@/lib/registry', () => ({
  registry: {
    assign: vi.fn(),
  },
}));

import { POST } from '@/app/api/tasks/assign/route';
import { registry } from '@/lib/registry';

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL('/api/tasks/assign', 'http://localhost:3000'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/tasks/assign', () => {
  it('returns 200 when task started successfully', async () => {
    vi.mocked(registry.assign).mockReturnValue({
      result: 'started',
      entry: makeWorkerEntry(),
    });

    const res = await POST(createRequest({
      issueUrl: 'https://github.com/owner/repo/issues/42',
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.taskId).toBe('issue-42');
    expect(body.message).toContain('#42');
  });

  it('returns 400 when issueUrl is missing', async () => {
    const res = await POST(createRequest({}));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Missing issueUrl');
  });

  it('returns 400 when issueUrl is invalid (no number)', async () => {
    const res = await POST(createRequest({
      issueUrl: 'https://github.com/owner/repo/issues/abc',
    }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Invalid issue URL');
  });

  it('returns 409 when task is already running', async () => {
    vi.mocked(registry.assign).mockReturnValue({
      result: 'already_running',
      entry: makeWorkerEntry(),
    });

    const res = await POST(createRequest({
      issueUrl: 'https://github.com/owner/repo/issues/42',
    }));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('already has an active Claude session');
  });

  it('returns 500 when registry returns an error', async () => {
    vi.mocked(registry.assign).mockReturnValue({
      result: 'started',
      error: 'Failed to spawn terminal',
    });

    const res = await POST(createRequest({
      issueUrl: 'https://github.com/owner/repo/issues/42',
    }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Failed to spawn terminal');
  });

  it('passes force=true to registry.assign', async () => {
    vi.mocked(registry.assign).mockReturnValue({
      result: 'started',
      entry: makeWorkerEntry(),
    });

    await POST(createRequest({
      issueUrl: 'https://github.com/owner/repo/issues/42',
      force: true,
    }));

    expect(registry.assign).toHaveBeenCalledWith(
      'issue-42',
      'https://github.com/owner/repo/issues/42',
      'normal',
      true,
      'claude',
    );
  });

  it('passes mode and cliTool to registry.assign', async () => {
    vi.mocked(registry.assign).mockReturnValue({
      result: 'started',
      entry: makeWorkerEntry(),
    });

    await POST(createRequest({
      issueUrl: 'https://github.com/owner/repo/issues/10',
      mode: 'auto',
      cliTool: 'copilot',
    }));

    expect(registry.assign).toHaveBeenCalledWith(
      'issue-10',
      'https://github.com/owner/repo/issues/10',
      'auto',
      undefined,
      'copilot',
    );
  });
});
