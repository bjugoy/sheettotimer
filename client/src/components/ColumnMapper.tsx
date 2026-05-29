import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import type { ParseResult, ColumnMapping, ColumnRole } from '@program-timer/shared';
import { rowsToSchedule } from '@program-timer/shared';
import { cn } from '../utils/timeUtils';

interface Props {
  parseResult: ParseResult;
  onConfirm: (mapping: ColumnMapping[], items: ReturnType<typeof rowsToSchedule>['items']) => void;
  onBack: () => void;
}

const ROLE_LABELS: Record<ColumnRole, string> = {
  startTime: 'Start Time',
  endTime:   'End Time',
  duration:  'Duration',
  title:     'Title / Item',
  notes:     'Notes',
  ignore:    'Ignore',
};

const ROLE_OPTIONS: ColumnRole[] = ['startTime', 'endTime', 'duration', 'title', 'notes', 'ignore'];

// Top-border accent + background for each role
const ROLE_STYLE: Record<ColumnRole, { border: string; bg: string; badge: string; text: string }> = {
  startTime: { border: 'border-t-crimson-500',  bg: 'bg-crimson-950/30',  badge: 'bg-crimson-900/60 text-crimson-300 border-crimson-700/50',  text: 'text-crimson-300' },
  endTime:   { border: 'border-t-amber-500',    bg: 'bg-amber-950/30',    badge: 'bg-amber-900/60 text-amber-300 border-amber-700/50',        text: 'text-amber-300' },
  duration:  { border: 'border-t-moss-500',     bg: 'bg-moss-950/30',     badge: 'bg-moss-900/60 text-moss-300 border-moss-700/50',           text: 'text-moss-300' },
  title:     { border: 'border-t-warm-300',     bg: 'bg-warm-800/40',     badge: 'bg-warm-700/60 text-warm-200 border-warm-600/50',           text: 'text-warm-200' },
  notes:     { border: 'border-t-warm-600',     bg: 'bg-warm-900/30',     badge: 'bg-warm-800/60 text-warm-400 border-warm-700/40',           text: 'text-warm-400' },
  ignore:    { border: 'border-t-warm-800',     bg: 'bg-warm-900/20',     badge: 'bg-warm-900/40 text-warm-700 border-warm-800/40',           text: 'text-warm-700' },
};

export function ColumnMapper({ parseResult, onConfirm, onBack }: Props) {
  const [mapping, setMapping] = useState<ColumnMapping[]>(parseResult.suggestedMapping);

  const setRole = (sourceKey: string, role: ColumnRole) =>
    setMapping(prev => prev.map(m => m.sourceKey === sourceKey ? { ...m, role } : m));

  const sampleRows = parseResult.rows.slice(0, 4);

  const handleConfirm = () => {
    const { items, warnings } = rowsToSchedule(parseResult.rows, mapping);
    if (items.length === 0) {
      alert('No valid schedule items could be parsed. Check that Start Time and Title are assigned correctly.');
      return;
    }
    onConfirm(mapping, items);
  };

  const hasTitle = mapping.some(m => m.role === 'title');
  const hasStart = mapping.some(m => m.role === 'startTime');
  const canConfirm = hasTitle && hasStart;

  return (
    <div className="space-y-5">

      {/* Warnings */}
      {parseResult.warnings.map((w, i) => (
        <div key={i} className="flex items-start gap-2 text-amber-300 bg-amber-950/20
          border border-amber-800/40 rounded-lg px-3 py-2.5 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {w}
        </div>
      ))}

      {/* Instruction */}
      <p className="text-xs text-warm-500">
        Columns detected in your sheet are shown below. Confirm or adjust each role —
        at minimum assign a <span className="text-amber-300">Title</span> and a <span className="text-crimson-300">Start Time</span>.
      </p>

      {/* ── Spreadsheet-style column view ─────────────────────────────────── */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-flex gap-2 min-w-full">
          {mapping.map(({ sourceKey, role }) => {
            const style   = ROLE_STYLE[role];
            const samples = sampleRows
              .map(r => r[sourceKey])
              .filter(v => v !== null && v !== undefined && v !== '')
              .slice(0, 4);

            return (
              <div key={sourceKey}
                className={cn(
                  'flex flex-col rounded-xl border-t-[3px] border border-warm-800/50 overflow-hidden',
                  'min-w-[130px] flex-shrink-0',
                  style.border, style.bg
                )}>

                {/* Column header */}
                <div className="px-3 py-2.5 border-b border-warm-800/40">
                  <p className="text-xs font-semibold text-warm-200 truncate" title={sourceKey}>
                    {sourceKey}
                  </p>
                </div>

                {/* Role selector */}
                <div className="px-3 py-2 border-b border-warm-800/30">
                  <select
                    value={role}
                    onChange={e => setRole(sourceKey, e.target.value as ColumnRole)}
                    className={cn(
                      'w-full text-[11px] font-medium bg-warm-900/80 border border-warm-700/50',
                      'rounded-md px-2 py-1.5 focus:outline-none focus:border-crimson-700/60',
                      'cursor-pointer transition-colors appearance-none',
                      style.text
                    )}
                    style={{ backgroundImage: 'none' }}
                  >
                    {ROLE_OPTIONS.map(r => (
                      <option key={r} value={r} className="text-warm-200 bg-warm-900">
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>

                  {role !== 'ignore' && (
                    <span className={cn(
                      'inline-block mt-1.5 text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wide',
                      style.badge
                    )}>
                      {role === 'startTime' || role === 'endTime' ? '✓ auto-detected' : ROLE_LABELS[role]}
                    </span>
                  )}
                </div>

                {/* Sample values */}
                <div className="flex-1 px-3 py-2 space-y-1">
                  {samples.length > 0 ? samples.map((v, i) => (
                    <p key={i} className={cn(
                      'text-[11px] truncate',
                      role === 'ignore' ? 'text-warm-800' : 'text-warm-500'
                    )}>
                      {String(v)}
                    </p>
                  )) : (
                    <p className="text-[11px] text-warm-800 italic">empty</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Validation */}
      {!canConfirm && (
        <div className="flex flex-wrap gap-2">
          {!hasTitle && (
            <p className="text-xs text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Assign one column as "Title / Item"
            </p>
          )}
          {!hasStart && (
            <p className="text-xs text-crimson-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Assign one column as "Start Time"
            </p>
          )}
        </div>
      )}

      {/* Actions */}
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
