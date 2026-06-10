import React, { useState } from 'react';
import { SkipForward, SkipBack, Clock, Timer, Play, RotateCcw, Square } from 'lucide-react';
import { useScheduleStore } from '../store/scheduleStore';
import { useSessionStore } from '../store/sessionStore';
import { useSocket } from '../hooks/useSocket';
import { useTimer } from '../hooks/useTimer';
import { formatCountdown, formatClock, formatTime, formatDuration, cn, inlineTitle } from '../utils/timeUtils';
import { ScheduleTablePanel } from './ScheduleTablePanel';
import { AnnouncementBanner } from './AnnouncementBanner';

type TimerMode = 'countdown' | 'clock';

const TIMER_TEXT: Record<'green' | 'yellow' | 'red', string> = {
  green:  'text-crimson-200',
  yellow: 'text-amber-300',
  red:    'text-crimson-100',
};

interface Props {
  onOpenTeleprompter?: () => void;
  onOpenEditor?: () => void;
}

export function TimerView({ onOpenTeleprompter, onOpenEditor }: Props) {
  const items         = useScheduleStore(s => s.items);
  const currentIndex  = useScheduleStore(s => s.currentIndex);
  const markStarted     = useScheduleStore(s => s.markStarted);
  const updateItem      = useScheduleStore(s => s.updateItem);
  const advanceToNext   = useScheduleStore(s => s.advanceToNext);
  const revertToPrev    = useScheduleStore(s => s.revertToPrev);
  const shiftToNow      = useScheduleStore(s => s.shiftToNow);
  const resetToOriginal = useScheduleStore(s => s.resetToOriginal);
  const pause           = useScheduleStore(s => s.pause);
  const resume          = useScheduleStore(s => s.resume);
  const isPaused        = useScheduleStore(s => s.isPaused);
  const isOperator    = useSessionStore(s => s.isOperator);
  const roomCode      = useSessionStore(s => s.roomCode);
  const { advanceItem, revertItem, updateItem: socketUpdateItem, sendSchedule } = useSocket();
  const { remainingMs, color, isOvertime, nowMs } = useTimer();

  const [timerMode, setTimerMode] = useState<TimerMode>('countdown');

  const current = items[currentIndex];

  const canControl   = isOperator || !roomCode;
  const eventStarted = items.some(i => i.status === 'active' || i.status === 'done');
  const isActive     = current?.status === 'active';
  const lastItem     = items[items.length - 1];

  // ── Start handlers ─────────────────────────────────────────────────────────
  const startNow = () => {
    if (!current) return;
    const now = Date.now();
    markStarted(current.id);
    socketUpdateItem(current.id, { status: 'active', actualStart: now });
  };

  // ── Advance / revert — local in solo mode, socket in room ─────────────────
  const handleAdvance = () => {
    if (!roomCode) { advanceToNext(); } else { advanceItem(); }
  };

  const handleRevert = () => {
    if (!roomCode) { revertToPrev(); } else { revertItem(); }
  };

  const handlePause = () => {
    pause();
    if (roomCode) sendSchedule(useScheduleStore.getState().items);
  };

  const handleResume = () => {
    resume(); // zustand set() is synchronous — store is updated immediately
    if (roomCode) sendSchedule(useScheduleStore.getState().items);
  };

  // ── Timer display ──────────────────────────────────────────────────────────
  const timerDisplay = (() => {
    if (timerMode === 'clock') return formatClock(nowMs);
    if (!eventStarted)         return '--:--';
    return formatCountdown(Math.abs(remainingMs));
  })();

  const timerTextColor = timerMode === 'clock'
    ? 'text-warm-300'
    : !eventStarted
      ? 'text-warm-600'
      : TIMER_TEXT[color];

  if (!current) {
    return (
      <div className="flex items-center justify-center h-full text-warm-600 text-sm">
        No schedule loaded.
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden bg-warm-950">
      <AnnouncementBanner />

      {/* ════════════════════════════════════════════════════════════
          LEFT — timer panel
      ════════════════════════════════════════════════════════════ */}
      <div className="w-[320px] shrink-0 flex flex-col border-r border-warm-800/50 bg-warm-950">

        {/* Status chip */}
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <span className={cn(
            'text-[10px] uppercase tracking-[0.2em] font-medium',
            isPaused  ? 'text-warm-500'
            : isActive ? 'text-crimson-300'
            : 'text-warm-600'
          )}>
            {isPaused ? '⏸ paused' : isActive ? '● live' : eventStarted ? 'next up' : 'ready'}
          </span>
          {lastItem && (
            <span className="text-[10px] text-warm-700 timer-display">
              ends <span className="text-warm-500">{formatTime(lastItem.projectedEnd)}</span>
            </span>
          )}
        </div>

        {/* Current item name */}
        <div className="px-5 pt-3 pb-1">
          <h2 className="text-warm-100 font-semibold leading-tight text-base">
            {inlineTitle(current.title)}
          </h2>
          <p className="text-[11px] text-warm-600 mt-1 timer-display">
            {formatTime(current.scheduledStart)}–{formatTime(current.scheduledEnd)}
            <span className="mx-1.5 opacity-40">·</span>
            {formatDuration(current.durationMs)}
            {current.actualStart && current.actualStart > current.scheduledStart + 30_000 && (
              <span className="ml-2 text-crimson-400">
                +{formatDuration(current.actualStart - current.scheduledStart)} late
              </span>
            )}
          </p>
        </div>

        {/* Notes — always visible when present */}
        {current.notes && (
          <div className="px-5 pb-1">
            <p className="text-[11px] text-warm-400 leading-relaxed border-l-2 border-warm-700/60 pl-2">
              {current.notes}
            </p>
          </div>
        )}

        {/* Custom fields — always visible when present */}
        {current.customFields && Object.keys(current.customFields).length > 0 && (
          <div className="px-5 pb-1 space-y-0.5">
            {Object.entries(current.customFields).map(([key, val]) => (
              <div key={key} className="flex items-baseline gap-1.5">
                <span className="text-[9px] text-warm-600 uppercase tracking-wide shrink-0">{key}:</span>
                <span className="text-[11px] text-warm-400 leading-tight">{val}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Big timer ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center px-5 gap-1">
          {isOvertime && timerMode === 'countdown' && eventStarted && (
            <span className="text-[9px] tracking-[0.25em] uppercase text-crimson-400 font-mono animate-pulse-fast">
              overtime
            </span>
          )}
          <span
            className={cn(
              'timer-display font-mono font-bold select-none transition-colors duration-300',
              isPaused ? 'text-warm-600' : timerTextColor
            )}
            style={{ fontSize: 'clamp(2.6rem, 7vw, 3.8rem)', lineHeight: 1 }}
          >
            {timerDisplay}
          </span>
        </div>

        {/* ── Start button (pre-event only) ───────────────────────────── */}
        {!eventStarted && canControl && (
          <div className="px-4 pb-2">
            <button
              onClick={startNow}
              className="w-full flex items-center justify-between px-4 py-3
                bg-warm-900 hover:bg-warm-800 border border-warm-800
                hover:border-crimson-800 rounded-lg transition-all"
            >
              <div className="flex items-center gap-2">
                <Play className="w-3.5 h-3.5 text-crimson-400" />
                <span className="text-sm text-warm-300">Start now</span>
              </div>
              <span className="text-[11px] text-warm-600 timer-display">{formatTime(nowMs)}</span>
            </button>
          </div>
        )}

        {/* ── Advance + revert + pause (running + can control) ───────── */}
        {eventStarted && canControl && (
          <div className="px-4 pb-4 flex gap-2">
            <button
              onClick={handleRevert}
              title="Revert to previous item"
              className="flex items-center justify-center px-3 py-2.5
                bg-warm-900 hover:bg-warm-800 border border-warm-800
                hover:border-warm-700 rounded-lg transition-all"
            >
              <SkipBack className="w-3.5 h-3.5 text-warm-500" />
            </button>
            {/* Pause / Resume */}
            <button
              onClick={isPaused ? handleResume : handlePause}
              title={isPaused ? 'Resume' : 'Pause'}
              className={cn(
                'flex items-center justify-center px-3 py-2.5 rounded-lg transition-all border',
                isPaused
                  ? 'bg-crimson-900/40 border-crimson-700/60 text-crimson-300 hover:bg-crimson-800/50'
                  : 'bg-warm-900 hover:bg-warm-800 border-warm-800 hover:border-warm-700 text-warm-500 hover:text-warm-300'
              )}
            >
              {isPaused
                ? <Play className="w-3.5 h-3.5" />
                : <Square className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleAdvance}
              className="flex-1 flex items-center justify-center gap-2 py-2.5
                bg-warm-900 hover:bg-warm-800 border border-warm-800
                hover:border-crimson-800/70 rounded-lg text-xs text-warm-400
                hover:text-warm-200 transition-all"
            >
              <SkipForward className="w-3.5 h-3.5" />
              Mark done &amp; advance
            </button>
          </div>
        )}

        {/* ── Schedule time adjustment (always visible to operators) ───── */}
        {canControl && (
          <div className="px-4 pb-3 flex gap-1.5">
            <button
              onClick={shiftToNow}
              className="flex-1 flex items-center justify-center gap-1.5 py-2
                bg-warm-900 hover:bg-warm-800 border border-warm-800
                hover:border-warm-700 rounded-lg transition-all"
            >
              <Timer className="w-3 h-3 text-warm-600" />
              <span className="text-[11px] text-warm-500">From now</span>
            </button>
            <button
              onClick={resetToOriginal}
              className="flex-1 flex items-center justify-center gap-1.5 py-2
                bg-warm-900 hover:bg-warm-800 border border-warm-800
                hover:border-warm-700 rounded-lg transition-all"
            >
              <RotateCcw className="w-3 h-3 text-warm-600" />
              <span className="text-[11px] text-warm-500">Original</span>
            </button>
          </div>
        )}

        {/* ── View mode toggle ─────────────────────────────────────────── */}
        <div className="px-4 pb-4 flex gap-1.5">
          {(['countdown', 'clock'] as TimerMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setTimerMode(mode)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] transition-colors border',
                timerMode === mode
                  ? 'bg-warm-800 text-warm-200 border-warm-700/70'
                  : 'text-warm-700 border-transparent hover:text-warm-500'
              )}
            >
              {mode === 'countdown' ? <Timer className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {mode === 'countdown' ? 'Countdown' : 'Clock'}
            </button>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          RIGHT — schedule table (top) + up next (bottom)
      ════════════════════════════════════════════════════════════ */}
      <div className="flex-1 min-w-0 flex flex-col bg-warm-950">

        {/* ── Schedule table ────────────────────────────────────────── */}
        <div className="flex-[3] min-h-0 overflow-auto border-b-2 border-warm-800/60">
          <ScheduleTablePanel nowMs={nowMs} />
        </div>

        {/* ── Up next label ─────────────────────────────────────────── */}
        <div className="shrink-0 px-4 py-1 bg-warm-900/80 border-b border-warm-800/40">
          <span className="text-[10px] uppercase tracking-[0.15em] text-warm-600">
            Up next
          </span>
        </div>

        {/* ── Up next list ──────────────────────────────────────────── */}
        <div className="flex-[2] min-h-0 overflow-y-auto bg-warm-950">
          <UpNextList items={items} currentIndex={currentIndex} nowMs={nowMs} />
        </div>
      </div>
    </div>
  );
}

// ─── Up-next ─────────────────────────────────────────────────────────────────

interface UpNextProps {
  items: ReturnType<typeof useScheduleStore.getState>['items'];
  currentIndex: number;
  nowMs: number;
}

function UpNextList({ items, currentIndex, nowMs }: UpNextProps) {
  const upcoming = items.slice(currentIndex + 1);
  if (upcoming.length === 0) {
    return <p className="px-5 py-4 text-xs text-warm-700 italic">Last item.</p>;
  }
  return (
    <div className="divide-y divide-warm-800/20">
      {upcoming.map((item, i) => {
        const isNext = i === 0;
        const isLate = item.projectedStart > item.scheduledStart + 60_000;
        const startsInMs = item.projectedStart - nowMs;
        return (
          <div key={item.id}
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 border-l-2 transition-colors',
              isNext
                ? 'border-l-crimson-700 bg-crimson-950/30'
                : 'border-l-transparent hover:bg-warm-900/30'
            )}>
            <span className="shrink-0 text-[11px] timer-display text-warm-500 w-9">
              {formatTime(item.projectedStart)}
            </span>
            <span className={cn(
              'flex-1 text-xs truncate',
              isNext ? 'text-warm-200' : 'text-warm-500'
            )}>
              {inlineTitle(item.title)}
            </span>
            <span className="shrink-0 text-[11px] text-warm-700 timer-display">
              {formatDuration(item.durationMs)}
            </span>
            {isLate ? (
              <span className="shrink-0 text-[10px] text-crimson-400 timer-display w-10 text-right">
                +{formatDuration(item.projectedStart - item.scheduledStart)}
              </span>
            ) : startsInMs > 0 ? (
              <span className="shrink-0 text-[10px] text-warm-700 timer-display w-10 text-right">
                {formatCountdown(startsInMs)}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
