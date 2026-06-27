import { useState, useCallback, useEffect } from 'react';
import type { ScheduleItem } from '@program-timer/shared';
import { formatTime } from '../utils/timeUtils';
import { apiUrl } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useScheduleStore } from '../store/scheduleStore';

export function useGoogleSheets() {
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const getToken = useAuthStore(s => s.getToken);
  const setGoogleAuthenticated = useScheduleStore(s => s.setGoogleAuthenticated);

  const fetchSheet = useCallback(async (spreadsheetId: string) => {
    const token = getToken();
    const gst = localStorage.getItem('gst');
    const res = await fetch(apiUrl('/api/sheets/fetch'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(gst ? { 'X-Google-Session': gst } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ spreadsheetId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error ?? 'Failed to fetch sheet');
    }
    return res.json() as Promise<{ headers: string[]; rows: Record<string, string | number | null>[] }>;
  }, []);

  const syncToSheet = useCallback(async (spreadsheetId: string, items: ScheduleItem[]) => {
    setSyncing(true);
    setSyncError(null);
    try {
      const headers = ['Start Time', 'End Time', 'Duration (min)', 'Title', 'Speaker Notes'];
      const rows = items.map(item => [
        formatTime(item.scheduledStart),
        formatTime(item.scheduledEnd),
        Math.round(item.durationMs / 60_000),
        item.title,
        item.notes ?? '',
      ]);
      const values = [headers, ...rows];

      const token = getToken();
      const gst = localStorage.getItem('gst');
      const res = await fetch(apiUrl('/api/sheets/write'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...(gst ? { 'X-Google-Session': gst } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ spreadsheetId, range: 'A1', values }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Write failed' }));
        throw new Error(err.error ?? 'Write failed');
      }
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }, []);

  const checkAuthStatus = useCallback(async (): Promise<boolean> => {
    try {
      const gst = localStorage.getItem('gst');
      const res = await fetch(apiUrl('/auth/status'), {
        credentials: 'include',
        headers: gst ? { 'X-Google-Session': gst } : {},
      });
      const data = await res.json();
      return data.authenticated === true;
    } catch {
      return false;
    }
  }, []);

  const startOAuth = useCallback(() => {
    // Mobile browsers open window.open() as a new tab, not a closeable popup.
    // Safari ITP also blocks cross-site SameSite=None cookies, so checkAuthStatus()
    // returns false even after successful OAuth. Use a full-page redirect instead:
    // the same tab lands on /app?auth=google which App.tsx trusts directly.
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = apiUrl('/auth/google');
      return;
    }

    const w = 500, h = 640;
    const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
    const top  = Math.round(window.screenY + (window.outerHeight - h) / 2);
    const popup = window.open(apiUrl('/auth/google'), 'google-oauth', `width=${w},height=${h},left=${left},top=${top}`);
    if (!popup) {
      window.location.href = apiUrl('/auth/google');
      return;
    }

    let done = false;
    const finish = () => {
      done = true;
      clearInterval(poll);
      window.removeEventListener('focus', onFocus);
      if (!popup.closed) popup.close();
    };

    const check = () => {
      if (done) return;
      checkAuthStatus().then(authed => {
        if (done) return;
        if (authed) { finish(); setGoogleAuthenticated(true); }
      });
    };

    const onFocus = () => setTimeout(check, 300);
    window.addEventListener('focus', onFocus);
    const poll = setInterval(check, 2000);
    setTimeout(finish, 5 * 60 * 1000);
  }, [checkAuthStatus, setGoogleAuthenticated]);

  const disconnect = useCallback(async (): Promise<void> => {
    const gst = localStorage.getItem('gst') ?? undefined;
    localStorage.removeItem('gst');
    await fetch(apiUrl('/auth/logout'), {
      method: 'POST',
      credentials: 'include',
      headers: gst ? { 'X-Google-Session': gst } : {},
    }).catch(() => {});
  }, []);

  return { fetchSheet, syncToSheet, syncing, syncError, checkAuthStatus, startOAuth, disconnect };
}
