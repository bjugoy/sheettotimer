import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, ArrowRight, ChevronUp, ChevronDown } from 'lucide-react';
import type { ParseResult, ColumnMapping, ColumnRole } from '@program-timer/shared';
import { rowsToSchedule, isTimeValue } from '@program-timer/shared';
import { cn } from '../utils/timeUtils';

interface Props {
  parseResult:          ParseResult;
  onConfirm:            (mapping: ColumnMapping[], items: ReturnType<typeof rowsToSchedule>['items']) => void;
  onBack:               () => void;
  canUseCustomColumns?: boolean;
  // Row picker (optional — not available for Google Sheets path)
  headerRowIdx?:        number;
  totalRows?:           number;
  rawPreview?:          (string | number | null)[][];
  onHeaderRowChange?:   (idx: number) => void;
}

const ROLE_LABELS: Record<ColumnRole, string> = {
  startTime: 'Start Time',
  endTime:   'End Time',
  duration:  'Duration',
  title:     'Title / Item',
  notes:     'Notes',
  custom:    'Custom Field',
  ignore:    'Ignore',
};

const ROLE_OPTIONS: ColumnRole[] = ['startTime', 'endTime', 'duration', 'title', 'notes', 'custom', 'ignore'];

const ROLE_STYLE: Record<ColumnRole, { border: string; bg: string; badge: string; text: string }> = {
  startTime: { border: 'border-t-crimson-500',  bg: 'bg-crimson-950/30',  badge: 'bg-crimson-900/60 text-crimson-300 border-crimson-700/50',  text: 'text-crimson-300'  },
  endTime:   { border: 'border-t-amber-500',    bg: 'bg-amber-950/30',    badge: 'bg-amber-900/60 text-amber-300 border-amber-700/50',        text: 'text-amber-300'    },
  duration:  { border: 'border-t-moss-500',     bg: 'bg-moss-950/30',     badge: 'bg-moss-900/60 text-moss-300 border-moss-700/50',           text: 'text-moss-300'     },
  title:     { border: 'border-t-warm-300',     bg: 'bg-warm-800/40',     badge: 'bg-warm-700/60 text-warm-200 border-warm-600/50',           text: 'text-warm-200'     },
  notes:     { border: 'border-t-warm-600',     bg: 'bg-warm-900/30',     badge: 'bg-warm-800/60 text-warm-400 border-warm-700/40',           text: 'text-warm-400'     },
  custom:    { border: 'border-t-amber-300',    bg: 'bg-amber-950/10',    badge: 'bg-amber-900/30 text-amber-200 border-amber-700/30',        text: 'text-amber-200'    },
  ignore:    { border: 'border-t-warm-800',     bg: 'bg-warm-900/20',     badge: 'bg-warm-900/40 text-warm-600 border-warm-800/40',           text: 'text-warm-600'     },
};

type DurationUnit = 'auto' | 'min' | 'h' | 's';

const DURATION_UNIT_LABELS: Record<DurationUnit, string> = {
  auto: 'Auto-detect format',
  min:  'Plain numbers = minutes (e.g. 60)',
  h:    'Plain numbers = hours (e.g. 1.5)',
  s:    'Plain numbers = seconds (e.g. 3600)',
};

function getSamples(rows: ParseResult['rows'], sourceKey: string, role: ColumnRole): string[] {
  const isTimeCol = role === 'startTime' || role === 'endTime';
  const out: string[] = [];
  for (const row of rows) {
    if (out.length >= 4) break;
    const val = row[sourceKey];
    if (val === null || val === undefined || val === '') continue;
    if (isTimeCol && !isTimeValue(val)) continue;
    out.push(String(val));
  }
  return out;
}

function detectTimeRanges(rows: ParseResult['rows'], sourceKey: string): boolean {
  return rows.slice(0, 8).some(row => {
    const val = row[sourceKey];
    return typeof val === 'string' && /\d{1,2}:\d{2}.{0,6}[-–].{0,6}\d{1,2}:\d{2}/.test(val);
  });
}

// ── Row preview table ────────────────────────────────────────────────────────

