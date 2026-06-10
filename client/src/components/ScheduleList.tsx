import React from 'react';
import type { ScheduleItem } from '@program-timer/shared';
import { formatTime, formatDuration, inlineTitle } from '../utils/timeUtils';
import { CheckCircle, Circle, Play, AlertTriangle } from 'lucide-react';

interface Props {
  items: ScheduleItem[];
  currentIndex: number;
  nowMs: number;
}

export function ScheduleList({ items, currentIndex, nowMs }: Props) {
  return (
    <div className="divide-y divide-gray-800/60">
      {items.map((item, idx) => {
        const isCurrent = idx === currentIndex;
        const isDone = item.status === 'done';
        const isActive = item.status === 'active';
        const isOvertime = isActive && nowMs > item.projectedEnd;
        const isLate = item.projectedStart > item.scheduledStart + 60_000;

        return (
          <div
            key={item.id}
            className={`
              flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
              ${isCurrent ? 'bg-gray-800/60' : 'hover:bg-gray-900/40'}
              ${isDone ? 'opacity-40' : ''}
            `}
          >
            {/* Status icon */}
            <div className="shrink-0 w-5">
              {isDone ? (
                <CheckCircle className="w-4 h-4 text-gray-500" />
              ) : isActive ? (
                isOvertime
                  ? <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
                  : <Play className="w-4 h-4 text-green-400" />
              ) : (
                <Circle className="w-4 h-4 text-gray-700" />
              )}
            </div>

            {/* Time */}
            <span className={`shrink-0 timer-display text-xs w-11 ${isDone ? 'text-gray-600' : 'text-gray-400'}`}>
              {formatTime(item.projectedStart)}
            </span>

            {/* Title */}
            <span className={`flex-1 truncate ${isCurrent ? 'text-white font-medium' : isDone ? 'text-gray-600' : 'text-gray-300'}`}>
              {inlineTitle(item.title)}
            </span>

            {/* Duration */}
            <span className="shrink-0 text-xs text-gray-600 timer-display">
              {formatDuration(item.durationMs)}
            </span>

            {/* Drift indicator */}
            {isLate && !isDone && (
              <span className="shrink-0 text-xs text-red-500 timer-display">
                +{formatDuration(item.projectedStart - item.scheduledStart)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
