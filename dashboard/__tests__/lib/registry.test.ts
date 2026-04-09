import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeTask, makeWorkerEntry } from '../helpers/factories';

vi.mock('@/lib/terminal');
vi.mock('@/lib/statusLog');
vi.mock('child_process');

describe('TaskRegistry', () => {
  let registry: typeof import('@/lib/registry').registry;
  let openClaudeTerminal: typeof import('@/lib/terminal').openClaudeTerminal;
  let deriveTasks: typeof import('@/lib/statusLog').deriveTasks;

  beforeEach(async () => {
    vi.resetModules();

    const terminalMod = await import('@/lib/terminal');
    openClaudeTerminal = terminalMod.openClaudeTerminal;
    vi.mocked(openClaudeTerminal).mockReturnValue({ success: true, message: 'ok' });

    const statusLogMod = await import('@/lib/statusLog');
    deriveTasks = statusLogMod.deriveTasks;
    vi.mocked(deriveTasks).mockReturnValue([]);

    const registryMod = await import('@/lib/registry');
    registry = registryMod.registry;
  });

  // ── assign ─────────────────────────────────────────────────────────────

  describe('assign()', () => {
    it('starts a new task and returns "started"', () => {
      const result = registry.assign('issue-42', 'https://github.com/o/r/issues/42');
      expect(result.result).toBe('started');
      expect(result.entry).toBeDefined();
      expect(result.entry!.taskId).toBe('issue-42');
      expect(result.entry!.status).toBe('running');
    });

    it('calls openClaudeTerminal with correct options', () => {
      registry.assign('issue-42', 'https://github.com/o/r/issues/42', 'auto', false, 'vscode', 'copilot');
      expect(openClaudeTerminal).toHaveBeenCalledWith({
        issueUrl: 'https://github.com/o/r/issues/42',
        mode: 'auto',
        testScenario: 'vscode',
        cliTool: 'copilot',
      });
    });

    it('returns "already_running" for an active task (no force)', () => {
      registry.assign('issue-42', 'https://github.com/o/r/issues/42');
      const result = registry.assign('issue-42', 'https://github.com/o/r/issues/42');
      expect(result.result).toBe('already_running');
    });

    it('allows reassignment with force=true', () => {
      registry.assign('issue-42', 'https://github.com/o/r/issues/42');
      const result = registry.assign('issue-42', 'https://github.com/o/r/issues/42', 'normal', true);
      expect(result.result).toBe('started');
    });

    it('returns error when terminal fails to open', () => {
      vi.mocked(openClaudeTerminal).mockReturnValue({ success: false, error: 'spawn failed' });
      const result = registry.assign('issue-42', 'https://github.com/o/r/issues/42');
      expect(result.result).toBe('started');
      expect(result.error).toBe('spawn failed');
    });

    it('refreshes from logs before checking status', () => {
      registry.assign('issue-42', 'https://github.com/o/r/issues/42');
      expect(deriveTasks).toHaveBeenCalled();
    });

    it('uses default cliTool as claude', () => {
      registry.assign('issue-42', 'https://github.com/o/r/issues/42');
      expect(openClaudeTerminal).toHaveBeenCalledWith(
        expect.objectContaining({ cliTool: 'claude' }),
      );
    });
  });

  // ── cancel ─────────────────────────────────────────────────────────────

  describe('cancel()', () => {
    it('returns false when task is not tracked', () => {
      expect(registry.cancel('issue-99')).toBe(false);
    });

    it('returns false when task is not running', () => {
      registry.assign('issue-42', 'https://github.com/o/r/issues/42');
      // Mark as completed via log refresh
      vi.mocked(deriveTasks).mockReturnValue([
        makeTask({ taskId: 'issue-42', phase: 'done' }),
      ]);
      registry.getAll(); // trigger refresh
      expect(registry.cancel('issue-42')).toBe(false);
    });

    it('marks task as cancelled and returns true', () => {
      registry.assign('issue-42', 'https://github.com/o/r/issues/42');
      const result = registry.cancel('issue-42');
      expect(result).toBe(true);
    });

    it('marks task as cancelled on win32 and returns true', () => {
      const savedPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      registry.assign('issue-42', 'https://github.com/o/r/issues/42');
      const result = registry.cancel('issue-42');
      expect(result).toBe(true);

      // Worker should be marked as cancelled
      const all = registry.getAll();
      const worker = all.find(w => w.taskId === 'issue-42');
      expect(worker?.status).toBe('cancelled');

      Object.defineProperty(process, 'platform', { value: savedPlatform });
    });

    it('marks task as cancelled on linux and returns true', () => {
      const savedPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      registry.assign('issue-42', 'https://github.com/o/r/issues/42');
      const result = registry.cancel('issue-42', 'claude');
      expect(result).toBe(true);

      const all = registry.getAll();
      const worker = all.find(w => w.taskId === 'issue-42');
      expect(worker?.status).toBe('cancelled');

      Object.defineProperty(process, 'platform', { value: savedPlatform });
    });
  });

  // ── getAll ─────────────────────────────────────────────────────────────

  describe('getAll()', () => {
    it('returns empty array initially', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('returns all tracked workers', () => {
      registry.assign('issue-1', 'https://github.com/o/r/issues/1');
      registry.assign('issue-2', 'https://github.com/o/r/issues/2');

      const all = registry.getAll();
      expect(all).toHaveLength(2);
    });

    it('refreshes from logs before returning', () => {
      registry.getAll();
      expect(deriveTasks).toHaveBeenCalled();
    });
  });

  // ── isRunning ──────────────────────────────────────────────────────────

  describe('isRunning()', () => {
    it('returns false for unknown tasks', () => {
      expect(registry.isRunning('issue-99')).toBe(false);
    });

    it('returns true for running tasks', () => {
      registry.assign('issue-42', 'https://github.com/o/r/issues/42');
      expect(registry.isRunning('issue-42')).toBe(true);
    });

    it('returns false for completed tasks', () => {
      registry.assign('issue-42', 'https://github.com/o/r/issues/42');
      vi.mocked(deriveTasks).mockReturnValue([
        makeTask({ taskId: 'issue-42', phase: 'done' }),
      ]);
      expect(registry.isRunning('issue-42')).toBe(false);
    });

    it('returns false for cancelled tasks', () => {
      registry.assign('issue-42', 'https://github.com/o/r/issues/42');
      registry.cancel('issue-42');
      expect(registry.isRunning('issue-42')).toBe(false);
    });
  });

  // ── refreshFromLogs ────────────────────────────────────────────────────

  describe('refreshFromLogs (via getAll)', () => {
    it('updates worker phase from logs', () => {
      registry.assign('issue-42', 'https://github.com/o/r/issues/42');
      vi.mocked(deriveTasks).mockReturnValue([
        makeTask({ taskId: 'issue-42', phase: 'implementing' }),
      ]);

      const all = registry.getAll();
      const worker = all.find(w => w.taskId === 'issue-42');
      expect(worker?.phase).toBe('implementing');
      expect(worker?.status).toBe('running');
    });

    it('marks worker as completed when phase is terminal (done)', () => {
      registry.assign('issue-42', 'https://github.com/o/r/issues/42');
      vi.mocked(deriveTasks).mockReturnValue([
        makeTask({ taskId: 'issue-42', phase: 'done' }),
      ]);

      const all = registry.getAll();
      const worker = all.find(w => w.taskId === 'issue-42');
      expect(worker?.status).toBe('completed');
    });

    it('marks worker as completed when phase is terminal (failed)', () => {
      registry.assign('issue-42', 'https://github.com/o/r/issues/42');
      vi.mocked(deriveTasks).mockReturnValue([
        makeTask({ taskId: 'issue-42', phase: 'failed' }),
      ]);

      const all = registry.getAll();
      const worker = all.find(w => w.taskId === 'issue-42');
      expect(worker?.status).toBe('completed');
    });

    it('handles deriveTasks throwing without crashing', () => {
      registry.assign('issue-42', 'https://github.com/o/r/issues/42');
      vi.mocked(deriveTasks).mockImplementation(() => { throw new Error('read fail'); });

      // Should not throw
      const all = registry.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].status).toBe('running');
    });
  });
});
