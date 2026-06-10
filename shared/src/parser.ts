import type { RawRow, ColumnMapping, ColumnRole, ParseResult, ScheduleItem } from './types';

// ─── Time parsing ────────────────────────────────────────────────────────────

/**
 * Returns true if the raw cell value looks like a recognisable time.
 * Accepts:
 *   - Strings matching H:MM or H:MM AM/PM or H:MM-H:MM (range)
 *   - Numbers in [0, 1) — Excel fractional-day time serials
 * Explicitly rejects:
 *   - Date strings like "5/26/2026", "May 26", arbitrary text
 *   - Excel date serials (integers ≥ 1)
 */
export function isTimeValue(val: unknown): boolean {
  if (val === null || val === undefined || val === '') return false;

  if (typeof val === 'number') {
    // Excel time-only serial: fraction of a day, never a whole date
    const frac = val % 1;
    return frac > 0 && frac < 1;
  }

  const s = String(val).trim();
  // H:MM or H:MM:SS with optional AM/PM  (no slashes — rules out MM/dd/yyyy)
  if (/^\d{1,2}:\d{2}(:\d{2})?(\s*(am|pm))?$/i.test(s)) return true;
  // Time range in one cell: "9:00-10:00" or "9:00 - 10:00 AM"
  if (/^\d{1,2}:\d{2}.*[-–].*\d{1,2}:\d{2}/.test(s)) return true;
  return false;
}

/**
 * Parse a time value (string or Excel numeric serial) into a Unix timestamp (ms).
 * Accepts: "9:00", "09:00", "9:00 AM", "13:30", "1:30 PM", or a numeric serial.
 * Returns NaN on failure.
 */
export function parseTimeString(raw: string | number | null | undefined, baseDate?: Date): number {
  if (raw === null || raw === undefined) return NaN;
  const base = baseDate ? new Date(baseDate) : new Date();
  base.setSeconds(0, 0);

  // Excel fractional-day serial — e.g. 0.375 = 9:00 AM
  if (typeof raw === 'number') {
    const frac = raw % 1; // strip any date portion from datetimes
    if (frac <= 0 && raw !== 0) return NaN; // whole-number = date only
    const totalMin = Math.round(frac * 24 * 60);
    const d = new Date(base);
    d.setHours(Math.floor(totalMin / 60), totalMin % 60, 0, 0);
    return d.getTime();
  }

  const s = raw.trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (!m) return NaN;

  let hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);
  const ampm = m[3]?.toLowerCase();

  if (ampm === 'pm' && hours < 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;

  const d = new Date(base);
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

/**
 * Parse a time range in a single cell, e.g. "9:00-10:00" or "9:00 AM - 10:00 PM"
 * Returns [startMs, endMs] or null.
 */
export function parseTimeRange(raw: string | number | null | undefined, baseDate?: Date): [number, number] | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return null; // numeric serials are never ranges
  const s = raw.trim();
  const parts = s.split(/\s*[-–]\s*/);
  if (parts.length !== 2) return null;
  const start = parseTimeString(parts[0], baseDate);
  const end = parseTimeString(parts[1], baseDate);
  if (isNaN(start) || isNaN(end)) return null;
  return [start, end];
}

/**
 * Parse a duration value into milliseconds.
 * Handles: 45 (number = minutes), "45", "45 min", "45 mins", "45 minutes",
 *          "1:30" (HH:MM), "1h 30m", "1h", "30m"
 */
export function parseDuration(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return NaN;
  if (typeof raw === 'number') {
    // Excel time serial in duration column means HH:MM as a fraction of a day
    if (raw > 0 && raw < 1) return Math.round(raw * 24 * 60) * 60_000;
    // Plain number — treat as minutes
    return raw * 60_000;
  }

  const s = String(raw).trim();
  if (!s) return NaN;

  // HH:MM
  const hhmm = s.match(/^(\d+):(\d{2})$/);
  if (hhmm) return (parseInt(hhmm[1], 10) * 60 + parseInt(hhmm[2], 10)) * 60_000;

  // "30 min" / "30 mins" / "30 minutes" / "30min"
  const minWord = s.match(/^(\d+(?:\.\d+)?)\s*min(?:utes?|s)?$/i);
  if (minWord) return parseFloat(minWord[1]) * 60_000;

  // "1h 30m" / "1h" / "30m" / "1 hour 30 min"
  const hm = s.match(/(?:(\d+(?:\.\d+)?)\s*h(?:ours?)?)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:in(?:utes?)?)?)?/i);
  if (hm && (hm[1] || hm[2])) {
    const h = parseFloat(hm[1] ?? '0');
    const m = parseFloat(hm[2] ?? '0');
    if (h > 0 || m > 0) return (h * 60 + m) * 60_000;
  }

  // Plain number string = minutes
  const n = parseFloat(s);
  if (!isNaN(n) && n > 0) return n * 60_000;

  return NaN;
}

