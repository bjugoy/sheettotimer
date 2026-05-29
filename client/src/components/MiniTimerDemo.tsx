import React, { useState, useEffect } from 'react';
import { SkipForward, SkipBack, Clock, Timer, Square, Play } from 'lucide-react';
import { cn } from '../utils/timeUtils';

const ITEMS = [
  { title: 'Welcome & Intro',   dur: 60  },
  { title: 'Opening Keynote',   dur: 120 },
  { title: 'Coffee Break',      dur: 45  },
  { title: 'Panel Discussion',  dur: 90  },
  { title: 'Closing Remarks',   dur: 60  },
];

type DemoStatus = 'not_started' | 'active' | 'done';
type TimerMode  = 'countdown' | 'clock';

function fmtClock(ms: number) {
  const d   = new Date(ms);
  const h   = d.getHours();
  const mm  = d.getMinutes().toString().padStart(2, '0');
  const ss  = d.getSeconds().toString().padStart(2, '0');
  const sfx = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${mm}:${ss} ${sfx}`;
}

function fmtCountdown(s: number) {
  const abs = Math.abs(s);
  const mm  = Math.floor(abs / 60).toString().padStart(2, '0');
  const ss  = (abs % 60).toString().padStart(2, '0');
  return `${s < 0 ? '-' : ''}${mm}:${ss}`;
}

const INITIAL_STATUSES: DemoStatus[] = ITEMS.map(() => 'not_started');

export function MiniTimerDemo() {
  const [statuses, setStatuses]   = useState<DemoStatus[]>(INITIAL_STATUSES);
  const [current, setCurrent]     = useState(0);
  const [elapsed, setElapsed]     = useState(0);
  const [paused, setPaused]       = useState(false);
  const [timerMode, setTimerMode] = useState<TimerMode>('countdown');
  const [nowMs, setNowMs]         = useState(Date.now());

  const isActive     = statuses[current] === 'active';
  const eventStarted = statuses.some(s => s === 'active' || s === 'done');
  const allDone      = statuses.every(s => s === 'done');
  const remaining    = ITEMS[current].dur - elapsed;
  const isOvertime   = isActive && remaining < 0;
  const progress     = Math.min(Math.max(elapsed / ITEMS[current].dur, 0), 1);

  // Fast demo clock: 100 ms = 1 displayed second
  useEffect(() => {
    if (!isActive || paused) return;
    const id = setInterval(() => setElapsed(e => e + 1), 100);
    return () => clearInterval(id);
  }, [isActive, paused]);

  // Real wall-clock for clock mode
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const timerDisplay = (() => {
    if (timerMode === 'clock') return fmtClock(nowMs);
    if (!isActive)             return '--:--';
    return fmtCountdown(remaining);
  })();

  const timerColor = (() => {
    if (timerMode === 'clock') return 'text-warm-300';
    if (!isActive)             return 'text-warm-700';
    if (isOvertime)            return 'text-crimson-300';
    if (remaining < 15)        return 'text-amber-300';
    return 'text-warm-100';
  })();

  const startNow = () => {
    const next = [...statuses];
    next[current] = 'active';
    setStatuses(next);
    setElapsed(0);
    setPaused(false);
  };

  const stop = () => setPaused(p => !p);

  const advance = () => {
    const next    = [...statuses];
    next[current] = 'done';
    const nextIdx = current + 1;
    if (nextIdx < ITEMS.length) {
      next[nextIdx] = 'active';
      setCurrent(nextIdx);
      setElapsed(0);
      setPaused(false);
    }
    setStatuses(next);
  };

  const revert = () => {
    if (current === 0 && statuses[0] === 'not_started') return;
    const next    = [...statuses];
    next[current] = 'not_started';
    const prevIdx = Math.max(current - 1, 0);
    if (prevIdx < current) {
      next[prevIdx] = 'active';
      setCurrent(prevIdx);
    }
    setElapsed(0);
    setPaused(false);
    setStatuses(next);
  };

  const reset = () => {
    setStatuses(ITEMS.map(() => 'not_started'));
    setCurrent(0);
    setElapsed(0);
    setPaused(false);
  };

  const btnBase = 'flex items-center justify-center gap-1.5 text-xs rounded-lg transition-all border ' +
    'bg-warm-900 hover:bg-warm-800 border-warm-800 text-warm-400 hover:text-warm-200';

  return (
    <div className="bg-warm-900/80 border border-warm-700/40 rounded-2xl overflow-hidden shadow-2xl select-none"
      style={{ width: 300 }}>

      {/* ── Timer panel ──────────────────────────────────────────────────── */}
      <div className="bg-warm-950 px-4 pt-4 pb-3 border-b border-warm-800/40">

        {/* Status + mode toggle */}
        <div className="flex items-center justify-between mb-2">
          <span className={cn('text-[10px] uppercase tracking-widest font-medium',
            isActive ? 'text-crimson-400' : eventStarted ? 'text-warm-600' : 'text-warm-700')}>
            {isActive ? '● live' : eventStarted ? 'next up' : 'ready'}
          </span>
          <div className="flex gap-0.5">
            {(['countdown', 'clock'] as TimerMode[]).map(m => (
              <button key={m} onClick={() => setTimerMode(m)}
                className={cn('p-1 rounded transition-colors',
                  timerMode === m
                    ? 'text-warm-300 bg-warm-800 border border-warm-700/70'
                    : 'text-warm-700 hover:text-warm-500')}>
                {m === 'countdown' ? <Timer className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              </button>
            ))}
          </div>
        </div>

        {/* Current item name */}
        <div className="text-[11px] text-warm-500 truncate mb-2">
          {ITEMS[current].title}
        </div>

        {/* Big number */}
        <div className="flex flex-col items-center py-1 gap-0.5">
          {isOvertime && !paused && timerMode === 'countdown' && (
            <span className="text-[9px] tracking-[0.25em] uppercase text-crimson-400 font-mono animate-pulse">
              overtime
            </span>
          )}
          {paused && (
            <span className="text-[9px] tracking-[0.25em] uppercase text-warm-600 font-mono">
              paused
            </span>
          )}
          <span className={cn('font-mono font-bold tabular-nums leading-none transition-colors',
            paused ? 'text-warm-600' : timerColor)}
            style={{ fontSize: 42 }}>
            {timerDisplay}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-2.5 h-0.5 bg-warm-800 rounded overflow-hidden">
          <div className={cn('h-full transition-all duration-100',
            isOvertime ? 'bg-crimson-500' : 'bg-crimson-600/60')}
            style={{ width: `${progress * 100}%` }} />
        </div>

        {/* Control buttons */}
        <div className="mt-3 space-y-1.5">
          {allDone ? (
            <button onClick={reset}
              className={cn(btnBase, 'w-full py-2 hover:border-warm-700')}>
              ↺ Restart demo
            </button>
          ) : !eventStarted ? (
            <button onClick={startNow}
              className={cn(btnBase, 'w-full py-2 hover:border-crimson-800')}>
              ▶ Start now
            </button>
          ) : (
            <div className="flex gap-1.5">
              <button onClick={revert} title="Revert to previous"
                className={cn(btnBase, 'px-2.5 py-2 hover:border-warm-700')}>
                <SkipBack className="w-3.5 h-3.5" />
              </button>
              <button onClick={stop} title={paused ? 'Resume' : 'Stop'}
                className={cn(btnBase, 'px-2.5 py-2',
                  paused
                    ? 'border-crimson-800/60 text-crimson-400 hover:border-crimson-700'
                    : 'hover:border-warm-700')}>
                {paused
                  ? <Play className="w-3.5 h-3.5" />
                  : <Square className="w-3.5 h-3.5" />}
              </button>
              <button onClick={advance}
                className={cn(btnBase, 'flex-1 py-2 hover:border-crimson-800/70')}>
                <SkipForward className="w-3.5 h-3.5" />
                Mark done &amp; advance
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Schedule table ────────────────────────────────────────────────── */}
      <div className="divide-y divide-warm-800/40">
        {ITEMS.map((item, i) => {
          const isDone       = statuses[i] === 'done';
          const isCurrent    = i === current;
          const isItemActive = statuses[i] === 'active';
          const hl           = isCurrent && !isDone;
          return (
            <div key={i} className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-[11px]',
              hl ? 'bg-warm-200' : isDone ? 'opacity-30 bg-warm-950' : 'bg-warm-900'
            )}>
              <span className="w-3 text-center flex-shrink-0">
                {isDone
                  ? <span className="text-warm-500">✓</span>
                  : isItemActive
                    ? <span className={cn('inline-block w-1.5 h-1.5 rounded-full',
                        isOvertime && isCurrent ? 'bg-crimson-400 animate-pulse' : 'bg-crimson-500')} />
                    : <span className="text-[10px] text-warm-600">{i + 1}</span>
                }
              </span>
              <span className={cn('flex-1 truncate',
                hl      ? 'text-warm-900 font-semibold'
                : isDone ? 'text-warm-600 line-through decoration-warm-600'
                : 'text-warm-400')}>
                {item.title}
              </span>
              <span className="font-mono text-[10px] text-warm-700 flex-shrink-0">
                {Math.floor(item.dur / 60)}m
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
