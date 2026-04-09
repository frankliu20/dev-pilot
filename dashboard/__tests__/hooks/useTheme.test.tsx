// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '@/app/hooks/useTheme';

// ── Setup ──────────────────────────────────────────────────────────────
beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────
describe('useTheme', () => {
  it('defaults to "dark" before hydration', () => {
    const { result } = renderHook(() => useTheme());

    // Initial synchronous state is 'dark' (before useEffect runs)
    // After effect runs it will resolve, but the initial value is 'dark'
    expect(result.current.theme).toBe('dark');
  });

  it('reads theme from localStorage on mount', async () => {
    localStorage.setItem('dashboard-theme', 'light');

    const { result } = renderHook(() => useTheme());

    // After the effect hydrates
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('falls back to matchMedia when localStorage is empty and prefers light', () => {
    // Mock matchMedia to return light preference
    const matchMediaMock = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal('matchMedia', matchMediaMock);

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(matchMediaMock).toHaveBeenCalledWith('(prefers-color-scheme: light)');
  });

  it('falls back to dark when matchMedia does not prefer light', () => {
    const matchMediaMock = vi.fn().mockReturnValue({ matches: false });
    vi.stubGlobal('matchMedia', matchMediaMock);

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('setTheme("light") updates state, DOM attribute, and localStorage', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('light');
    });

    expect(result.current.theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('dashboard-theme')).toBe('light');
  });

  it('setTheme("dark") updates state, DOM attribute, and localStorage', () => {
    localStorage.setItem('dashboard-theme', 'light');

    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('dashboard-theme')).toBe('dark');
  });

  it('toggleTheme switches dark → light', () => {
    // Start with dark (default)
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('dark');

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('dashboard-theme')).toBe('light');
  });

  it('toggleTheme switches light → dark', () => {
    localStorage.setItem('dashboard-theme', 'light');

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('light');

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('dashboard-theme')).toBe('dark');
  });

  it('handles localStorage throwing gracefully (private browsing)', () => {
    // Make localStorage.getItem throw
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    // Should not throw — the catch block silently ignores
    const { result } = renderHook(() => useTheme());

    // Falls back to default 'dark'
    expect(result.current.theme).toBe('dark');
  });

  it('localStorage preference takes precedence over matchMedia', () => {
    localStorage.setItem('dashboard-theme', 'dark');
    const matchMediaMock = vi.fn().mockReturnValue({ matches: true }); // prefers light
    vi.stubGlobal('matchMedia', matchMediaMock);

    const { result } = renderHook(() => useTheme());

    // localStorage says 'dark', so dark wins even though matchMedia prefers light
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
