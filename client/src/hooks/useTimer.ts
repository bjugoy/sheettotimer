import { useState, useEffect } from 'react';
import { useScheduleStore } from '../store/scheduleStore';
import { timerColor } from '../utils/timeUtils';

interface TimerState {
  remainingMs: number;
  elapsedMs: number;
  color: 'green' | 'yellow' | 'red';
  isOvertime: boolean;
  nowMs: number;
}

export function useTimer(): TimerState {
  const items        = useScheduleStore(s => s.items);
  const currentIndex = useScheduleStore(s => s.currentIndex);
  const isPaused     = useScheduleStore(s => s.isPaused);
  const pausedAt     = useScheduleStore(s => s.pausedAt);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const current = items[currentIndex];
  if (!current) {
    return { remainingMs: 0, elapsedMs: 0, color: 'green', isOvertime: false, nowMs };
  }

  // When paused, freeze time at the moment of pausing
  const effectiveNow = isPaused ? (pausedAt ?? nowMs) : nowMs;

  const startMs      = current.actualStart ?? current.projectedStart;
  const endMs        = current.scheduledEnd;
  const remainingMs  = endMs - effectiveNow;
  const elapsedMs    = effectiveNow - startMs;
  const isOvertime   = remainingMs < 0;
  const color        = current.status === 'active' ? timerColor(remainingMs) : 'green';

  return { remainingMs, elapsedMs, color, isOvertime, nowMs: effectiveNow };
}
