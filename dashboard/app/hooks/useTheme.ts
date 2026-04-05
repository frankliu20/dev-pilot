'use client';

import { useState, useEffect, useCallback } from 'react';

export function useTheme() {
  const [theme, setThemeState] = useState<'dark' | 'light'>('dark');

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('dashboard-theme') as 'dark' | 'light' | null;
      const resolved = stored
        || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
      document.documentElement.setAttribute('data-theme', resolved);
      setThemeState(resolved as 'dark' | 'light');
    } catch { /* ignore */ }
  }, []);

  const setTheme = useCallback((t: 'dark' | 'light') => {
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('dashboard-theme', t);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
