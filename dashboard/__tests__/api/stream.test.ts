import { describe, it, expect, vi } from 'vitest';
import { makeTask, makeDecision } from '../helpers/factories';

vi.mock('@/lib/statusLog', () => ({
  deriveTasks: vi.fn(),
  watchStatusLog: vi.fn(),
}));

vi.mock('@/lib/decisions', () => ({
  readPendingDecisions: vi.fn(),
  watchDecisions: vi.fn(),
}));

import { GET } from '@/app/api/stream/route';
import { deriveTasks, watchStatusLog } from '@/lib/statusLog';
import { readPendingDecisions, watchDecisions } from '@/lib/decisions';

describe('GET /api/stream', () => {
  it('returns SSE response with correct headers', async () => {
    vi.mocked(deriveTasks).mockReturnValue([makeTask()]);
    vi.mocked(readPendingDecisions).mockReturnValue([]);
    vi.mocked(watchStatusLog).mockReturnValue(() => {});
    vi.mocked(watchDecisions).mockReturnValue(() => {});

    const res = await GET();

    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(res.headers.get('Connection')).toBe('keep-alive');
  });

  it('returns a readable stream body', async () => {
    vi.mocked(deriveTasks).mockReturnValue([makeTask()]);
    vi.mocked(readPendingDecisions).mockReturnValue([makeDecision()]);
    vi.mocked(watchStatusLog).mockReturnValue(() => {});
    vi.mocked(watchDecisions).mockReturnValue(() => {});

    const res = await GET();
    expect(res.body).toBeInstanceOf(ReadableStream);

    // Read initial events from stream — may arrive in multiple chunks
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';

    // Read a few chunks to collect both initial events
    for (let i = 0; i < 5; i++) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if (text.includes('event: tasks') && text.includes('event: decisions')) break;
    }

    expect(text).toContain('event: tasks');
    expect(text).toContain('event: decisions');

    // Cancel the stream to trigger cleanup
    await reader.cancel();
  });

  it('sets up watchers that can be cleaned up', async () => {
    const stopLogs = vi.fn();
    const stopDecisions = vi.fn();

    vi.mocked(deriveTasks).mockReturnValue([]);
    vi.mocked(readPendingDecisions).mockReturnValue([]);
    vi.mocked(watchStatusLog).mockReturnValue(stopLogs);
    vi.mocked(watchDecisions).mockReturnValue(stopDecisions);

    const res = await GET();
    const reader = res.body!.getReader();

    // Cancel the stream to trigger cleanup
    await reader.cancel();

    expect(stopLogs).toHaveBeenCalled();
    expect(stopDecisions).toHaveBeenCalled();
  });
});
