import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ScheduleItem, ColumnMapping } from '@program-timer/shared';
import { recalculate } from '@program-timer/shared';

interface PerEventTimerState {
  items: ScheduleItem[];
  baseItems: ScheduleItem[];
  currentIndex: number;
  isPaused: boolean;
  pausedAt: number | undefined;
}

interface ScheduleState {
  items: ScheduleItem[];
  baseItems: ScheduleItem[];
  currentIndex: number;
  columnMapping: ColumnMapping[];
  isWhatIfMode: boolean;
  spreadsheetId: string | null;
  googleAuthenticated: boolean;
  isPaused: boolean;
  pausedAt: number | undefined;
  activeEventId: string | null;
  timerStates: Record<string, PerEventTimerState>;

  setItems: (items: ScheduleItem[]) => void;
  shiftToNow: () => void;
  resetToOriginal: () => void;
  setCurrentIndex: (index: number) => void;
  setColumnMapping: (mapping: ColumnMapping[]) => void;

  updateItem: (id: string, changes: Partial<ScheduleItem>) => void;
  addItem: (item: ScheduleItem) => void;
  removeItem: (id: string) => void;
  reorderItems: (fromIndex: number, toIndex: number) => void;

  markStarted: (id: string) => void;
  markDone: (id: string) => void;
  advanceToNext: () => void;
  revertToPrev: () => void;

  setWhatIfDuration: (id: string, durationMs: number) => void;
  commitWhatIf: () => void;
  cancelWhatIf: () => void;

  setItemsDraft: (items: ScheduleItem[]) => void;

  setSpreadsheetId: (id: string | null) => void;
  setGoogleAuthenticated: (v: boolean) => void;

  clearAll: () => void;
  pause: () => void;
  resume: () => void;
  syncItems: (items: ScheduleItem[]) => void;
  setActiveEventId: (id: string | null) => void;
  saveTimer: (eventId: string) => void;
  loadTimer: (eventId: string) => boolean;

  recalc: () => void;
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      items: [],
      baseItems: [],
      currentIndex: 0,
      columnMapping: [],
      isWhatIfMode: false,
      spreadsheetId: null,
      googleAuthenticated: false,
      isPaused: false,
      pausedAt: undefined,
      activeEventId: null,
      timerStates: {},

      setItems: (items) => set({ items, baseItems: items, currentIndex: 0, isPaused: false, pausedAt: undefined }),

      shiftToNow: () => {
        const { items } = get();
        if (items.length === 0) return;
        const first = items.find(i => !isNaN(i.scheduledStart));
        if (!first) return;
        const now = Date.now();
        const offset = now - first.scheduledStart;
        const shifted = items.map(item => ({
          ...item,
          scheduledStart: item.scheduledStart + offset,
          scheduledEnd:   item.scheduledEnd   + offset,
        }));
        set({ items: recalculate(shifted, now) });
      },

      resetToOriginal: () => {
        const { items, baseItems } = get();
        const now = Date.now();
        const restored = items.map(item => {
          const base = baseItems.find(b => b.id === item.id);
          if (!base) return item;
          return { ...item, scheduledStart: base.scheduledStart, scheduledEnd: base.scheduledEnd };
        });
        set({ items: recalculate(restored, now), isPaused: false, pausedAt: undefined });
      },

      setCurrentIndex: (currentIndex) => set({ currentIndex }),
      setColumnMapping: (columnMapping) => set({ columnMapping }),

      updateItem: (id, changes) => {
        const items = get().items.map(item => item.id === id ? { ...item, ...changes } : item);
        set({ items: recalculate(items, Date.now()) });
      },

      addItem: (item) => {
        const items = [...get().items, item];
        set({ items: recalculate(items, Date.now()) });
      },

      removeItem: (id) => set({ items: get().items.filter(i => i.id !== id) }),

      reorderItems: (fromIndex, toIndex) => {
        const items = [...get().items];
        const [moved] = items.splice(fromIndex, 1);
        items.splice(toIndex, 0, moved);
        set({ items: recalculate(items, Date.now()) });
      },

      markStarted: (id) => {
        const now = Date.now();
        const items = get().items.map(item =>
          item.id === id ? { ...item, status: 'active' as const, actualStart: now } : item
        );
        const idx = items.findIndex(i => i.id === id);
        set({ items: recalculate(items, now), currentIndex: Math.max(0, idx) });
      },

      markDone: (id) => {
        const now = Date.now();
        const items = get().items.map(item =>
          item.id === id ? { ...item, status: 'done' as const, actualEnd: now } : item
        );
        set({ items: recalculate(items, now) });
      },

      advanceToNext: () => {
        const { items, currentIndex } = get();
        const now = Date.now();
        const nextIndex = Math.min(currentIndex + 1, items.length - 1);
        const updated = items.map((item, i) => {
          if (i === currentIndex && item.status !== 'done')
            return { ...item, status: 'done' as const, actualEnd: now };
          if (i === nextIndex && i !== currentIndex)
            return { ...item, status: 'active' as const, actualStart: now };
          return item;
        });
        set({ items: recalculate(updated, now), currentIndex: nextIndex, isPaused: false, pausedAt: undefined });
      },

