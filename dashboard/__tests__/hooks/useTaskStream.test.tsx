// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { makeTask, makeDecision } from '../helpers/factories';

// ── MockEventSource ────────────────────────────────────────────────────
class MockEventSource {
  static instances: MockEventSource[] = [];
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  onerror: (() => void) | null = null;
  close = vi.fn();
  url: string;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: (e: MessageEvent) => void) {
    (this.listeners[type] ||= []).push(handler);
  }

  /** Simulate a server-sent event */
  emit(type: string, data: unknown) {
    const event = { data: JSON.stringify(data) } as MessageEvent;
    this.listeners[type]?.forEach((h) => h(event));
  }

  triggerError() {
    this.onerror?.();
  }
}

// ── Helpers ────────────────────────────────────────────────────────────
function latestES(): MockEventSource {
  return MockEventSource.instances[MockEventSource.instances.length - 1];
}

// ── Tests ──────────────────────────────────────────────────────────────
describe('useTaskStream', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Lazy-import so the stubbed EventSource is in place when the module loads
  async function importHook() {
    return (await import('@/app/hooks/useTaskStream')).useTaskStream;
  }

  it('creates an EventSource to /api/stream on mount', async () => {
    const useTaskStream = await importHook();
    renderHook(() => useTaskStream());

    expect(MockEventSource.instances).toHaveLength(1);
    expect(latestES().url).toBe('/api/stream');
  });

  it('starts with empty tasks, empty decisions, and connected=false', async () => {
    const useTaskStream = await importHook();
    const { result } = renderHook(() => useTaskStream());

    expect(result.current.tasks).toEqual([]);
    expect(result.current.decisions).toEqual([]);
    expect(result.current.connected).toBe(false);
  });

  it('parses "tasks" event and updates tasks state', async () => {
    const useTaskStream = await importHook();
    const task = makeTask({ taskId: 'issue-1' });

    const { result } = renderHook(() => useTaskStream());

    await act(() => {
      latestES().emit('tasks', { tasks: [task] });
    });

    expect(result.current.tasks).toEqual([task]);
  });

  it('parses "decisions" event and updates decisions state', async () => {
    const useTaskStream = await importHook();
    const decision = makeDecision({ taskId: 'issue-7' });

    const { result } = renderHook(() => useTaskStream());

    await act(() => {
      latestES().emit('decisions', { decisions: [decision] });
    });

    expect(result.current.decisions).toEqual([decision]);
  });

  it('sets connected=true on first tasks event', async () => {
    const useTaskStream = await importHook();
    const { result } = renderHook(() => useTaskStream());

    expect(result.current.connected).toBe(false);

    await act(() => {
      latestES().emit('tasks', { tasks: [] });
    });

    expect(result.current.connected).toBe(true);
  });

  it('falls back to empty array when data.tasks is undefined', async () => {
    const useTaskStream = await importHook();
    const { result } = renderHook(() => useTaskStream());

    await act(() => {
      latestES().emit('tasks', {});
    });

    expect(result.current.tasks).toEqual([]);
    expect(result.current.connected).toBe(true);
  });

  it('falls back to empty array when data.decisions is undefined', async () => {
    const useTaskStream = await importHook();
    const { result } = renderHook(() => useTaskStream());

    await act(() => {
      latestES().emit('decisions', {});
    });

    expect(result.current.decisions).toEqual([]);
  });

  it('sets connected=false and closes EventSource on error', async () => {
    vi.useFakeTimers();
    const useTaskStream = await importHook();
    const { result } = renderHook(() => useTaskStream());

    // First mark connected
    await act(() => {
      latestES().emit('tasks', { tasks: [] });
    });
    expect(result.current.connected).toBe(true);

    const erroredES = latestES();

    await act(() => {
      erroredES.triggerError();
    });

    expect(result.current.connected).toBe(false);
    expect(erroredES.close).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('reconnects after 3 seconds on error', async () => {
    vi.useFakeTimers();
    const useTaskStream = await importHook();
    renderHook(() => useTaskStream());

    const countBefore = MockEventSource.instances.length;

    await act(() => {
      latestES().triggerError();
    });

    // Not yet reconnected
    expect(MockEventSource.instances).toHaveLength(countBefore);

    await act(() => {
      vi.advanceTimersByTime(3000);
    });

    // New EventSource created
    expect(MockEventSource.instances.length).toBeGreaterThan(countBefore);
    expect(latestES().url).toBe('/api/stream');

    vi.useRealTimers();
  });

  it('closes previous EventSource before creating new one on reconnect', async () => {
    vi.useFakeTimers();
    const useTaskStream = await importHook();
    renderHook(() => useTaskStream());

    const firstES = latestES();

    await act(() => {
      firstES.triggerError();
    });

    await act(() => {
      vi.advanceTimersByTime(3000);
    });

    // The first ES should have been closed (once by onerror, once by connect())
    expect(firstES.close).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('closes EventSource on unmount', async () => {
    const useTaskStream = await importHook();
    const { unmount } = renderHook(() => useTaskStream());

    const es = latestES();
    unmount();

    expect(es.close).toHaveBeenCalled();
  });

  it('handles multiple tasks events, keeping only the latest', async () => {
    const useTaskStream = await importHook();
    const { result } = renderHook(() => useTaskStream());

    const task1 = makeTask({ taskId: 'issue-1' });
    const task2 = makeTask({ taskId: 'issue-2' });

    await act(() => {
      latestES().emit('tasks', { tasks: [task1] });
    });
    expect(result.current.tasks).toEqual([task1]);

    await act(() => {
      latestES().emit('tasks', { tasks: [task2] });
    });
    expect(result.current.tasks).toEqual([task2]);
  });
});
