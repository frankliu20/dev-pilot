import { describe, it, expect, vi } from 'vitest';
import { makeTask } from '../helpers/factories';

vi.mock('@/lib/statusLog', () => ({
  deriveTasks: vi.fn(),
}));

import { GET } from '@/app/api/tasks/route';
import { deriveTasks } from '@/lib/statusLog';

describe('GET /api/tasks', () => {
  it('returns 200 with tasks', async () => {
    const tasks = [makeTask({ taskId: 'issue-1' }), makeTask({ taskId: 'issue-2' })];
    vi.mocked(deriveTasks).mockReturnValue(tasks);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tasks).toHaveLength(2);
    expect(body.tasks[0].taskId).toBe('issue-1');
    expect(deriveTasks).toHaveBeenCalledOnce();
  });

  it('returns 200 with empty array when no tasks', async () => {
    vi.mocked(deriveTasks).mockReturnValue([]);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tasks).toHaveLength(0);
  });
});
