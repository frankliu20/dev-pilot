import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { openClaudeTerminal } from '@/lib/terminal';

vi.mock('child_process');
vi.mock('@/lib/config', () => ({
  getRepo: vi.fn(() => 'owner/repo'),
  getWorkspace: vi.fn(() => '/mock/workspace'),
}));

const originalPlatform = process.platform;

function mockSpawn() {
  const mockProc = { unref: vi.fn() };
  vi.mocked(spawn).mockReturnValue(mockProc as any);
  return mockProc;
}

// ── String argument (legacy call) ────────────────────────────────────────

describe('openClaudeTerminal — string argument', () => {
  let savedPlatform: string;

  beforeEach(() => {
    savedPlatform = process.platform;
    mockSpawn();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: savedPlatform });
  });

  it('returns success with a message', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const result = openClaudeTerminal('https://github.com/owner/repo/issues/42');
    expect(result.success).toBe(true);
    expect(result.message).toContain('Terminal opened');
  });

  it('builds prompt with /pilot-dev-issue and no --auto for normal mode', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    openClaudeTerminal('https://github.com/owner/repo/issues/42', 'normal');

    const call = vi.mocked(spawn).mock.calls[0];
    const args = call[1] as string[];
    // The cmd should contain /pilot-dev-issue without --auto
    const cmdArg = args.find(a => a.includes('pilot-dev-issue'));
    expect(cmdArg).toBeDefined();
    expect(cmdArg).not.toContain('--auto');
  });

  it('builds prompt with --auto flag for auto mode', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    openClaudeTerminal('https://github.com/owner/repo/issues/42', 'auto');

    const call = vi.mocked(spawn).mock.calls[0];
    const args = call[1] as string[];
    const cmdArg = args.find(a => a.includes('pilot-dev-issue'));
    expect(cmdArg).toContain('--auto');
  });
});

// ── TerminalOptions argument ──────────────────────────────────────────────

describe('openClaudeTerminal — TerminalOptions argument', () => {
  let savedPlatform: string;

  beforeEach(() => {
    savedPlatform = process.platform;
    mockSpawn();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: savedPlatform });
  });

  it('returns failure when no issueUrl or customPrompt', () => {
    const result = openClaudeTerminal({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('No issueUrl or customPrompt');
  });

  it('uses customPrompt when provided', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    openClaudeTerminal({ customPrompt: 'do something' });

    const call = vi.mocked(spawn).mock.calls[0];
    const args = call[1] as string[];
    const cmdArg = args.find(a => a.includes('do something'));
    expect(cmdArg).toBeDefined();
  });

  it('includes --test-scenario flag when testScenario provided', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    openClaudeTerminal({
      issueUrl: 'https://github.com/owner/repo/issues/42',
      testScenario: 'vscode',
    });

    const call = vi.mocked(spawn).mock.calls[0];
    const args = call[1] as string[];
    const cmdArg = args.find(a => a.includes('--test-scenario vscode'));
    expect(cmdArg).toBeDefined();
  });

  it('uses copilot CLI config when cliTool is copilot', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    openClaudeTerminal({
      issueUrl: 'https://github.com/owner/repo/issues/42',
      cliTool: 'copilot',
    });

    const call = vi.mocked(spawn).mock.calls[0];
    const args = call[1] as string[];
    const cmdArg = args.find(a => a.includes('copilot'));
    expect(cmdArg).toBeDefined();
  });
});

// ── Platform-specific spawn ──────────────────────────────────────────────

describe('openClaudeTerminal — platform: win32', () => {
  let savedPlatform: string;

  beforeEach(() => {
    savedPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    mockSpawn();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: savedPlatform });
  });

  it('spawns wt.exe on Windows', () => {
    openClaudeTerminal('https://github.com/owner/repo/issues/42');
    expect(spawn).toHaveBeenCalledWith(
      'wt.exe',
      expect.arrayContaining(['new-tab']),
      expect.objectContaining({ detached: true, stdio: 'ignore' }),
    );
  });

  it('falls back to cmd when wt.exe throws', () => {
    vi.mocked(spawn)
      .mockImplementationOnce(() => { throw new Error('no wt.exe'); })
      .mockReturnValueOnce({ unref: vi.fn() } as any);

    const result = openClaudeTerminal('https://github.com/owner/repo/issues/42');
    expect(result.success).toBe(true);
    expect(vi.mocked(spawn).mock.calls[1][0]).toBe('cmd');
  });
});

describe('openClaudeTerminal — platform: darwin', () => {
  let savedPlatform: string;

  beforeEach(() => {
    savedPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    mockSpawn();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: savedPlatform });
  });

  it('spawns osascript on macOS', () => {
    openClaudeTerminal('https://github.com/owner/repo/issues/42');
    expect(spawn).toHaveBeenCalledWith(
      'osascript',
      expect.arrayContaining(['-e', expect.stringContaining('Terminal')]),
      expect.objectContaining({ detached: true }),
    );
  });
});

describe('openClaudeTerminal — platform: linux', () => {
  let savedPlatform: string;

  beforeEach(() => {
    savedPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });
    mockSpawn();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: savedPlatform });
  });

  it('tries gnome-terminal on Linux', () => {
    openClaudeTerminal('https://github.com/owner/repo/issues/42');
    expect(spawn).toHaveBeenCalledWith(
      'gnome-terminal',
      expect.arrayContaining(['--']),
      expect.objectContaining({ detached: true }),
    );
  });

  it('falls back to xterm if gnome-terminal throws', () => {
    vi.mocked(spawn)
      .mockImplementationOnce(() => { throw new Error('no gnome-terminal'); })
      .mockReturnValueOnce({ unref: vi.fn() } as any);

    openClaudeTerminal('https://github.com/owner/repo/issues/42');
    expect(vi.mocked(spawn).mock.calls[1][0]).toBe('xterm');
  });

  it('falls back to konsole if xterm also throws', () => {
    vi.mocked(spawn)
      .mockImplementationOnce(() => { throw new Error('no gnome-terminal'); })
      .mockImplementationOnce(() => { throw new Error('no xterm'); })
      .mockReturnValueOnce({ unref: vi.fn() } as any);

    openClaudeTerminal('https://github.com/owner/repo/issues/42');
    expect(vi.mocked(spawn).mock.calls[2][0]).toBe('konsole');
  });
});

// ── Sanitization ─────────────────────────────────────────────────────────

describe('openClaudeTerminal — prompt sanitization', () => {
  let savedPlatform: string;

  beforeEach(() => {
    savedPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    mockSpawn();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: savedPlatform });
  });

  it('replaces newlines with spaces in the prompt', () => {
    openClaudeTerminal({ customPrompt: 'line1\nline2\r\nline3' });

    const call = vi.mocked(spawn).mock.calls[0];
    const args = call[1] as string[];
    const cmdArg = args.find(a => a.includes('line1'));
    expect(cmdArg).not.toContain('\n');
    expect(cmdArg).not.toContain('\r');
  });
});
