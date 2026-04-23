import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/terminal', () => ({
  openClaudeTerminal: vi.fn(),
}));

vi.mock('@/lib/types', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/types')>()),
  REPO: 'owner/repo',
  REPO_URL: 'https://github.com/owner/repo',
}));

import { POST } from '@/app/api/tasks/fix-comments/route';
import { openClaudeTerminal } from '@/lib/terminal';

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL('/api/tasks/fix-comments', 'http://localhost:3000'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/tasks/fix-comments', () => {
  it('returns 200 when terminal opened successfully', async () => {
    vi.mocked(openClaudeTerminal).mockReturnValue({ success: true, message: 'Terminal opened' });

    const res = await POST(createRequest({ prNumber: 100 }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('PR #100');

    expect(openClaudeTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        customPrompt: expect.stringContaining('https://github.com/owner/repo/pull/100'),
        tabTitle: expect.stringContaining('PR #100'),
        cliTool: 'claude',
      }),
    );
  });

  it('returns 400 when prNumber is missing', async () => {
    const res = await POST(createRequest({}));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Missing prNumber');
  });

  it('returns 400 when prNumber is not a number', async () => {
    const res = await POST(createRequest({ prNumber: 'abc' }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Missing prNumber');
  });

  it('returns 500 when terminal fails to spawn', async () => {
    vi.mocked(openClaudeTerminal).mockReturnValue({
      success: false,
      error: 'Terminal not available',
    });

    const res = await POST(createRequest({ prNumber: 100 }));
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Terminal not available');
  });

  it('passes custom cliTool to openClaudeTerminal', async () => {
    vi.mocked(openClaudeTerminal).mockReturnValue({ success: true });

    await POST(createRequest({ prNumber: 50, cliTool: 'copilot' }));

    expect(openClaudeTerminal).toHaveBeenCalledWith(
      expect.objectContaining({ cliTool: 'copilot' }),
    );
  });
});
