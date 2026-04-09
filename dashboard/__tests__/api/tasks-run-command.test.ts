import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/terminal', () => ({
  openClaudeTerminal: vi.fn(),
}));

import { POST } from '@/app/api/tasks/run-command/route';
import { openClaudeTerminal } from '@/lib/terminal';

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL('/api/tasks/run-command', 'http://localhost:3000'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/tasks/run-command', () => {
  it('handles prompt path', async () => {
    vi.mocked(openClaudeTerminal).mockReturnValue({ success: true });

    const res = await POST(createRequest({ prompt: 'Explain this codebase' }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);

    expect(openClaudeTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        customPrompt: 'Explain this codebase',
      }),
    );
  });

  it('handles command path with slash prefix', async () => {
    vi.mocked(openClaudeTerminal).mockReturnValue({ success: true });

    const res = await POST(createRequest({ command: '/my-command' }));
    expect(res.status).toBe(200);

    expect(openClaudeTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        customPrompt: '/my-command',
        tabTitle: 'Claude: /my-command',
      }),
    );
  });

  it('handles command path without slash prefix', async () => {
    vi.mocked(openClaudeTerminal).mockReturnValue({ success: true });

    await POST(createRequest({ command: 'my-command' }));

    expect(openClaudeTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        customPrompt: '/my-command',
      }),
    );
  });

  it('returns 400 for invalid command characters', async () => {
    const res = await POST(createRequest({ command: 'my command; rm -rf' }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Invalid command name');
  });

  it('returns 400 when both command and prompt are missing', async () => {
    const res = await POST(createRequest({}));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Missing command or prompt');
  });

  it('returns 500 when terminal fails', async () => {
    vi.mocked(openClaudeTerminal).mockReturnValue({
      success: false,
      error: 'Terminal error',
    });

    const res = await POST(createRequest({ command: 'test' }));
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Terminal error');
  });

  it('prompt takes priority over command when both provided', async () => {
    vi.mocked(openClaudeTerminal).mockReturnValue({ success: true });

    await POST(createRequest({
      prompt: 'Custom prompt text',
      command: 'my-cmd',
    }));

    expect(openClaudeTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        customPrompt: 'Custom prompt text',
      }),
    );
  });

  it('trims whitespace from prompt', async () => {
    vi.mocked(openClaudeTerminal).mockReturnValue({ success: true });

    await POST(createRequest({ prompt: '  hello world  ' }));

    expect(openClaudeTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        customPrompt: 'hello world',
      }),
    );
  });

  it('truncates long prompt for tab label', async () => {
    vi.mocked(openClaudeTerminal).mockReturnValue({ success: true });

    const longPrompt = 'A'.repeat(60);
    await POST(createRequest({ prompt: longPrompt }));

    expect(openClaudeTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        tabTitle: expect.stringContaining('…'),
      }),
    );
  });
});
