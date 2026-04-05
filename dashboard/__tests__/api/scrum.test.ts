import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('@/lib/github', () => ({
  fetchRecentPRs: vi.fn(),
  fetchMyOpenIssues: vi.fn(),
  fetchMyOpenPRs: vi.fn(),
  classifyPRAction: vi.fn(),
}));

vi.mock('@/lib/config', () => ({
  getWorkspace: vi.fn().mockReturnValue('/workspace'),
}));

vi.mock('@/lib/types', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/types')>()),
  REPO: 'owner/repo',
}));

import { GET, POST, PATCH } from '@/app/api/scrum/route';
import { fetchRecentPRs, fetchMyOpenIssues, fetchMyOpenPRs, classifyPRAction } from '@/lib/github';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { makeIssue, makePR } from '../helpers/factories';

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
}

describe('GET /api/scrum', () => {
  beforeEach(() => {
    // Default: no scrum mark saved
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));
  });

  it('returns scrum items with done, ongoing, blockers', async () => {
    const today = new Date().toISOString().substring(0, 10);

    vi.mocked(fetchRecentPRs).mockResolvedValue([
      {
        number: 10,
        title: 'Fix bug (#5)',
        state: 'MERGED',
        mergedAt: new Date().toISOString(),
        createdAt: today + 'T08:00:00Z',
        reviewDecision: 'APPROVED',
        ciStatus: 'pass',
      },
    ]);
    vi.mocked(fetchMyOpenIssues).mockResolvedValue([
      makeIssue({ number: 20, title: 'Open feature', labels: [{ name: 'enhancement' }] }),
    ]);
    vi.mocked(fetchMyOpenPRs).mockResolvedValue([]);
    vi.mocked(classifyPRAction).mockReturnValue('waiting');

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.date).toBe(today);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.done).toBeDefined();
    expect(body.ongoing).toBeDefined();
    expect(body.blockers).toBeDefined();
  });

  it('uses 3-day default when no scrum mark exists', async () => {
    vi.mocked(fetchRecentPRs).mockResolvedValue([]);
    vi.mocked(fetchMyOpenIssues).mockResolvedValue([]);
    vi.mocked(fetchMyOpenPRs).mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(body.lastScrum).toBeNull();
    // sinceDate should be roughly 3 days ago
    const since = new Date(body.sinceDate);
    const diff = Date.now() - since.getTime();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    expect(diff).toBeGreaterThan(threeDaysMs - 60000); // within 1 minute tolerance
    expect(diff).toBeLessThan(threeDaysMs + 60000);
  });
});

describe('POST /api/scrum', () => {
  it('validates updates array is present', async () => {
    const res = await POST(createRequest('/api/scrum', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('No updates provided');
  });

  it('validates updates array is not empty', async () => {
    const res = await POST(createRequest('/api/scrum', {
      method: 'POST',
      body: JSON.stringify({ updates: [] }),
      headers: { 'Content-Type': 'application/json' },
    }));
    expect(res.status).toBe(400);
  });

  it('posts comments and returns results', async () => {
    // Mock exec (promisified) to succeed
    vi.mocked(exec).mockImplementation((_cmd: unknown, _opts: unknown, cb: unknown) => {
      const callback = cb as (err: Error | null, result: { stdout: string; stderr: string }) => void;
      callback(null, { stdout: '', stderr: '' });
      return {} as import('child_process').ChildProcess;
    });

    const res = await POST(createRequest('/api/scrum', {
      method: 'POST',
      body: JSON.stringify({
        updates: [
          { issueNumber: 42, comment: 'Status update' },
        ],
      }),
      headers: { 'Content-Type': 'application/json' },
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.posted).toBe(1);
    expect(body.failed).toBe(0);
  });

  it('handles gh command failure for individual update', async () => {
    vi.mocked(exec).mockImplementation((_cmd: unknown, _opts: unknown, cb: unknown) => {
      const callback = cb as (err: Error | null) => void;
      callback(new Error('gh: command failed'));
      return {} as import('child_process').ChildProcess;
    });

    const res = await POST(createRequest('/api/scrum', {
      method: 'POST',
      body: JSON.stringify({
        updates: [
          { issueNumber: 42, comment: 'Update' },
        ],
      }),
      headers: { 'Content-Type': 'application/json' },
    }));

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.failed).toBe(1);
    expect(body.results[0].success).toBe(false);
  });
});

describe('PATCH /api/scrum', () => {
  it('writes scrum mark timestamp', async () => {
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue();

    const res = await PATCH();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.mark).toBeDefined();
    expect(body.mark.timestamp).toBeDefined();
    expect(body.mark.label).toBeDefined();

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('scrum-mark.json'),
      expect.any(String),
      'utf-8',
    );
  });

  it('returns 500 when write fails', async () => {
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockRejectedValue(new Error('Permission denied'));

    const res = await PATCH();
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error).toContain('Failed to save scrum mark');
  });
});
