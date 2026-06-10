import React from 'react';
import { useScheduleStore } from '../store/scheduleStore';
import { formatTime, formatDuration, cn, inlineTitle } from '../utils/timeUtils';

interface Props { nowMs: number }

export function ScheduleTablePanel({ nowMs }: Props) {
  const items        = useScheduleStore(s => s.items);
  const currentIndex = useScheduleStore(s => s.currentIndex);

  const rows     = items.filter(item => !isNaN(item.scheduledStart));
  const hasNotes = rows.some(item => item.notes?.trim());

  // Collect all unique custom field keys across all items (preserving insertion order)
  const customKeys = [...new Set(
    rows.flatMap(item => Object.keys(item.customFields ?? {}))
  )];

  // ── Cell builders ─────────────────────────────────────────────────────────
  const th = (extra = '') =>
    cn('px-3 py-2 text-left text-[10px] uppercase tracking-wider font-normal',
       'border border-warm-600/60 bg-warm-600 text-warm-300 whitespace-nowrap', extra);

  const tdBase = (highlight: boolean, extra = '') =>
    cn('px-3 py-2 text-xs border',
       highlight
         ? 'bg-warm-200 border-warm-300/60'
         : 'bg-warm-700 border-warm-600/50',
       extra);

  return (
    <div className="w-full bg-warm-700">
      <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '2rem' }} />
          <col style={{ width: '3.8rem' }} />
          <col style={{ width: '7rem' }} />
          <col />
          <col style={{ width: '3.5rem' }} />
          {hasNotes && <col style={{ width: '22%' }} />}
          {customKeys.map(k => <col key={k} style={{ width: '14%' }} />)}
        </colgroup>

        <thead className="sticky top-0 z-10">
          <tr>
            <th className={th('text-right pr-2')}>#</th>
            <th className={th()}>Start</th>
            <th className={th()}>End</th>
            <th className={th()}>Item</th>
            <th className={th('text-right')}>Dur</th>
            {hasNotes && <th className={th()}>Notes</th>}
            {customKeys.map(k => <th key={k} className={th()}>{k}</th>)}
          </tr>
        </thead>

        <tbody>
          {rows.map((item, idx) => {
            const isCurrent  = idx === currentIndex;
            const isDone     = item.status === 'done';
            const isActive   = item.status === 'active';
            const isOvertime = isActive && nowMs > item.projectedEnd;
            const hl         = isCurrent && !isDone;

            const endDrift    = item.projectedEnd - item.scheduledEnd;
            const showRealEnd = !isDone && Math.abs(endDrift) > 60_000;

            return (
              <tr key={item.id} className={cn('transition-colors', isDone && 'opacity-30')}>

                <td className={cn(
                  tdBase(hl, 'text-right pr-2'),
                  hl ? 'border-l-[3px] border-l-crimson-500' : 'border-l border-l-warm-700/50'
                )}>
                  {isDone ? (
                    <span className="text-warm-400">✓</span>
                  ) : isActive ? (
                    <span className={cn(
                      'inline-block w-1.5 h-1.5 rounded-full',
                      isOvertime ? 'bg-crimson-400 animate-pulse-fast' : 'bg-crimson-500'
                    )} />
                  ) : (
                    <span className={hl ? 'text-warm-700' : 'text-warm-400'}>{idx + 1}</span>
                  )}
                </td>

                <td className={cn(tdBase(hl, 'timer-display'), hl ? 'text-warm-800' : 'text-warm-300')}>
                  {formatTime(item.scheduledStart)}
                </td>

                <td className={tdBase(hl, 'timer-display')}>
                  <span className={hl ? 'text-warm-800' : 'text-warm-300'}>
                    {formatTime(item.scheduledEnd)}
                  </span>
                  {showRealEnd && (
                    <span className={cn(
                      'block text-[10px] mt-0.5 timer-display',
                      hl
                        ? (endDrift > 0 ? 'text-crimson-700' : 'text-moss-600')
                        : (endDrift > 0 ? 'text-crimson-400' : 'text-moss-400')
                    )}>
                      → {formatTime(item.projectedEnd)}
                    </span>
                  )}
                </td>

                <td className={cn(tdBase(hl, 'overflow-hidden'))} title={item.title}>
                  <span className={cn(
                    'block truncate',
                    hl      ? 'text-warm-900 font-semibold'
                    : isDone ? 'text-warm-500 line-through decoration-warm-600'
                    : 'text-warm-200'
                  )}>
                    {inlineTitle(item.title)}
                  </span>
                </td>

                <td className={cn(tdBase(hl, 'text-right timer-display'), hl ? 'text-warm-700' : 'text-warm-400')}>
                  {formatDuration(item.durationMs)}
                </td>

                {hasNotes && (
                  <td className={tdBase(hl, 'overflow-hidden')}>
                    <span className={cn(
                      'block truncate text-[11px]',
                      hl ? 'text-warm-700' : 'text-warm-400'
                    )}>
                      {item.notes ?? ''}
                    </span>
                  </td>
                )}

                {customKeys.map(k => (
                  <td key={k} className={tdBase(hl, 'overflow-hidden')}>
                    <span className={cn(
                      'block truncate text-[11px]',
                      hl ? 'text-warm-700' : 'text-warm-400'
                    )}>
                      {item.customFields?.[k] ?? ''}
                    </span>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