// ─── Header row detection ────────────────────────────────────────────────────

/**
 * Scan the raw AOA for the best header row index.
 *
 * Priority:
 *   1. First row whose cells contain scheduling keywords (time/start/end/duration)
 *   2. First row with actual time data → the row above it is the header
 *   3. First non-empty row (original fallback)
 */
export function detectHeaderRow(aoa: (string | number | null)[][]): number {
  const limit = Math.min(20, aoa.length);

  // Pass 1: keyword scan — "Start Time", "End Time", "Duration" etc.
  for (let i = 0; i < limit; i++) {
    if (aoa[i].some(cell =>
      typeof cell === 'string' && /\b(time|start|end|duration)\b/i.test(cell)
    )) return i;
  }

  // Pass 2: first row with time data → header must be the row above it
  for (let i = 0; i < limit; i++) {
    if (aoa[i].some(cell => isTimeValue(cell))) return Math.max(0, i - 1);
  }

  // Fallback: first non-empty row
  for (let i = 0; i < Math.min(5, aoa.length); i++) {
    if (aoa[i].some(cell => cell !== null && cell !== '')) return i;
  }

  return 0;
}

// ─── Column auto-detection ───────────────────────────────────────────────────

const TIME_HINTS = /start|begin|time|from|at/i;
const END_HINTS = /end|finish|to|until|stop/i;
const DUR_HINTS = /dur|length|min|hour/i;
const TITLE_HINTS = /title|item|topic|session|agenda|name|description|subject|activity|task|program|programme|segment|cue|event|action/i;
const NOTES_HINTS = /note|script|prompter|speaker|copy/i;

function scoreColumn(header: string, sampleValues: (string | number | null | undefined)[]): ColumnRole {
  const h = String(header).toLowerCase();
  const nonEmpty = sampleValues.filter(v => v !== null && v !== undefined && v !== '');

  // Check for time-range cell (e.g. "9:00-10:00") in sample values — trumps everything
  const hasRange = sampleValues.some(v => typeof v === 'string' && /\d{1,2}:\d{2}.*[-–].*\d{1,2}:\d{2}/.test(v));
  if (hasRange) return 'startTime';

  if (NOTES_HINTS.test(h)) return 'notes';
  if (TITLE_HINTS.test(h)) return 'title';
  if (END_HINTS.test(h)) return 'endTime';
  if (DUR_HINTS.test(h)) return 'duration';
  if (TIME_HINTS.test(h)) return 'startTime';

  // Data-driven fallback: majority of non-empty values look like times
  const timeCount = nonEmpty.filter(v => isTimeValue(v)).length;
  if (nonEmpty.length > 0 && timeCount / nonEmpty.length >= 0.5) return 'startTime';

  // Majority are small positive numbers (likely minute durations, not dates)
  const smallNums = nonEmpty.filter(v => typeof v === 'number' && v > 0 && v <= 480);
  if (nonEmpty.length > 0 && smallNums.length / nonEmpty.length >= 0.5) return 'duration';

  return 'ignore';
}

export function detectColumnMapping(headers: string[], rows: RawRow[]): ColumnMapping[] {
  const sample = rows.slice(0, 10);
  const mapping: ColumnMapping[] = [];
  const usedRoles = new Set<ColumnRole>();

  for (const header of headers) {
    const values = sample.map(r => r[header] ?? null);
    let role = scoreColumn(header, values);

    // Avoid assigning the same role twice (except 'ignore' and 'custom')
    if (role !== 'ignore' && role !== 'custom' && usedRoles.has(role)) {
      // If we already have startTime, next time-like column is endTime
      if (role === 'startTime' && !usedRoles.has('endTime')) {
        role = 'endTime';
      } else {
        role = 'ignore';
      }
    }

    if (role !== 'ignore' && role !== 'custom') usedRoles.add(role);
    mapping.push({ sourceKey: header, role });
  }

  return mapping;
}

// ─── Convert parsed rows to ScheduleItems ────────────────────────────────────

let idCounter = 0;
function newId() {
  return `item-${Date.now()}-${++idCounter}`;
}

