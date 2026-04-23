import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  timeAgo,
  formatDate,
  formatTime,
  formatDuration,
  truncate,
  debounce,
  cn,
} from '@/lib/utils';

// ── timeAgo ──────────────────────────────────────────────────────────────

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-08T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for timestamps less than 60 seconds ago', () => {
    expect(timeAgo('2026-04-08T11:59:30Z')).toBe('just now');
  });

  it('returns "just now" for 0 seconds ago', () => {
    expect(timeAgo('2026-04-08T12:00:00Z')).toBe('just now');
  });

  it('returns minutes ago for timestamps 1–59 minutes ago', () => {
    expect(timeAgo('2026-04-08T11:55:00Z')).toBe('5m ago');
  });

  it('returns "1m ago" at exactly 60 seconds', () => {
    expect(timeAgo('2026-04-08T11:59:00Z')).toBe('1m ago');
  });

  it('returns hours ago for timestamps 1–23 hours ago', () => {
    expect(timeAgo('2026-04-08T09:00:00Z')).toBe('3h ago');
  });

  it('returns "1h ago" at exactly 60 minutes', () => {
    expect(timeAgo('2026-04-08T11:00:00Z')).toBe('1h ago');
  });

  it('returns days ago for timestamps >= 24 hours ago', () => {
    expect(timeAgo('2026-04-06T12:00:00Z')).toBe('2d ago');
  });

  it('returns "1d ago" at exactly 24 hours', () => {
    expect(timeAgo('2026-04-07T12:00:00Z')).toBe('1d ago');
  });
});

// ── formatDate ───────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats a timestamp as en-US localized date', () => {
    const result = formatDate('2026-04-08T10:00:00Z');
    // toLocaleDateString with en-US, month:short, day:numeric, year:numeric
    expect(result).toMatch(/Apr\s+8,\s+2026/);
  });

  it('formats another date correctly', () => {
    const result = formatDate('2025-12-25T00:00:00Z');
    expect(result).toMatch(/Dec\s+25,\s+2025/);
  });
});

// ── formatTime ───────────────────────────────────────────────────────────

describe('formatTime', () => {
  it('formats a timestamp as en-US localized time with 2-digit h/m/s', () => {
    const result = formatTime('2026-04-08T14:30:45Z');
    // The output depends on timezone but should contain digits and colons
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('formats midnight correctly', () => {
    const result = formatTime('2026-04-08T00:00:00Z');
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});

// ── formatDuration ───────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('returns "0s" for 0 ms', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  it('returns "1s" for 1000 ms', () => {
    expect(formatDuration(1000)).toBe('1s');
  });

  it('returns seconds for < 60s', () => {
    expect(formatDuration(59999)).toBe('59s');
  });

  it('returns "1m 0s" at exactly 60000 ms', () => {
    expect(formatDuration(60000)).toBe('1m 0s');
  });

  it('returns minutes and seconds for < 3600s', () => {
    expect(formatDuration(90000)).toBe('1m 30s');
  });

  it('returns "1h 0m" at exactly 3600000 ms', () => {
    expect(formatDuration(3600000)).toBe('1h 0m');
  });

  it('returns hours and minutes for large durations', () => {
    expect(formatDuration(7380000)).toBe('2h 3m');
  });
});

// ── truncate ─────────────────────────────────────────────────────────────

describe('truncate', () => {
  it('returns the string unchanged if shorter than maxLength', () => {
    expect(truncate('hi', 10)).toBe('hi');
  });

  it('returns the string unchanged if exactly maxLength', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates and appends unicode ellipsis when longer than maxLength', () => {
    expect(truncate('hello world', 6)).toBe('hello…');
  });

  it('slices to maxLength - 1 plus ellipsis', () => {
    const result = truncate('abcdef', 4);
    expect(result).toBe('abc…');
    expect(result.length).toBe(4);
  });

  it('handles maxLength=1 by returning just the ellipsis', () => {
    expect(truncate('hello', 1)).toBe('…');
  });

  it('returns empty string as-is', () => {
    expect(truncate('', 5)).toBe('');
  });
});

// ── debounce ─────────────────────────────────────────────────────────────

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls the function after the specified delay', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('resets timer on rapid calls, only calling once after final delay', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);
    debounced();
    vi.advanceTimersByTime(50);
    debounced();
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledOnce();
  });

  it('passes the latest arguments to the function', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('first');
    debounced('second');
    debounced('third');

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith('third');
  });
});

// ── cn ───────────────────────────────────────────────────────────────────

describe('cn', () => {
  it('joins multiple class strings with space', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters out false', () => {
    expect(cn('a', false, 'b')).toBe('a b');
  });

  it('filters out null', () => {
    expect(cn('a', null, 'b')).toBe('a b');
  });

  it('filters out undefined', () => {
    expect(cn('a', undefined, 'b')).toBe('a b');
  });

  it('filters out empty string', () => {
    expect(cn('a', '', 'b')).toBe('a b');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined, '')).toBe('');
  });
});
