import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/terminal', () => ({
  openClaudeTerminal: vi.fn(),
}));

vi.mock('@/lib/types', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/types')>()),
  REPO: 'owner/repo',
}));

import { POST } from '@/app/api/tasks/review-pr/route';
import { openClaudeTerminal } from '@/lib/terminal';

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL('/api/tasks/review-pr', 'http://localhost:3000'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/tasks/review-pr', () => {
  it('returns 200 with prNumber', async () => {
    vi.mocked(openClaudeTerminal).mockReturnValue({ success: true });

    const res = await POST(createRequest({ prNumber: 123 }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('#123');

    expect(openClaudeTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        customPrompt: expect.stringContaining('https://github.com/owner/repo/pull/123'),
      }),
    );
  });

  it('returns 200 with valid prUrl', async () => {
    vi.mocked(openClaudeTerminal).mockReturnValue({ success: true });

    const res = await POST(createRequest({
      prUrl: 'https://github.com/other/repo/pull/456',
    }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('#456');
  });

  it('returns 400 for invalid prUrl format', async () => {
    const res = await POST(createRequest({
      prUrl: 'https://not-github.com/foo/bar',
    }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('Invalid PR URL');
  });

  it('returns 400 when both prNumber and prUrl are missing', async () => {
    const res = await POST(createRequest({}));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Missing prNumber or prUrl');
  });

  it('forces normal strategy for own PRs', async () => {
    vi.mocked(openClaudeTerminal).mockReturnValue({ success: true });

    await POST(createRequest({
      prNumber: 123,
      strategy: 'auto',
      context: 'reviewing-own',
    }));

    // The custom prompt should use strategy "normal" even though "auto" was requested
    expect(openClaudeTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        customPrompt: expect.stringContaining('--strategy normal'),
      }),
    );
  });

  it('allows auto strategy for reviewing-others', async () => {
    vi.mocked(openClaudeTerminal).mockReturnValue({ success: true });

    await POST(createRequest({
      prNumber: 123,
      strategy: 'auto',
      context: 'reviewing-others',
    }));

    expect(openClaudeTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        customPrompt: expect.stringContaining('--strategy auto'),
      }),
    );
  });

  it('returns 500 when terminal fails', async () => {
    vi.mocked(openClaudeTerminal).mockReturnValue({
      success: false,
      error: 'Cannot open terminal',
    });

    const res = await POST(createRequest({ prNumber: 123 }));
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Cannot open terminal');
  });

  it('strips query params and hash from prUrl', async () => {
    vi.mocked(openClaudeTerminal).mockReturnValue({ success: true });

    await POST(createRequest({
      prUrl: 'https://github.com/owner/repo/pull/789?diff=split#discussion_r123',
    }));

    expect(openClaudeTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        customPrompt: expect.stringContaining('https://github.com/owner/repo/pull/789'),
      }),
    );
    // Verify no query string or hash in the prompt
    const call = vi.mocked(openClaudeTerminal).mock.calls[0][0];
    const prompt = typeof call === 'object' && 'customPrompt' in call ? call.customPrompt : '';
    expect(prompt).not.toContain('?diff=split');
    expect(prompt).not.toContain('#discussion');
  });

  it('uses default strategy and level from context config', async () => {
    vi.mocked(openClaudeTerminal).mockReturnValue({ success: true });

    await POST(createRequest({ prNumber: 10 }));

    // Default context is 'reviewing-others', default strategy: 'normal', level: 'medium'
    expect(openClaudeTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        customPrompt: expect.stringMatching(/--strategy normal --level medium/),
      }),
    );
  });
});