export function rowsToSchedule(
  rows: RawRow[],
  mapping: ColumnMapping[],
  baseDate?: Date
): { items: ScheduleItem[]; warnings: string[] } {
  const warnings: string[] = [];
  const items: ScheduleItem[] = [];

  const getCol = (role: ColumnRole) => mapping.find(m => m.role === role)?.sourceKey;
  const startKey  = getCol('startTime');
  const endKey    = getCol('endTime');
  const durKey    = getCol('duration');
  const titleKey  = getCol('title');
  const notesKey  = getCol('notes');
  const customKeys = mapping.filter(m => m.role === 'custom').map(m => m.sourceKey);

  let lastEnd: number | undefined;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Gate on time column first — silently skip rows without a real time value
    // (handles date-header rows, section breaks, MM/dd/yyyy cells, etc.)
    const rawTimeVal = startKey ? row[startKey] : undefined;
    const hasTime = startKey
      ? isTimeValue(rawTimeVal)
      : false; // no time column assigned — can't filter, let through

    if (startKey && !hasTime) continue;

    // Only retrieve the title from rows that have a time value
    const rawTitle = titleKey ? String(row[titleKey] ?? '').trim() : '';
    if (!rawTitle) continue;

    // Parse start time / time range
    let startMs: number = NaN;
    let endMs: number = NaN;

    if (startKey) {
      const range = parseTimeRange(rawTimeVal, baseDate);
      if (range) {
        [startMs, endMs] = range;
      } else {
        startMs = parseTimeString(rawTimeVal, baseDate);
      }
    }

    // End time from separate column
    if (isNaN(endMs) && endKey) {
      endMs = parseTimeString(row[endKey], baseDate);
    }

    // Duration
    let durationMs: number = NaN;
    if (!isNaN(startMs) && !isNaN(endMs)) {
      durationMs = endMs - startMs;
    } else if (durKey) {
      durationMs = parseDuration(row[durKey]);
      if (!isNaN(durationMs) && !isNaN(startMs)) {
        endMs = startMs + durationMs;
      }
    }

    // Fallback: derive start from previous item's end
    if (isNaN(startMs) && lastEnd !== undefined) {
      startMs = lastEnd;
      if (!isNaN(durationMs)) {
        endMs = startMs + durationMs;
      }
    }

    if (isNaN(startMs)) {
      warnings.push(`Row ${i + 1} ("${rawTitle}"): could not parse start time — skipped`);
      continue;
    }
    if (isNaN(endMs)) {
      warnings.push(`Row ${i + 1} ("${rawTitle}"): no end time or duration — defaulting to 30 min`);
      endMs = startMs + 30 * 60_000;
      durationMs = 30 * 60_000;
    }

    lastEnd = endMs;
    if (isNaN(durationMs)) durationMs = endMs - startMs;

    const notes = notesKey ? String(row[notesKey] ?? '').trim() : undefined;

    const customFields: Record<string, string> = {};
    for (const key of customKeys) {
      const val = String(row[key] ?? '').trim();
      if (val) customFields[key] = val;
    }

    items.push({
      id: newId(),
      title: rawTitle,
      scheduledStart: startMs,
      scheduledEnd: endMs,
      projectedStart: startMs,
      projectedEnd: endMs,
      durationMs,
      status: 'not_started',
      notes: notes || undefined,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
    });
  }

  return { items, warnings };
}

// ─── Real-time recalculation ─────────────────────────────────────────────────

/**
 * Recalculate projected start/end for all items after index `fromIndex`.
 * If the active item started late, all subsequent items slide forward.
 * whatIfMode: items with whatIfDurationMs set use that value instead.
 */
export function recalculate(items: ScheduleItem[], nowMs: number): ScheduleItem[] {
  const result = [...items];

  // Find the last item that is active or done to anchor the cascade
  let runningEnd: number | undefined;

  for (let i = 0; i < result.length; i++) {
    const item = { ...result[i] };

    if (item.status === 'done') {
      item.projectedEnd = item.actualEnd ?? item.projectedEnd;
      runningEnd = item.projectedEnd;
    } else if (item.status === 'active') {
      item.projectedStart = item.actualStart ?? item.projectedStart;
      const durMs = item.whatIfDurationMs ?? item.durationMs;
      item.projectedEnd = item.projectedStart + durMs;
      runningEnd = item.projectedEnd;
    } else if (item.status === 'not_started') {
      if (runningEnd !== undefined) {
        item.projectedStart = runningEnd;
        const durMs = item.whatIfDurationMs ?? item.durationMs;
        item.projectedEnd = item.projectedStart + durMs;
        runningEnd = item.projectedEnd;
      } else {
        // Before the cascade kicks in, use scheduled times
        const durMs = item.whatIfDurationMs ?? item.durationMs;
        item.projectedEnd = item.projectedStart + durMs;
      }
    }

    result[i] = item;
  }

  return result;
}
