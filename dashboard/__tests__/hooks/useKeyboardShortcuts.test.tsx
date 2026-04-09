// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '@/app/hooks/useKeyboardShortcuts';

// ── Helpers ────────────────────────────────────────────────────────────
function press(key: string, opts: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  document.dispatchEvent(event);
  return event;
}

function pressOnElement(
  element: HTMLElement,
  key: string,
  opts: Partial<KeyboardEventInit> = {},
) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  element.dispatchEvent(event);
  return event;
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────
describe('useKeyboardShortcuts', () => {
  it('fires handler for a single key press', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ k: handler }));

    press('k');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('fires handler for Ctrl+key (ctrlKey)', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ 'Ctrl+k': handler }));

    press('k', { ctrlKey: true });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('fires handler for Meta+key (Cmd on Mac) using Ctrl+ prefix', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ 'Ctrl+k': handler }));

    press('k', { metaKey: true });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('fires handler for Shift+key', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ 'Shift+?': handler }));

    press('?', { shiftKey: true });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('fires handler for Ctrl+Shift+key combination', () => {
    const handler = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({ 'Shift+Ctrl+k': handler }),
    );

    press('k', { ctrlKey: true, shiftKey: true });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not fire when target is an INPUT element', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ k: handler }));

    const input = document.createElement('input');
    document.body.appendChild(input);
    pressOnElement(input, 'k');
    document.body.removeChild(input);

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not fire when target is a TEXTAREA element', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ k: handler }));

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    pressOnElement(textarea, 'k');
    document.body.removeChild(textarea);

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not fire when target is a SELECT element', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ k: handler }));

    const select = document.createElement('select');
    document.body.appendChild(select);
    pressOnElement(select, 'k');
    document.body.removeChild(select);

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not fire when target is contentEditable', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ k: handler }));

    const div = document.createElement('div');
    div.contentEditable = 'true';
    // jsdom doesn't implement isContentEditable, so we define it explicitly
    Object.defineProperty(div, 'isContentEditable', { value: true });
    document.body.appendChild(div);
    pressOnElement(div, 'k');
    document.body.removeChild(div);

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not fire any handler when enabled=false', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ k: handler }, false));

    press('k');

    expect(handler).not.toHaveBeenCalled();
  });

  it('falls back to lowercase key when exact key does not match', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ 'ctrl+k': handler }));

    // The constructed key is "Ctrl+K" (capital K from e.key)
    // It doesn't match 'ctrl+k' exactly, but the fallback tries .toLowerCase()
    press('K', { ctrlKey: true });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('calls preventDefault when a matching handler is found', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ k: handler }));

    const preventDefaultSpy = vi.fn();
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'preventDefault', { value: preventDefaultSpy });
    document.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
  });

  it('does not call preventDefault when no handler matches', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts({ k: handler }));

    const preventDefaultSpy = vi.fn();
    const event = new KeyboardEvent('keydown', {
      key: 'j',
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'preventDefault', { value: preventDefaultSpy });
    document.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not throw when an unmatched key is pressed', () => {
    renderHook(() => useKeyboardShortcuts({ k: vi.fn() }));

    expect(() => press('z')).not.toThrow();
  });

  it('removes event listener on unmount', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({ k: handler }),
    );

    unmount();

    press('k');

    expect(handler).not.toHaveBeenCalled();
  });
});
