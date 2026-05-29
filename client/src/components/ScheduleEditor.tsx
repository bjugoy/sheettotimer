import React, { useState, useRef, useMemo } from 'react';
import { Trash2, GripVertical, RefreshCw, Upload } from 'lucide-react';
import type { ScheduleItem } from '@program-timer/shared';
import { recalculate } from '@program-timer/shared';
import { useScheduleStore } from '../store/scheduleStore';
import { useSessionStore } from '../store/sessionStore';
import { useSocket } from '../hooks/useSocket';
import { formatTime, formatDuration, cn } from '../utils/timeUtils';

// ── Parse helpers ─────────────────────────────────────────────────────────────

function parseDurInput(val: string): number | null {
  const colonFmt = val.match(/^(\d+):(\d{2})$/);
  if (colonFmt) return (parseInt(colonFmt[1]) * 60 + parseInt(colonFmt[2])) * 60_000;
  let totalMins = 0;
  const hMatch = val.match(/(\d+)\s*h/i);
  const mMatch = val.match(/(\d+)\s*m(?:in)?/i);
  if (hMatch) totalMins += parseInt(hMatch[1]) * 60;
  if (mMatch) totalMins += parseInt(mMatch[1]);
  if (totalMins > 0) return totalMins * 60_000;
  const mins = parseFloat(val);
  if (!isNaN(mins) && mins > 0) return mins * 60_000;
  return null;
}

const DRAFT_KEY = 'schedule-editor-draft';

function rechainScheduled(items: ScheduleItem[]): ScheduleItem[] {
  if (items.length === 0) return items;
  let cursor = items[0].scheduledStart;
  return items.map(item => {
    const s = cursor;
    const e = s + item.durationMs;
    cursor = e;
    return { ...item, scheduledStart: s, scheduledEnd: e, projectedStart: s, projectedEnd: e };
  });
}

// ── Cell style helpers (matches ScheduleTablePanel) ───────────────────────────

const thCls = (extra = '') =>
  cn('px-3 py-2 text-left text-[10px] uppercase tracking-wider font-normal',
     'border border-warm-600/60 bg-warm-600 text-warm-300 whitespace-nowrap', extra);

const tdCls = (highlight: boolean, extra = '') =>
  cn('px-3 py-2 text-xs border',
     highlight ? 'bg-warm-200 border-warm-300/60' : 'bg-warm-700 border-warm-600/50',
     extra);

const inputCls = (highlight: boolean, mono = false) =>
  cn('w-full bg-transparent border-b focus:outline-none transition-colors text-xs',
     mono && 'timer-display',
     highlight
       ? 'border-warm-400/40 hover:border-warm-500 focus:border-crimson-600 text-warm-800 placeholder-warm-500'
       : 'border-transparent hover:border-warm-500/50 focus:border-crimson-600/70 text-warm-200 placeholder-warm-600');

// ── Editor row ────────────────────────────────────────────────────────────────

interface RowProps {
  item: ScheduleItem;
  index: number;
  isCurrent: boolean;
  isChanged: boolean;
  canEdit: boolean;
  hasNotes: boolean;
  onUpdate: (id: string, changes: Partial<ScheduleItem>) => void;
  onDelete: (id: string) => void;
  onDragStart: (i: number) => void;
  onDragOver: (i: number) => void;
  onDrop: () => void;
}