function RowPreview({
  rawPreview,
  headerRowIdx,
}: {
  rawPreview: (string | number | null)[][];
  headerRowIdx: number;
}) {
  const firstRow  = Math.max(0, headerRowIdx - 2);
  const lastRow   = Math.min(rawPreview.length - 1, headerRowIdx + 3);
  const MAX_COLS  = 5;

  const truncate = (val: string | number | null) => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    return s.length > 16 ? s.slice(0, 14) + '…' : s;
  };

  return (
    <div className="mt-2 rounded-lg overflow-hidden border border-warm-800/50 text-[10px] font-mono select-none">
      {Array.from({ length: lastRow - firstRow + 1 }, (_, i) => {
        const rowIdx   = firstRow + i;
        const row      = rawPreview[rowIdx] ?? [];
        const isHeader = rowIdx === headerRowIdx;
        const isAbove  = rowIdx < headerRowIdx;

        return (
          <div key={rowIdx} className={cn(
            'flex items-stretch border-b border-warm-800/30 last:border-b-0',
            isHeader ? 'bg-crimson-900/30' : isAbove ? 'opacity-35' : 'bg-warm-900/10'
          )}>
            {/* Row number */}
            <div className={cn(
              'px-2 py-1 shrink-0 border-r border-warm-800/30 w-8 text-center leading-4',
              isHeader ? 'text-crimson-400 font-bold' : 'text-warm-700'
            )}>
              {rowIdx + 1}
            </div>
            {/* Cells */}
            {Array.from({ length: MAX_COLS }, (_, ci) => (
              <div key={ci} className={cn(
                'px-2 py-1 border-r border-warm-800/20 w-[110px] truncate leading-4',
                isHeader ? 'text-crimson-200 font-semibold' : isAbove ? 'text-warm-600' : 'text-warm-400'
              )}>
                {truncate(row[ci]) || <span className="text-warm-800">—</span>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function ColumnMapper({
  parseResult,
  onConfirm,
  onBack,
  canUseCustomColumns = false,
  headerRowIdx,
  totalRows,
  rawPreview,
  onHeaderRowChange,
}: Props) {
  const [mapping, setMapping]           = useState<ColumnMapping[]>(parseResult.suggestedMapping);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('auto');

  const hasCustomAssigned = mapping.some(m => m.role === 'custom');

  // Reset mapping when the parse result changes (e.g. user changed header row)
  useEffect(() => {
    setMapping(parseResult.suggestedMapping);
  }, [parseResult.suggestedMapping]);

  const setRole = (sourceKey: string, role: ColumnRole) =>
    setMapping(prev => prev.map(m => m.sourceKey === sourceKey ? { ...m, role } : m));

  const hasTitle    = mapping.some(m => m.role === 'title');
  const hasStart    = mapping.some(m => m.role === 'startTime');
  const hasEnd      = mapping.some(m => m.role === 'endTime');
  const hasDuration = mapping.some(m => m.role === 'duration');
  const startKey    = mapping.find(m => m.role === 'startTime')?.sourceKey;
  const hasRange    = startKey ? detectTimeRanges(parseResult.rows, startKey) : false;
  const hasTimeInfo = hasRange || hasEnd || hasDuration;
  const canConfirm  = hasTitle && hasStart && hasTimeInfo;

  const handleConfirm = () => {
    let rows = parseResult.rows;
    const durKey = mapping.find(m => m.role === 'duration')?.sourceKey;
    if (durKey && durationUnit !== 'auto') {
      const factor = durationUnit === 'h' ? 60 : durationUnit === 's' ? 1 / 60 : 1;
      rows = rows.map(row => {
        const val = row[durKey];
        if (typeof val === 'number') return { ...row, [durKey]: val * factor };
        return row;
      });
    }
    const { items } = rowsToSchedule(rows, mapping);
    if (items.length === 0) {
      alert('No valid schedule items could be parsed. Check that Start Time and Title are assigned correctly.');
      return;
    }
    onConfirm(mapping, items);
  };

  const showPicker = onHeaderRowChange !== undefined
    && headerRowIdx !== undefined
    && totalRows !== undefined
    && totalRows > 0;

  return (
    <div className="space-y-5">

      {/* ── Row picker ────────────────────────────────────────────────────── */}
      {showPicker && (
        <div className="rounded-lg border border-warm-800/50 bg-warm-900/40 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-warm-400 uppercase tracking-wider">
                Header row
              </p>
              <p className="text-[10px] text-warm-600 mt-0.5">
                Row {headerRowIdx! + 1} of {totalRows} — data starts on row {headerRowIdx! + 2}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onHeaderRowChange!(headerRowIdx! - 1)}
                disabled={headerRowIdx! <= 0}
                className="w-7 h-7 flex items-center justify-center rounded border border-warm-700/50
                  text-warm-400 hover:text-warm-200 hover:border-warm-600 transition-colors
                  disabled:opacity-30 disabled:cursor-not-allowed bg-warm-800/40">
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onHeaderRowChange!(headerRowIdx! + 1)}
                disabled={headerRowIdx! >= totalRows! - 2}
                className="w-7 h-7 flex items-center justify-center rounded border border-warm-700/50
                  text-warm-400 hover:text-warm-200 hover:border-warm-600 transition-colors
                  disabled:opacity-30 disabled:cursor-not-allowed bg-warm-800/40">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {rawPreview && rawPreview.length > 0 && (
            <RowPreview rawPreview={rawPreview} headerRowIdx={headerRowIdx!} />
          )}
        </div>
      )}

      {/* Warnings */}
      {parseResult.warnings.map((w, i) => (
        <div key={i} className="flex items-start gap-2 text-amber-300 bg-amber-950/20
          border border-amber-800/40 rounded-lg px-3 py-2.5 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {w}
        </div>
      ))}

      <p className="text-xs text-warm-500">
        Columns from your sheet — confirm or adjust each role using the dropdowns.
      </p>

      {/* ── Horizontal column cards ────────────────────────────────────────── */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-flex gap-2 min-w-full">
          {mapping.map(({ sourceKey, role }) => {
            const style   = ROLE_STYLE[role];
            const samples = getSamples(parseResult.rows, sourceKey, role);
            const isAutoDetected = (role === 'startTime' || role === 'endTime') &&
              parseResult.suggestedMapping.find(m => m.sourceKey === sourceKey)?.role === role;
            const isDurCol = role === 'duration';

            return (
              <div key={sourceKey}
                className={cn(
                  'flex flex-col rounded-xl border-t-[3px] border border-warm-800/50 overflow-hidden',
                  'min-w-[140px] flex-shrink-0',
                  style.border, style.bg
                )}>

                <div className="px-3 py-2.5 border-b border-warm-800/40">
                  <p className="text-xs font-semibold text-warm-200 truncate" title={sourceKey}>
                    {sourceKey}
                  </p>
                  {isAutoDetected && (
                    <span className="text-[9px] text-warm-500">✓ auto-detected</span>
                  )}
                </div>

                <div className="px-3 py-2 border-b border-warm-800/30">
                  <select
                    value={role}
                    onChange={e => setRole(sourceKey, e.target.value as ColumnRole)}
                    className={cn(
                      'w-full text-[11px] font-medium bg-warm-900/80 border border-warm-700/50',
                      'rounded-md px-2 py-1.5 focus:outline-none focus:border-crimson-700/60',
                      'cursor-pointer transition-colors',
                      style.text
                    )}>
                    {ROLE_OPTIONS.map(r => (
                      <option key={r} value={r} className="text-warm-200 bg-warm-900">
                        {r === 'custom'
                          ? `Custom Field${!canUseCustomColumns ? ' (Pro+)' : ''}`
                          : ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  {role === 'custom' && (
                    <p className="text-[9px] mt-1 leading-tight
                      text-amber-400/80">
                      {canUseCustomColumns
                        ? `Shown as "${sourceKey}"`
                        : 'Requires Pro or higher to display'}
                    </p>
                  )}
                </div>

                {isDurCol && (
                  <div className="px-3 py-2 border-b border-warm-800/30 bg-moss-950/20">
                    <p className="text-[9px] text-moss-500 uppercase tracking-wider mb-1">Number format</p>
                    <select
                      value={durationUnit}
                      onChange={e => setDurationUnit(e.target.value as DurationUnit)}
                      className="w-full text-[10px] text-moss-300 bg-warm-900/80 border border-moss-800/40
                        rounded px-2 py-1 focus:outline-none cursor-pointer">
                      {(Object.keys(DURATION_UNIT_LABELS) as DurationUnit[]).map(u => (
                        <option key={u} value={u} className="bg-warm-900">{DURATION_UNIT_LABELS[u]}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex-1 px-3 py-2 space-y-1">
                  {samples.length > 0 ? samples.map((v, i) => (
                    <p key={i} className={cn(
                      'text-[11px] truncate font-mono',
                      role === 'ignore' ? 'text-warm-700' : 'text-warm-400'
                    )}>
                      {String(v)}
                    </p>
                  )) : (
                    <p className="text-[11px] text-warm-700 italic">empty</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Validation feedback ────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        {!hasTitle && (
          <p className="text-xs text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Assign one column as "Title / Item"
          </p>
        )}
        {hasStart && !hasTimeInfo && (
          <p className="text-xs text-crimson-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Start Time needs a partner — assign an End Time or Duration column,
            or use a single column with ranges like <span className="font-mono ml-0.5">9:00–10:00</span>
          </p>
        )}
        {!hasStart && (
          <p className="text-xs text-crimson-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Assign at least one time column (Start Time or a range column)
          </p>
        )}
        {hasCustomAssigned && !canUseCustomColumns && (
          <p className="text-xs text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Custom fields require Pro or higher — upgrade to see them in the timer view.
          </p>
        )}
        {hasCustomAssigned && canUseCustomColumns && (
          <p className="text-xs text-amber-200 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
            Custom fields will appear in the timer panel for each item.
          </p>
        )}
        {canConfirm && (
          <p className="text-xs text-moss-400 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {hasRange
              ? 'Time ranges detected — start and end will be extracted from one column'
              : hasEnd
                ? 'Start Time + End Time columns assigned'
                : 'Start Time + Duration columns assigned'}
          </p>
        )}
      </div>

      {/* ── Actions ────────────────────────────────────────────────────────── */}
      <div className="flex gap-3 pt-1">
        <button onClick={onBack}
          className="px-4 py-2 bg-warm-800/60 hover:bg-warm-700/60 border border-warm-700/50
            rounded-lg text-sm text-warm-300 transition-colors">
          ← Back
        </button>
        <button onClick={handleConfirm} disabled={!canConfirm}
          className="flex items-center gap-2 px-5 py-2 bg-crimson-800/60 hover:bg-crimson-700/60
            disabled:opacity-40 disabled:cursor-not-allowed border border-crimson-700/50
            rounded-lg text-sm font-semibold text-warm-100 transition-colors">
          <CheckCircle className="w-4 h-4" />
          Confirm &amp; Load
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
