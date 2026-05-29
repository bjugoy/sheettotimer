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
  const items = useScheduleStore(s => s.items);
  const currentIndex = useScheduleStore(s => s.currentIndex);
  const [nowMs, setNowMs] = useState(Date.now());

  // 250 ms tick so the wall-clock seconds display stays smooth
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const current = items[currentIndex];
  if (!current) {
    return { remainingMs: 0, elapsedMs: 0, color: 'green', isOvertime: false, nowMs };
  }

  const startMs  = current.actualStart ?? current.projectedStart;
  // Count down to the scheduled deadline — not the full duration from actual start.
  // This means a late start immediately shows less time (and overtime if past scheduledEnd).
  const endMs    = current.scheduledEnd;
  const remainingMs = endMs - nowMs;
  const elapsedMs   = nowMs - startMs;
  const isOvertime  = remainingMs < 0;
  const color = current.status === 'active' ? timerColor(remainingMs) : 'green';

  return { remainingMs, elapsedMs, color, isOvertime, nowMs };
}
