/** Format ms as M:SS or H:MM:SS (used for per-item countdown) */
export function formatCountdown(ms: number): string {
  const abs = Math.abs(ms);
  const sign = ms < 0 ? '-' : '';
  const totalSec = Math.floor(abs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${sign}${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

/** Format Unix ms as HH:MM */
export function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Format Unix ms as a live wall-clock string HH:MM:SS */
export function formatClock(ms: number): string {
  const d = new Date(ms);
  return (
    `${String(d.getHours()).padStart(2, '0')}:` +
    `${String(d.getMinutes()).padStart(2, '0')}:` +
    `${String(d.getSeconds()).padStart(2, '0')}`
  );
}

/** Format a duration in ms as "X min" or "Xh Ym" */
export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Returns "green" | "yellow" | "red" based on remaining ms */
export function timerColor(remainingMs: number): 'green' | 'yellow' | 'red' {
  if (remainingMs > 2 * 60_000) return 'green';
  if (remainingMs > 0) return 'yellow';
  return 'red';
}

/** Extract Google Sheets ID from a URL */
export function extractSheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

/** Tiny className joiner (avoids adding clsx as a dep) */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
