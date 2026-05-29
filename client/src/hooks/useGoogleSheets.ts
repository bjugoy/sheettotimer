import { useState, useCallback } from 'react';
import type { ScheduleItem } from '@program-timer/shared';
import { formatTime } from '../utils/timeUtils';
import { apiUrl } from '../lib/api';

export function useGoogleSheets() {
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const fetchSheet = useCallback(async (spreadsheetId: string) => {
    const res = await fetch(apiUrl('/api/sheets/fetch'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

      const res = await fetch(apiUrl('/api/sheets/write'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const res = await fetch(apiUrl('/auth/status'), { credentials: 'include' });
      const data = await res.json();
      return data.authenticated === true;
    } catch {
      return false;
    }
  }, []);

  const startOAuth = useCallback(() => {
    window.location.href = apiUrl('/auth/google');
  }, []);

  return { fetchSheet, syncToSheet, syncing, syncError, checkAuthStatus, startOAuth };
}