function EditorRow({
  item, index, isCurrent, isChanged, canEdit, hasNotes,
  onUpdate, onDelete, onDragStart, onDragOver, onDrop,
}: RowProps) {
  const isDone   = item.status === 'done';
  const isActive = item.status === 'active';
  const hl       = isCurrent && !isDone;

  const [editDur, setEditDur] = useState(String(Math.round(item.durationMs / 60_000)));

  const commitDur = () => {
    const ms = parseDurInput(editDur);
    if (!ms) { setEditDur(String(Math.round(item.durationMs / 60_000))); return; }
    onUpdate(item.id, { durationMs: ms, scheduledEnd: item.scheduledStart + ms });
  };

  const rowBg = hl
    ? 'bg-warm-200 border-warm-300/60'
    : isChanged
      ? 'bg-amber-950/60 border-warm-600/50'
      : 'bg-warm-700 border-warm-600/50';

  const cellCls = (extra = '') =>
    cn('px-3 py-2 text-xs border', rowBg, extra);

  return (
    <tr
      className={cn('group transition-colors', isDone && 'opacity-30')}
      draggable={canEdit}
      onDragStart={() => onDragStart(index)}
      onDragOver={e => { e.preventDefault(); onDragOver(index); }}
      onDrop={onDrop}
    >
      {/* Drag grip */}
      <td className={cn(cellCls(), 'w-7 px-1 text-center')}>
        {canEdit && (
          <GripVertical className="w-3.5 h-3.5 mx-auto cursor-grab active:cursor-grabbing
            text-warm-600 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </td>

      {/* # / status dot */}
      <td className={cn(
        cellCls('text-right pr-2'),
        hl          ? 'border-l-[3px] border-l-crimson-500'
        : isChanged ? 'border-l-[3px] border-l-amber-500'
        :             'border-l border-l-warm-700/50',
      )}>
        {isDone ? (
          <span className="text-warm-400">✓</span>
        ) : isActive ? (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-crimson-500" />
        ) : (
          <span className={hl ? 'text-warm-700' : 'text-warm-400'}>{index + 1}</span>
        )}
      </td>

      {/* Start */}
      <td className={cellCls('w-16')}>
        <span className={cn('text-xs timer-display', hl ? 'text-warm-800' : 'text-warm-300')}>
          {formatTime(item.scheduledStart)}
        </span>
      </td>

      {/* End */}
      <td className={cellCls('w-16')}>
        <span className={cn('text-xs timer-display', hl ? 'text-warm-800' : 'text-warm-300')}>
          {formatTime(item.scheduledEnd)}
        </span>
      </td>

      {/* Title */}
      <td className={cellCls('overflow-hidden')}>
        <span className={cn('block truncate text-xs',
          hl      ? 'text-warm-900 font-semibold'
          : isDone ? 'text-warm-500 line-through decoration-warm-600'
          : 'text-warm-200'
        )}>
          {item.title}
        </span>
      </td>

      {/* Duration — only editable cell */}
      <td className={cellCls('w-16 text-right')}>
        {canEdit && !isDone
          ? <input value={editDur} onChange={e => setEditDur(e.target.value)}
              onBlur={commitDur} onKeyDown={e => e.key === 'Enter' && commitDur()}
              placeholder="min" className={cn(inputCls(hl, true), 'text-right',
                isChanged && !hl && 'text-amber-300')} />
          : <span className={cn('text-xs timer-display',
              hl ? 'text-warm-700' : isChanged ? 'text-amber-300' : 'text-warm-400')}>
              {formatDuration(item.durationMs)}
            </span>
        }
      </td>

      {/* Notes */}
      {hasNotes && (
        <td className={cellCls('overflow-hidden')}>
          <span className={cn('block truncate text-xs', hl ? 'text-warm-700' : 'text-warm-600')}>
            {item.notes ?? ''}
          </span>
        </td>
      )}

      {/* Delete */}
      <td className={cn(cellCls(), 'w-8 px-1 text-center')}>
        {canEdit && item.status === 'not_started' && (
          <button onClick={() => onDelete(item.id)}
            className="text-warm-700 hover:text-crimson-400 transition-colors
              opacity-0 group-hover:opacity-100">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────

interface EditorProps {
  onClose: () => void;
  onSyncToSheets?: () => void;
  hasSheetsConnection: boolean;
  isSyncing?: boolean;
}

export function ScheduleEditor({ onClose, onSyncToSheets, hasSheetsConnection, isSyncing }: EditorProps) {
  const storeItems     = useScheduleStore(s => s.items);
  const currentIndex   = useScheduleStore(s => s.currentIndex);
  const setItemsDraft  = useScheduleStore(s => s.setItemsDraft);
  const isOperator     = useSessionStore(s => s.isOperator);
  const roomCode       = useSessionStore(s => s.roomCode);
  const { sendSchedule } = useSocket();

  const canEdit = isOperator || !roomCode;

  // ── Draft state ─────────────────────────────────────────────────────────────
  const [draftItems, setDraftItems] = useState<ScheduleItem[]>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) return JSON.parse(saved) as ScheduleItem[];
    } catch {}
    return storeItems;
  });
  const [isDirty, setIsDirty] = useState(() => {
    try {
      return !!localStorage.getItem(DRAFT_KEY);
    } catch { return false; }
  });
  const [resetKey, setResetKey] = useState(0);

  const dragFrom = useRef<number | null>(null);

  const hasNotes = draftItems.some(i => i.notes?.trim());

  const updateDraft = (items: ScheduleItem[]) => {
    setDraftItems(items);
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(items)); } catch {}
    setIsDirty(true);
  };

  // IDs whose duration or position changed relative to the live store
  const changedIds = useMemo(() => {
    const origMap  = new Map(storeItems.map(i => [i.id, i]));
    const origOrder = new Map(storeItems.map((i, idx) => [i.id, idx]));
    const result   = new Set<string>();
    draftItems.forEach((item, idx) => {
      const orig = origMap.get(item.id);
      if (!orig) { result.add(item.id); return; }
      if (item.durationMs !== orig.durationMs) result.add(item.id);
      if (origOrder.get(item.id) !== idx)       result.add(item.id);
    });
    return result;
  }, [draftItems, storeItems]);

  // ── Draft mutation helpers ───────────────────────────────────────────────────
  const applyUpdate = (id: string, changes: Partial<ScheduleItem>) => {
    const updated = draftItems.map(i => i.id === id ? { ...i, ...changes } : i);
    updateDraft(recalculate(updated, Date.now()));
  };

  const applyDelete = (id: string) => {
    updateDraft(recalculate(draftItems.filter(i => i.id !== id), Date.now()));
  };

  // ── Commit / discard ─────────────────────────────────────────────────────────
  const handlePush = () => {
    setItemsDraft(draftItems);
    sendSchedule(draftItems);
    setIsDirty(false);
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
  };

  const handleDiscard = () => {
    setDraftItems(storeItems);
    setIsDirty(false);
    setResetKey(k => k + 1);
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
  };

  return (
    <div className="flex flex-col h-full bg-warm-950">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-4 h-9
        border-b border-warm-800/50 bg-warm-900/60">

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-warm-400 tracking-wide uppercase">
            Schedule Editor
          </span>
          {isDirty && (
            <span className="text-[10px] text-amber-300 bg-amber-600/20 border border-amber-600/30
              px-2 py-0.5 rounded-full">
              unsaved changes
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Sync to Sheets */}
          {hasSheetsConnection && canEdit && (
            <button onClick={onSyncToSheets} disabled={isSyncing}
              className="flex items-center gap-1.5 text-[11px] text-warm-500 hover:text-warm-300
                px-2 py-1 bg-warm-900 hover:bg-warm-800 border border-warm-800
                hover:border-warm-700 rounded transition-colors disabled:opacity-50">
              <RefreshCw className={cn('w-3 h-3', isSyncing && 'animate-spin')} />
              Sync
            </button>
          )}

          {/* Discard */}
          {isDirty && (
            <button onClick={handleDiscard}
              className="text-[11px] text-warm-600 hover:text-warm-400 px-2 py-1
                bg-warm-900 hover:bg-warm-800 border border-warm-800 rounded transition-colors">
              Discard
            </button>
          )}

          {/* Push to timer */}
          {isDirty && (
            <button onClick={handlePush}
              className="flex items-center gap-1.5 text-[11px] text-warm-200
                px-2.5 py-1 bg-crimson-800/70 hover:bg-crimson-700/70
                border border-crimson-700/60 rounded transition-colors">
              <Upload className="w-3 h-3" />
              Push to timer
            </button>
          )}

          <button onClick={onClose}
            className="text-[11px] text-warm-700 hover:text-warm-400 px-2 py-1
              hover:bg-warm-900 rounded transition-colors">
            ✕
          </button>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-warm-950">
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '1.75rem' }} />
            <col style={{ width: '2rem' }} />
            <col style={{ width: '4rem' }} />
            <col style={{ width: '4rem' }} />
            <col />
            <col style={{ width: '4.5rem' }} />
            {hasNotes && <col style={{ width: '26%' }} />}
            <col style={{ width: '1.75rem' }} />
          </colgroup>

          <thead className="sticky top-0 z-10">
            <tr>
              <th className={thCls()} />
              <th className={thCls('text-right pr-2')}>#</th>
              <th className={thCls()}>Start</th>
              <th className={thCls()}>End</th>
              <th className={thCls()}>Item</th>
              <th className={thCls('text-right')}>Dur</th>
              {hasNotes && <th className={thCls()}>Notes</th>}
              <th className={thCls()} />
            </tr>
          </thead>

          <tbody key={resetKey}>
            {draftItems.map((item, idx) => (
              <EditorRow
                key={item.id}
                item={item}
                index={idx}
                isCurrent={idx === currentIndex}
                isChanged={changedIds.has(item.id)}
                canEdit={canEdit}
                hasNotes={hasNotes}
                onUpdate={applyUpdate}
                onDelete={applyDelete}
                onDragStart={i => { dragFrom.current = i; }}
                onDragOver={() => {}}
                onDrop={() => {
                  if (dragFrom.current !== null && dragFrom.current !== idx) {
                    const reordered = [...draftItems];
                    const [moved] = reordered.splice(dragFrom.current, 1);
                    reordered.splice(idx, 0, moved);
                    updateDraft(recalculate(rechainScheduled(reordered), Date.now()));
                    dragFrom.current = null;
                  }
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-2 border-t border-warm-800/40 bg-warm-900/40">
        {isDirty ? (
          <p className="text-[10px] text-warm-600">
            <span className="text-amber-400">Draft saved</span> — changes are not yet live.
            Close and reopen to keep editing, or hit
            <span className="text-warm-300"> Push to timer</span> when ready.
          </p>
        ) : (
          <p className="text-[10px] text-warm-700">
            Showing live schedule · Edit duration and push when ready
          </p>
        )}
      </div>
    </div>
  );
}
