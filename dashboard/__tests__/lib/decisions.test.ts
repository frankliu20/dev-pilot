import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { makeDecision, makeTask } from '../helpers/factories';

vi.mock('fs');
vi.mock('@/lib/config', () => ({
  getWorkspace: vi.fn(() => '/mock/workspace'),
}));
vi.mock('@/lib/statusLog', () => ({
  deriveTasks: vi.fn(() => []),
}));

import { readPendingDecisions, dismissDecision, watchDecisions } from '@/lib/decisions';
import { deriveTasks } from '@/lib/statusLog';

beforeEach(() => {
  vi.mocked(fs.existsSync).mockReturnValue(true);
  vi.mocked(fs.readdirSync).mockReturnValue([] as unknown as ReturnType<typeof fs.readdirSync>);
  vi.mocked(fs.readFileSync).mockReturnValue('');
  vi.mocked(deriveTasks).mockReturnValue([]);
});

// ── readPendingDecisions ─────────────────────────────────────────────────

describe('readPendingDecisions', () => {
  it('returns empty array when directory does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(readPendingDecisions()).toEqual([]);
  });

  it('returns empty array when no .json files', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['readme.txt'] as unknown as ReturnType<typeof fs.readdirSync>);
    expect(readPendingDecisions()).toEqual([]);
  });

  it('reads and parses .json decision files', () => {
    const decision = makeDecision({ taskId: 'issue-42' });
    vi.mocked(fs.readdirSync).mockReturnValue(['issue-42.json'] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(decision));

    const decisions = readPendingDecisions();
    expect(decisions).toHaveLength(1);
    expect(decisions[0].taskId).toBe('issue-42');
  });

  it('skips malformed JSON files', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['bad.json'] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.readFileSync).mockReturnValue('not-json');

    expect(readPendingDecisions()).toEqual([]);
  });

  it('auto-dismisses stale decisions when task has newer event', () => {
    const decision = makeDecision({
      taskId: 'issue-42',
      timestamp: '2026-04-08T09:00:00Z',
    });
    const task = makeTask({
      taskId: 'issue-42',
      lastUpdate: '2026-04-08T10:00:00Z', // newer than decision
    });

    vi.mocked(deriveTasks).mockReturnValue([task]);
    vi.mocked(fs.readdirSync).mockReturnValue(['issue-42.json'] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(decision));

    const decisions = readPendingDecisions();
    expect(decisions).toEqual([]);
    expect(fs.unlinkSync).toHaveBeenCalled();
  });

  it('keeps decisions when task has no newer events', () => {
    const decision = makeDecision({
      taskId: 'issue-42',
      timestamp: '2026-04-08T10:00:00Z',
    });
    const task = makeTask({
      taskId: 'issue-42',
      lastUpdate: '2026-04-08T09:00:00Z', // older than decision
    });

    vi.mocked(deriveTasks).mockReturnValue([task]);
    vi.mocked(fs.readdirSync).mockReturnValue(['issue-42.json'] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(decision));

    const decisions = readPendingDecisions();
    expect(decisions).toHaveLength(1);
  });

  it('keeps decisions for tasks with no log entries', () => {
    const decision = makeDecision({ taskId: 'issue-99' });
    vi.mocked(deriveTasks).mockReturnValue([]); // no tasks
    vi.mocked(fs.readdirSync).mockReturnValue(['issue-99.json'] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(decision));

    expect(readPendingDecisions()).toHaveLength(1);
  });

  it('sorts decisions by timestamp newest first', () => {
    const d1 = makeDecision({ taskId: 'issue-1', timestamp: '2026-04-08T08:00:00Z' });
    const d2 = makeDecision({ taskId: 'issue-2', timestamp: '2026-04-08T10:00:00Z' });

    vi.mocked(fs.readdirSync).mockReturnValue(['d1.json', 'd2.json'] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce(JSON.stringify(d1))
      .mockReturnValueOnce(JSON.stringify(d2));

    const decisions = readPendingDecisions();
    expect(decisions[0].taskId).toBe('issue-2');
    expect(decisions[1].taskId).toBe('issue-1');
  });

  it('handles unlinkSync failure gracefully during auto-dismiss', () => {
    const decision = makeDecision({
      taskId: 'issue-42',
      timestamp: '2026-04-08T09:00:00Z',
    });
    const task = makeTask({
      taskId: 'issue-42',
      lastUpdate: '2026-04-08T10:00:00Z',
    });

    vi.mocked(deriveTasks).mockReturnValue([task]);
    vi.mocked(fs.readdirSync).mockReturnValue(['issue-42.json'] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(decision));
    vi.mocked(fs.unlinkSync).mockImplementation(() => { throw new Error('perm denied'); });

    // Should not throw
    const decisions = readPendingDecisions();
    expect(decisions).toEqual([]);
  });
});

// ── dismissDecision ──────────────────────────────────────────────────────

describe('dismissDecision', () => {
  beforeEach(() => {
    // Ensure clean mock state for dismissDecision tests
    vi.mocked(fs.readdirSync).mockReturnValue([] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.readFileSync).mockReturnValue('');
    vi.mocked(fs.unlinkSync).mockReturnValue(undefined);
  });

  it('deletes file matching taskId and returns true', () => {
    const decision = makeDecision({ taskId: 'issue-42' });
    vi.mocked(fs.readdirSync).mockReturnValue(['issue-42.json'] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(decision));

    const result = dismissDecision('issue-42');
    expect(result).toBe(true);
    expect(fs.unlinkSync).toHaveBeenCalled();
  });

  it('returns false when no file matches', () => {
    const decision = makeDecision({ taskId: 'issue-99' });
    vi.mocked(fs.readdirSync).mockReturnValue(['issue-99.json'] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(decision));

    const result = dismissDecision('issue-42');
    expect(result).toBe(false);
  });

  it('returns false when no .json files exist', () => {
    vi.mocked(fs.readdirSync).mockReturnValue([] as unknown as ReturnType<typeof fs.readdirSync>);
    expect(dismissDecision('issue-42')).toBe(false);
  });

  it('skips malformed files and continues searching', () => {
    const validDecision = makeDecision({ taskId: 'issue-42' });
    vi.mocked(fs.readdirSync).mockReturnValue(['bad.json', 'good.json'] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce('not-json')
      .mockReturnValueOnce(JSON.stringify(validDecision));

    expect(dismissDecision('issue-42')).toBe(true);
  });
});

// ── watchDecisions ───────────────────────────────────────────────────────

describe('watchDecisions', () => {
  it('creates directory if missing and watches for .json changes', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const mockWatcher = { close: vi.fn() };
    vi.mocked(fs.watch).mockImplementation((_dir: any, listener: any) => {
      listener('change', 'task.json');
      return mockWatcher as any;
    });

    const callback = vi.fn();
    const unwatch = watchDecisions(callback);

    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    expect(callback).toHaveBeenCalledOnce();

    unwatch();
    expect(mockWatcher.close).toHaveBeenCalled();
  });

  it('does not create directory if it exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const mockWatcher = { close: vi.fn() };
    vi.mocked(fs.watch).mockReturnValue(mockWatcher as any);

    watchDecisions(vi.fn());
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  it('ignores non-.json file changes', () => {
    const mockWatcher = { close: vi.fn() };
    vi.mocked(fs.watch).mockImplementation((_dir: any, listener: any) => {
      listener('change', 'file.txt');
      return mockWatcher as any;
    });

    const callback = vi.fn();
    watchDecisions(callback);
    expect(callback).not.toHaveBeenCalled();
  });
});
