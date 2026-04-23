import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { makeStatusLogEntry } from '../helpers/factories';

vi.mock('fs');
vi.mock('@/lib/config', () => ({
  getWorkspace: vi.fn(() => '/mock/workspace'),
}));

import { readAllEntries, deriveTasks, watchStatusLog } from '@/lib/statusLog';

beforeEach(() => {
  vi.mocked(fs.existsSync).mockReturnValue(true);
  vi.mocked(fs.readdirSync).mockReturnValue([] as unknown as ReturnType<typeof fs.readdirSync>);
  vi.mocked(fs.readFileSync).mockReturnValue('');
});

// ── readAllEntries ───────────────────────────────────────────────────────

describe('readAllEntries', () => {
  it('returns empty array when log directory does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(readAllEntries()).toEqual([]);
  });

  it('returns empty array when no .jsonl files', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['readme.txt'] as unknown as ReturnType<typeof fs.readdirSync>);
    expect(readAllEntries()).toEqual([]);
  });

  it('reads and parses .jsonl files', () => {
    const entry = makeStatusLogEntry({ task_id: 'issue-1', type: 'task_start' });
    vi.mocked(fs.readdirSync).mockReturnValue(['issue-1.jsonl'] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(entry));

    const entries = readAllEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].task_id).toBe('issue-1');
  });

  it('parses multiple lines from a single file', () => {
    const e1 = makeStatusLogEntry({ task_id: 'issue-1', type: 'task_start' });
    const e2 = makeStatusLogEntry({ task_id: 'issue-1', type: 'analysis_done', timestamp: '2026-04-08T10:05:00Z' });
    vi.mocked(fs.readdirSync).mockReturnValue(['issue-1.jsonl'] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify(e1) + '\n' + JSON.stringify(e2)
    );

    expect(readAllEntries()).toHaveLength(2);
  });

  it('skips blank lines', () => {
    const entry = makeStatusLogEntry();
    vi.mocked(fs.readdirSync).mockReturnValue(['t.jsonl'] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.readFileSync).mockReturnValue(
      '\n' + JSON.stringify(entry) + '\n\n'
    );

    expect(readAllEntries()).toHaveLength(1);
  });

  it('skips malformed JSON lines', () => {
    const entry = makeStatusLogEntry();
    vi.mocked(fs.readdirSync).mockReturnValue(['t.jsonl'] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.readFileSync).mockReturnValue(
      'not-json\n' + JSON.stringify(entry)
    );

    expect(readAllEntries()).toHaveLength(1);
  });

  it('reads from multiple .jsonl files', () => {
    const e1 = makeStatusLogEntry({ task_id: 'issue-1' });
    const e2 = makeStatusLogEntry({ task_id: 'issue-2' });
    vi.mocked(fs.readdirSync).mockReturnValue(['issue-1.jsonl', 'issue-2.jsonl'] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce(JSON.stringify(e1))
      .mockReturnValueOnce(JSON.stringify(e2));

    expect(readAllEntries()).toHaveLength(2);
  });
});

// ── deriveTasks ──────────────────────────────────────────────────────────

