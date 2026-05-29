import React, { useEffect, useRef } from 'react';
import { SkipForward, SkipBack, X, ChevronRight, Play } from 'lucide-react';
import { useScheduleStore } from '../store/scheduleStore';
import { useSessionStore } from '../store/sessionStore';
import { useSocket } from '../hooks/useSocket';
import { useTimer } from '../hooks/useTimer';
import { formatCountdown, formatTime, formatDuration, cn } from '../utils/timeUtils';
import { AnnouncementBanner } from './AnnouncementBanner';

interface Props {
  onClose: () => void;
}

const TIMER_COLOR = {
  green:  'text-crimson-200',
  yellow: 'text-amber-300',
  red:    'text-crimson-100',
} as const;

const BG_TINT = {
  green:  '',
  yellow: 'bg-amber-950/10',
  red:    'bg-crimson-950/20',
} as const;

export function TeleprompterView({ onClose }: Props) {
  const items         = useScheduleStore(s => s.items);
  const currentIndex  = useScheduleStore(s => s.currentIndex);
  const markStarted   = useScheduleStore(s => s.markStarted);
  const advanceToNext = useScheduleStore(s => s.advanceToNext);
  const revertToPrev  = useScheduleStore(s => s.revertToPrev);
  const isOperator    = useSessionStore(s => s.isOperator);
  const roomCode      = useSessionStore(s => s.roomCode);
  const { advanceItem, revertItem } = useSocket();
  const { remainingMs, color, isOvertime, nowMs } = useTimer();

  const containerRef = useRef<HTMLDivElement>(null);

  const current      = items[currentIndex];
  const next         = items[currentIndex + 1];
  const canControl   = isOperator || !roomCode;
  const eventStarted = items.some(i => i.status === 'active' || i.status === 'done');
  const isActive     = current?.status === 'active';

  const elapsed   = isActive && current.actualStart ? nowMs - current.actualStart : 0;
  const totalMs   = current?.durationMs ?? 1;
  const progress  = Math.min(Math.max(elapsed / totalMs, 0), 1);

  // Fullscreen on mount
  useEffect(() => {
    containerRef.current?.requestFullscreen().catch(() => {});
    return () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  }, []);

  const handleAdvance = () => !roomCode ? advanceToNext() : advanceItem();
  const handleRevert  = () => !roomCode ? revertToPrev()  : revertItem();
  const handleStart   = () => {
    if (!current) return;
    markStarted(current.id);
  };

  // Keyboard: Space/Enter = advance · Backspace/← = revert · Esc = close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (!canControl) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleAdvance(); }
      if (e.key === 'Backspace' || e.key === 'ArrowLeft') { e.preventDefault(); handleRevert(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canControl, roomCode, currentIndex]);

  if (!current) {
    return (
      <div ref={containerRef} className="fixed inset-0 bg-warm-950 flex items-center justify-center z-50">
        <p className="text-warm-600 text-2xl">No schedule loaded</p>
        <button onClick={onClose} className="absolute top-4 right-4 text-warm-600 hover:text-warm-300">
          <X className="w-6 h-6" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'fixed inset-0 z-50 flex flex-col bg-warm-950 transition-colors duration-700',
        BG_TINT[color]
      )}
    >
      <AnnouncementBanner />

      {/* ── Close ─────────────────────────────────────────────────────────── */}
      <button onClick={onClose}
        className="absolute top-4 right-4 text-warm-700 hover:text-warm-400 transition-colors z-10"
        title="Close (Esc)">
        <X className="w-5 h-5" />
      </button>

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-12 py-10 text-center min-h-0">

        {/* Status + end time */}
        <div className="flex items-center gap-6 mb-6"
          style={{ fontSize: 'clamp(0.7rem, 1.5vw, 1rem)' }}>
          <span className={cn('uppercase tracking-[0.2em] font-medium',
            isActive ? 'text-crimson-400' : eventStarted ? 'text-warm-600' : 'text-warm-700')}>
            {isActive ? '● live' : eventStarted ? 'next up' : 'ready'}
          </span>
          <span className="text-warm-700 timer-display">
            {formatTime(current.scheduledStart)}–{formatTime(current.scheduledEnd)}
            <span className="mx-2 opacity-40">·</span>
            {formatDuration(current.durationMs)}
          </span>
        </div>

        {/* Item title */}
        <h1 className="font-bold text-warm-100 leading-tight mb-6"
          style={{ fontSize: 'clamp(1.8rem, 5vw, 4.5rem)' }}>
          {current.title}
        </h1>

        {/* Countdown */}
        <div className="flex flex-col items-center gap-1 mb-6">
          {isOvertime && (
            <span className="uppercase tracking-[0.3em] text-crimson-400 font-mono font-medium animate-pulse-fast"
              style={{ fontSize: 'clamp(0.6rem, 1.5vw, 0.9rem)' }}>
              overtime
            </span>
          )}
          <span
            className={cn(
              'timer-display font-mono font-bold leading-none transition-colors duration-300',
              TIMER_COLOR[color]
            )}
            style={{ fontSize: 'clamp(5rem, 18vw, 13rem)' }}
          >
            {formatCountdown(Math.abs(remainingMs))}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-2xl h-1 bg-warm-800/60 rounded overflow-hidden mb-8">
          <div
            className={cn('h-full rounded transition-all duration-500',
              isOvertime ? 'bg-crimson-500' : 'bg-crimson-700/60')}
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* Speaker notes */}
        {current.notes ? (
          <div className="w-full max-w-3xl bg-warm-900/50 border border-warm-800/40 rounded-2xl
            px-10 py-7 overflow-y-auto" style={{ maxHeight: '28vh' }}>
            <p className="text-warm-200 leading-relaxed whitespace-pre-wrap text-left"
              style={{ fontSize: 'clamp(1rem, 2.2vw, 1.6rem)' }}>
              {current.notes}
            </p>
          </div>
        ) : (
          <div className="text-warm-800 italic"
            style={{ fontSize: 'clamp(0.8rem, 1.5vw, 1rem)' }}>
            No notes for this item
          </div>
        )}
      </div>

      {/* ── Bottom bar ────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-warm-800/50 bg-warm-900/60 px-8 py-4
        flex items-center justify-between gap-6">

        {/* Next item */}
        <div style={{ fontSize: 'clamp(0.75rem, 1.4vw, 1rem)' }}>
          {next ? (
            <div className="flex items-center gap-2 text-warm-600">
              <ChevronRight className="w-4 h-4 flex-shrink-0" />
              <span>
                Next: <span className="text-warm-300">{next.title}</span>
                <span className="mx-1.5 opacity-40">·</span>
                <span className="timer-display text-warm-500">{formatTime(next.projectedStart)}</span>
              </span>
            </div>
          ) : (
            <span className="text-warm-700 italic">Last item</span>
          )}
        </div>

        {/* Controls */}
        {canControl && (
          <div className="flex items-center gap-2 shrink-0">
            {!eventStarted ? (
              <button onClick={handleStart}
                className="flex items-center gap-2 px-5 py-2.5
                  bg-warm-800 hover:bg-warm-700 border border-warm-700
                  hover:border-crimson-800 text-warm-300 rounded-xl transition-all"
                style={{ fontSize: 'clamp(0.75rem, 1.4vw, 0.9rem)' }}>
                <Play className="w-4 h-4 text-crimson-400" />
                Start now
              </button>
            ) : (
              <>
                <button onClick={handleRevert}
                  className="flex items-center justify-center p-2.5
                    bg-warm-800 hover:bg-warm-700 border border-warm-700
                    hover:border-warm-600 rounded-xl transition-all"
                  title="Revert to previous (← Backspace)">
                  <SkipBack className="w-5 h-5 text-warm-400" />
                </button>
                <button onClick={handleAdvance}
                  className="flex items-center gap-2 px-6 py-2.5
                    bg-warm-800 hover:bg-warm-700 border border-warm-700
                    hover:border-crimson-800/70 text-warm-300 rounded-xl transition-all"
                  title="Mark done & advance (Space / Enter)"
                  style={{ fontSize: 'clamp(0.75rem, 1.4vw, 0.9rem)' }}>
                  <SkipForward className="w-5 h-5" />
                  Mark done &amp; advance
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Keyboard hint */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-warm-800 text-[11px]">
        {canControl
          ? 'Space / Enter — advance · ← Backspace — revert · Esc — close'
          : 'Esc — close'}
      </div>
    </div>
  );
}
