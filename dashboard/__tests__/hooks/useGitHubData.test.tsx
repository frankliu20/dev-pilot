// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGitHubData } from '@/app/hooks/useGitHubData';

// ── Mock fetch ─────────────────────────────────────────────────────────
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Helpers ────────────────────────────────────────────────────────────
function mockFetchSuccess(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve(data),
  });
}

function mockFetchFailure(error = new Error('Network error')) {
  mockFetch.mockRejectedValueOnce(error);
}

// ── Tests ──────────────────────────────────────────────────────────────
describe('useGitHubData', () => {
  it('starts with loading=true and data=null', () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useGitHubData('/api/issues'));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it('fetches from URL on mount', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderHook(() => useGitHubData('/api/issues'));

    expect(mockFetch).toHaveBeenCalledWith('/api/issues');
  });

  it('sets data and loading=false after successful fetch', async () => {
    const payload = [{ number: 1, title: 'Bug' }];
    mockFetchSuccess(payload);

    const { result } = renderHook(() => useGitHubData('/api/issues'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(payload);
  });

  it('sets loading=false and data stays null on fetch failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchFailure();

    const { result } = renderHook(() => useGitHubData('/api/issues'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch /api/issues'),
      expect.any(Error),
    );
  });

  it('logs error message including the URL on failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchFailure();

    renderHook(() => useGitHubData('/api/prs'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/prs'),
      expect.anything(),
    );
  });

  it('exposes a refresh function that triggers a re-fetch', async () => {
    const payload1 = { count: 1 };
    const payload2 = { count: 2 };
    mockFetchSuccess(payload1);

    const { result } = renderHook(() => useGitHubData('/api/data'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(payload1);

    // Prepare next response and call refresh
    mockFetchSuccess(payload2);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.data).toEqual(payload2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('sets loading=true when refresh is called', async () => {
    mockFetchSuccess({ v: 1 });

    const { result } = renderHook(() => useGitHubData('/api/data'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Prepare a slow response
    let resolveSecond!: (v: unknown) => void;
    mockFetch.mockReturnValueOnce(
      new Promise((r) => {
        resolveSecond = r;
      }),
    );

    act(() => {
      result.current.refresh();
    });

    // loading should be true while fetch is in-flight
    expect(result.current.loading).toBe(true);

    // Clean up
    await act(async () => {
      resolveSecond({ json: () => Promise.resolve({ v: 2 }) });
    });
  });

  it('re-fetches when URL changes', async () => {
    mockFetchSuccess({ source: 'issues' });

    const { result, rerender } = renderHook(
      ({ url }) => useGitHubData(url),
      { initialProps: { url: '/api/issues' } },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ source: 'issues' });

    // Change URL
    mockFetchSuccess({ source: 'prs' });
    rerender({ url: '/api/prs' });

    await waitFor(() => {
      expect(result.current.data).toEqual({ source: 'prs' });
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/prs');
  });

  it('handles generic type parameter correctly', async () => {
    interface Repo {
      name: string;
      stars: number;
    }

    mockFetchSuccess({ name: 'dev-pilot', stars: 42 });

    const { result } = renderHook(() => useGitHubData<Repo>('/api/repo'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // TypeScript type check: accessing typed properties
    expect(result.current.data?.name).toBe('dev-pilot');
    expect(result.current.data?.stars).toBe(42);
  });

  it('does not fetch again if URL stays the same after rerender', async () => {
    mockFetchSuccess({ v: 1 });

    const { result, rerender } = renderHook(
      ({ url }) => useGitHubData(url),
      { initialProps: { url: '/api/issues' } },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    rerender({ url: '/api/issues' });

    // Still only one call
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('handles fetch returning empty object', async () => {
    mockFetchSuccess({});

    const { result } = renderHook(() => useGitHubData('/api/empty'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({});
  });

  it('handles fetch returning an array', async () => {
    mockFetchSuccess([1, 2, 3]);

    const { result } = renderHook(() => useGitHubData<number[]>('/api/numbers'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([1, 2, 3]);
  });
});
