import { describe, it, expect, vi } from 'vitest';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  rmSync: vi.fn(),
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('@/lib/config', () => ({
  getWorkspace: vi.fn().mockReturnValue('/workspace'),
  getConfig: vi.fn().mockReturnValue({
    workspace: '/workspace',
    repos: ['owner/repo'],
  }),
}));

import { POST } from '@/app/api/cleanup/route';
import { existsSync, readdirSync } from 'fs';

function createRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/cleanup', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/cleanup', () => {
  it('handles per-issue cleanup', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const res = await POST(createRequest({ issueNumber: 42 }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.results).toContainEqual(expect.stringContaining('issue #42'));
  });

  it('handles global cleanup with logs and worktrees', async () => {
    // findAllRepoPaths needs: workspace exists, entries with .git
    vi.mocked(existsSync).mockImplementation((p: unknown) => {
      const path = String(p);
      if (path === '/workspace') return true;
      if (path.endsWith('.git')) return true;
      if (path.endsWith('logs')) return true;
      return false;
    });
    vi.mocked(readdirSync).mockImplementation((p: unknown) => {
      const path = String(p);
      if (path === '/workspace') return ['repo' as unknown as import('fs').Dirent];
      if (path.endsWith('logs')) return ['issue-1.jsonl' as unknown as import('fs').Dirent];
      return [];
    });

    const res = await POST(createRequest({
      cleanLogs: true,
      cleanWorktrees: true,
    }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.results).toEqual(expect.arrayContaining([
      'Logs cleanup started',
      'Worktrees cleanup started',
    ]));
  });

  it('response includes results array', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readdirSync).mockReturnValue([]);

    const res = await POST(createRequest({
      cleanLogs: false,
      cleanWorktrees: false,
    }));
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(Array.isArray(body.results)).toBe(true);
  });

  it('includes pull message with repo count', async () => {
    // Reset mocks from previous tests
    vi.mocked(existsSync).mockReset();
    vi.mocked(readdirSync).mockReset();

    vi.mocked(existsSync).mockImplementation((p: unknown) => {
      const path = String(p).replace(/\\/g, '/');
      if (path.includes('/workspace') && !path.includes('.git')) return true;
      if (path.endsWith('.git')) return true;
      return false;
    });
    vi.mocked(readdirSync).mockImplementation((p: unknown) => {
      const path = String(p).replace(/\\/g, '/');
      if (path.endsWith('/workspace') || path === '/workspace') return ['repo1', 'repo2'] as unknown as import('fs').Dirent[];
      return [];
    });

    const res = await POST(createRequest({ cleanLogs: true }));
    const body = await res.json();

    expect(body.results).toContainEqual(expect.stringContaining('2 repo(s)'));
  });
});
