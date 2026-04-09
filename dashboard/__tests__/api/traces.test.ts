import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

import { GET } from '@/app/api/traces/route';
import { exec } from 'child_process';

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'));
}

// Helper to mock execAsync (promisified exec)
function mockExecAsync(stdout: string) {
  vi.mocked(exec).mockImplementation((_cmd: unknown, _opts: unknown, cb: unknown) => {
    const callback = cb as (err: Error | null, result: { stdout: string; stderr: string }) => void;
    callback(null, { stdout, stderr: '' });
    return {} as import('child_process').ChildProcess;
  });
}

function mockExecAsyncError(errorMessage: string) {
  vi.mocked(exec).mockImplementation((_cmd: unknown, _opts: unknown, cb: unknown) => {
    const callback = cb as (err: Error | null) => void;
    callback(new Error(errorMessage));
    return {} as import('child_process').ChildProcess;
  });
}

describe('GET /api/traces', () => {
  beforeEach(() => {
    // Reset global fetch mock
    vi.restoreAllMocks();
  });

  it('returns traces for valid query', async () => {
    // Mock az CLI for access token
    mockExecAsync('fake-token-123\n');

    // Mock global fetch for ARM API
    const mockFetchResponse = {
      ok: true,
      json: async () => ({
        tables: [{
          columns: [
            { name: 'timestamp' },
            { name: 'operation_Name' },
            { name: 'customDimensions' },
          ],
          rows: [
            ['2026-04-08T10:00:00Z', 'copilot/action', '{"sessionId":"sess-1","action":"migrate"}'],
          ],
        }],
      }),
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse));

    const res = await GET(createRequest('/api/traces?minutes=30'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.traces).toHaveLength(1);
    expect(body.count).toBe(1);
    expect(body.traces[0].operation).toBe('copilot/action');
    expect(body.traces[0].properties.sessionId).toBe('sess-1');
    // common.* and _MS.* should be filtered from properties
  });

  it('returns empty traces when no data', async () => {
    mockExecAsync('fake-token\n');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tables: [{ columns: [], rows: [] }],
      }),
    }));

    const res = await GET(createRequest('/api/traces'));
    const body = await res.json();

    expect(body.traces).toHaveLength(0);
    expect(body.count).toBe(0);
  });

  it('returns 401 when az login needed', async () => {
    mockExecAsyncError('Please run az login');

    const res = await GET(createRequest('/api/traces'));
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toContain('az login');
  });

  it('returns 500 when az CLI not found', async () => {
    mockExecAsyncError('az is not recognized');

    const res = await GET(createRequest('/api/traces'));
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error).toContain('Azure CLI not found');
  });

  it('returns 502 when ARM API returns error', async () => {
    mockExecAsync('fake-token\n');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    }));

    const res = await GET(createRequest('/api/traces'));
    expect(res.status).toBe(502);

    const body = await res.json();
    expect(body.error).toContain('ARM API returned 403');
  });

  it('passes sessionId filter to KQL query', async () => {
    mockExecAsync('token\n');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tables: [{ columns: [], rows: [] }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await GET(createRequest('/api/traces?sessionId=sess-abc'));

    // Verify the fetch body includes sessionId filter in KQL
    const fetchCall = fetchMock.mock.calls[0];
    const fetchBody = JSON.parse(fetchCall[1].body);
    expect(fetchBody.query).toContain("sessionId");
    expect(fetchBody.query).toContain("sess-abc");
  });

  it('filters out common.* and _MS.* from properties', async () => {
    mockExecAsync('token\n');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tables: [{
          columns: [
            { name: 'timestamp' },
            { name: 'operation_Name' },
            { name: 'customDimensions' },
          ],
          rows: [
            ['2026-04-08T10:00:00Z', 'op', JSON.stringify({
              'common.vscodemachineid': 'machine123',
              '_MS.ProcessedByMetricExtractors': 'true',
              'action': 'migrate',
              'sessionId': 'sess-1',
            })],
          ],
        }],
      }),
    }));

    const res = await GET(createRequest('/api/traces'));
    const body = await res.json();

    expect(body.traces[0].properties).not.toHaveProperty('common.vscodemachineid');
    expect(body.traces[0].properties).not.toHaveProperty('_MS.ProcessedByMetricExtractors');
    expect(body.traces[0].properties.action).toBe('migrate');
    // customDimensions should still have everything
    expect(body.traces[0].customDimensions['common.vscodemachineid']).toBe('machine123');
  });
});
