import { describe, it, expect, vi } from 'vitest';
import { makeWorkerEntry } from '../helpers/factories';

vi.mock('@/lib/registry', () => ({
  registry: {
    getAll: vi.fn(),
  },
}));

import { GET } from '@/app/api/tasks/registry/route';
import { registry } from '@/lib/registry';

describe('GET /api/tasks/registry', () => {
  it('returns 200 with workers and summary', async () => {
    const workers = [
      makeWorkerEntry({ taskId: 'issue-1', status: 'running' }),
      makeWorkerEntry({ taskId: 'issue-2', status: 'completed' }),
      makeWorkerEntry({ taskId: 'issue-3', status: 'running' }),
    ];
    vi.mocked(registry.getAll).mockReturnValue(workers);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.workers).toHaveLength(3);
    expect(body.summary.running).toBe(2);
    expect(body.summary.total).toBe(3);
  });

  it('returns empty workers with zero counts', async () => {
    vi.mocked(registry.getAll).mockReturnValue([]);

    const res = await GET();
    const body = await res.json();

    expect(body.workers).toHaveLength(0);
    expect(body.summary.running).toBe(0);
    expect(body.summary.total).toBe(0);
  });

  it('counts only running workers correctly', async () => {
    const workers = [
      makeWorkerEntry({ status: 'cancelled' }),
      makeWorkerEntry({ status: 'completed' }),
    ];
    vi.mocked(registry.getAll).mockReturnValue(workers);

    const res = await GET();
    const body = await res.json();

    expect(body.summary.running).toBe(0);
    expect(body.summary.total).toBe(2);
  });
});