      revertToPrev: () => {
        const { items, currentIndex } = get();
        const now = Date.now();
        const prevIndex = Math.max(currentIndex - 1, 0);
        const updated = items.map((item, i) => {
          if (i === currentIndex)
            return { ...item, status: 'not_started' as const, actualStart: undefined, actualEnd: undefined };
          if (i === prevIndex && prevIndex < currentIndex)
            return { ...item, status: 'active' as const, actualEnd: undefined };
          return item;
        });
        set({ items: recalculate(updated, now), currentIndex: prevIndex, isPaused: false, pausedAt: undefined });
      },

      pause: () => {
        const { isPaused, items, currentIndex } = get();
        if (isPaused) return;
        if (!items.some(i => i.status === 'active')) return;
        const now = Date.now();
        const stamped = items.map((item, i) =>
          i === currentIndex && item.status === 'active' ? { ...item, pausedAt: now } : item
        );
        set({ isPaused: true, pausedAt: now, items: stamped });
      },

      resume: () => {
        const { isPaused, pausedAt, items, currentIndex } = get();
        if (!isPaused || pausedAt === undefined) return;
        const now = Date.now();
        const pauseDuration = now - pausedAt;
        // Shift the active item's end and all future items forward by the pause duration
        const shifted = items.map((item, i) => {
          if (i === currentIndex && item.status === 'active') {
            return {
              ...item,
              pausedAt: undefined,
              scheduledEnd: item.scheduledEnd + pauseDuration,
              projectedEnd: item.projectedEnd + pauseDuration,
            };
          }
          if (item.status === 'not_started') {
            return {
              ...item,
              scheduledStart: item.scheduledStart + pauseDuration,
              scheduledEnd:   item.scheduledEnd   + pauseDuration,
              projectedStart: item.projectedStart + pauseDuration,
              projectedEnd:   item.projectedEnd   + pauseDuration,
            };
          }
          return item;
        });
        set({ isPaused: false, pausedAt: undefined, items: recalculate(shifted, now) });
      },

      // Applies a schedule received from the server without resetting currentIndex.
      // Derives isPaused/pausedAt from the active item's pausedAt field so pause
      // state round-trips through the socket correctly.
      syncItems: (items) => {
        const active = items.find(i => i.status === 'active');
        const isPaused = !!active?.pausedAt;
        const pausedAt = active?.pausedAt;
        set({ items, isPaused, pausedAt });
      },

      setActiveEventId: (activeEventId) => set({ activeEventId }),

      saveTimer: (eventId) => {
        const { items, baseItems, currentIndex, isPaused, pausedAt } = get();
        set(s => ({
          timerStates: {
            ...s.timerStates,
            [eventId]: { items, baseItems, currentIndex, isPaused, pausedAt },
          },
        }));
      },

      loadTimer: (eventId) => {
        const saved = get().timerStates[eventId];
        if (!saved || saved.items.length === 0) return false;
        set({
          items:        saved.items,
          baseItems:    saved.baseItems,
          currentIndex: saved.currentIndex,
          isPaused:     saved.isPaused,
          pausedAt:     saved.pausedAt,
        });
        return true;
      },

      setWhatIfDuration: (id, durationMs) => {
        const items = get().items.map(item =>
          item.id === id ? { ...item, whatIfDurationMs: durationMs } : item
        );
        set({ items: recalculate(items, Date.now()), isWhatIfMode: true });
      },

      commitWhatIf: () => {
        const items = get().items.map(item => {
          if (item.whatIfDurationMs !== undefined) {
            const { whatIfDurationMs, ...rest } = item;
            return { ...rest, durationMs: whatIfDurationMs };
          }
          return item;
        });
        set({ items: recalculate(items, Date.now()), isWhatIfMode: false });
      },

      cancelWhatIf: () => {
        const items = get().items.map(item => {
          const { whatIfDurationMs, ...rest } = item;
          return rest;
        });
        set({ items: recalculate(items, Date.now()), isWhatIfMode: false });
      },

      setItemsDraft: (items) => {
        const recalced = recalculate(items, Date.now());
        set({ items: recalced, baseItems: recalced });
      },

      setSpreadsheetId: (spreadsheetId) => set({ spreadsheetId }),
      setGoogleAuthenticated: (googleAuthenticated) => set({ googleAuthenticated }),

      clearAll: () => set({
        items: [], baseItems: [], currentIndex: 0,
        isPaused: false, pausedAt: undefined,
        activeEventId: null, timerStates: {},
        columnMapping: [],
      }),

      recalc: () => set({ items: recalculate(get().items, Date.now()) }),
    }),
    {
      name: 'stt-schedule',
      partialize: (state) => ({
        items:         state.items,
        baseItems:     state.baseItems,
        currentIndex:  state.currentIndex,
        columnMapping: state.columnMapping,
        activeEventId: state.activeEventId,
        isPaused:      state.isPaused,
        pausedAt:      state.pausedAt,
        timerStates:   state.timerStates,
      }),
    }
  )
);
