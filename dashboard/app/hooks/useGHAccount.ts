'use client';

import { useState, useCallback, useEffect } from 'react';

interface GHAccount {
  user: string;
  host: string;
  active: boolean;
}

export function useGHAccount() {
  const [accounts, setAccounts] = useState<GHAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/gh-account');
      const json = await res.json();
      setAccounts(json.accounts || []);
    } catch (err) {
      console.error('Failed to fetch GitHub accounts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const switchAccount = useCallback(async (user: string) => {
    setSwitching(true);
    try {
      const res = await fetch('/api/gh-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user }),
      });
      const json = await res.json();
      if (json.accounts) {
        setAccounts(json.accounts);
      }
      return true;
    } catch (err) {
      console.error('Failed to switch GitHub account:', err);
      return false;
    } finally {
      setSwitching(false);
    }
  }, []);

  const activeAccount = accounts.find((a) => a.active)?.user || '';

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return { accounts, activeAccount, loading, switching, switchAccount, refresh: fetchAccounts };
}