describe('deriveTasks', () => {
  function setupEntries(...entries: ReturnType<typeof makeStatusLogEntry>[]) {
    vi.mocked(fs.readdirSync).mockReturnValue(['log.jsonl'] as unknown as ReturnType<typeof fs.readdirSync>);
    vi.mocked(fs.readFileSync).mockReturnValue(
      entries.map(e => JSON.stringify(e)).join('\n')
    );
  }

  it('returns empty array when no entries', () => {
    expect(deriveTasks()).toEqual([]);
  });

  it('groups entries by task_id', () => {
    setupEntries(
      makeStatusLogEntry({ task_id: 'issue-1', type: 'task_start' }),
      makeStatusLogEntry({ task_id: 'issue-2', type: 'task_start' }),
    );

    const tasks = deriveTasks();
    expect(tasks).toHaveLength(2);
  });

  it('extracts issue number from task_id "issue-42"', () => {
    setupEntries(makeStatusLogEntry({ task_id: 'issue-42', type: 'task_start' }));
    const tasks = deriveTasks();
    expect(tasks[0].issueNumber).toBe(42);
  });

  it('returns null issue number for non-matching task_id', () => {
    setupEntries(makeStatusLogEntry({ task_id: 'custom-task', type: 'task_start' }));
    const tasks = deriveTasks();
    expect(tasks[0].issueNumber).toBeNull();
  });

  // eventToPhase mapping tests
  it.each([
    ['task_start', 'planned'],
    ['analysis_done', 'exploring'],
    ['exploration_done', 'planning'],
    ['plan_approved', 'implementing'],
    ['implementation_done', 'testing'],
    ['test_pass', 'creating_pr'],
    ['test_fail', 'test_failed'],
    ['manual_verify_waiting', 'waiting_manual_test'],
    ['manual_verify_done', 'creating_pr'],
    ['pr_created', 'done'],
    ['pr_merged', 'done'],
    ['worktree_cleaned', 'done'],
    ['skill_captured', 'done'],
    ['blocked', 'failed'],
    ['unknown_event', 'planned'],
  ] as const)('eventToPhase: "%s" → "%s"', (eventType, expectedPhase) => {
    setupEntries(makeStatusLogEntry({ task_id: 'issue-1', type: eventType, phase: '' }));
    const tasks = deriveTasks();
    expect(tasks[0].phase).toBe(expectedPhase);
  });

  // Phase field mapping (layer 2)
  it.each([
    ['analysis', 'analyzing'],
    ['exploration', 'exploring'],
    ['planning', 'planning'],
    ['implementation', 'implementing'],
    ['testing', 'testing'],
    ['pr_creation', 'creating_pr'],
    ['knowledge_capture', 'done'],
    ['completed', 'done'],
    ['failed', 'failed'],
    ['branch_setup', 'planned'],
  ] as const)('phase field "%s" maps to "%s"', (phaseField, expectedPhase) => {
    setupEntries(makeStatusLogEntry({
      task_id: 'issue-1',
      type: 'phase_change',
      phase: phaseField,
    }));
    const tasks = deriveTasks();
    expect(tasks[0].phase).toBe(expectedPhase);
  });

  // Hard overrides (layer 3)
  it('hard override: pr_created always → done', () => {
    setupEntries(makeStatusLogEntry({
      task_id: 'issue-1',
      type: 'pr_created',
      phase: 'testing',  // phase field says testing, but type overrides
    }));
    const tasks = deriveTasks();
    expect(tasks[0].phase).toBe('done');
  });

  it('hard override: test_fail always → test_failed', () => {
    setupEntries(makeStatusLogEntry({
      task_id: 'issue-1',
      type: 'test_fail',
      phase: 'implementation',
    }));
    const tasks = deriveTasks();
    expect(tasks[0].phase).toBe('test_failed');
  });

  it('hard override: blocked always → failed', () => {
    setupEntries(makeStatusLogEntry({
      task_id: 'issue-1',
      type: 'blocked',
      phase: 'analysis',
    }));
    const tasks = deriveTasks();
    expect(tasks[0].phase).toBe('failed');
  });

  it('hard override: manual_verify_waiting always → waiting_manual_test', () => {
    setupEntries(makeStatusLogEntry({
      task_id: 'issue-1',
      type: 'manual_verify_waiting',
      phase: 'testing',
    }));
    const tasks = deriveTasks();
    expect(tasks[0].phase).toBe('waiting_manual_test');
  });

  it('sorts tasks by lastUpdate descending (newest first)', () => {
    setupEntries(
      makeStatusLogEntry({ task_id: 'issue-1', timestamp: '2026-04-08T08:00:00Z' }),
      makeStatusLogEntry({ task_id: 'issue-2', timestamp: '2026-04-08T10:00:00Z' }),
      makeStatusLogEntry({ task_id: 'issue-3', timestamp: '2026-04-08T09:00:00Z' }),
    );

    const tasks = deriveTasks();
    expect(tasks[0].taskId).toBe('issue-2');
    expect(tasks[1].taskId).toBe('issue-3');
    expect(tasks[2].taskId).toBe('issue-1');
  });

  it('uses the last event for phase determination', () => {
    setupEntries(
      makeStatusLogEntry({ task_id: 'issue-1', type: 'task_start', timestamp: '2026-04-08T08:00:00Z', phase: '' }),
      makeStatusLogEntry({ task_id: 'issue-1', type: 'analysis_done', timestamp: '2026-04-08T09:00:00Z', phase: '' }),
      makeStatusLogEntry({ task_id: 'issue-1', type: 'plan_approved', timestamp: '2026-04-08T10:00:00Z', phase: '' }),
    );

    const tasks = deriveTasks();
    expect(tasks[0].phase).toBe('implementing'); // plan_approved → implementing
  });

  it('sets branch and prNumber from last event', () => {
    setupEntries(makeStatusLogEntry({
      task_id: 'issue-1',
      branch: 'fix/issue-1',
      pr_number: 99,
    }));

    const tasks = deriveTasks();
    expect(tasks[0].branch).toBe('fix/issue-1');
    expect(tasks[0].prNumber).toBe(99);
  });

  it('includes all events sorted by timestamp in the task', () => {
    setupEntries(
      makeStatusLogEntry({ task_id: 'issue-1', timestamp: '2026-04-08T10:00:00Z' }),
      makeStatusLogEntry({ task_id: 'issue-1', timestamp: '2026-04-08T08:00:00Z' }),
    );

    const tasks = deriveTasks();
    expect(tasks[0].events).toHaveLength(2);
    expect(tasks[0].events[0].timestamp).toBe('2026-04-08T08:00:00Z');
    expect(tasks[0].events[1].timestamp).toBe('2026-04-08T10:00:00Z');
  });
});

// ── watchStatusLog ───────────────────────────────────────────────────────

describe('watchStatusLog', () => {
  it('calls callback when a .jsonl file changes', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const mockWatcher = { close: vi.fn() };
    vi.mocked(fs.watch).mockImplementation((_dir: any, listener: any) => {
      // Simulate a file change event
      listener('change', 'issue-1.jsonl');
      return mockWatcher as any;
    });

    const unwatch = watchStatusLog(callback);
    vi.advanceTimersByTime(300);
    expect(callback).toHaveBeenCalledOnce();

    unwatch();
    expect(mockWatcher.close).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('does not call callback for non-.jsonl files', () => {
    const callback = vi.fn();
    const mockWatcher = { close: vi.fn() };
    vi.mocked(fs.watch).mockImplementation((_dir: any, listener: any) => {
      listener('change', 'readme.txt');
      return mockWatcher as any;
    });

    watchStatusLog(callback);
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not call callback when filename is null', () => {
    const callback = vi.fn();
    const mockWatcher = { close: vi.fn() };
    vi.mocked(fs.watch).mockImplementation((_dir: any, listener: any) => {
      listener('change', null);
      return mockWatcher as any;
    });

    watchStatusLog(callback);
    expect(callback).not.toHaveBeenCalled();
  });
});
