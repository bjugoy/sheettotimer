import { create } from 'zustand';
import type { RoomUser, Announcement } from '@program-timer/shared';

interface SessionState {
  roomCode: string | null;
  user: RoomUser | null;
  users: RoomUser[];
  announcements: Announcement[];
  connected: boolean;
  isOperator: boolean;
  socketError: string | null;

  setRoom: (code: string | null) => void;
  setUser: (user: RoomUser | null) => void;
  setUsers: (users: RoomUser[]) => void;
  addAnnouncement: (ann: Announcement) => void;
  dismissAnnouncement: (id: string) => void;
  setConnected: (v: boolean) => void;
  setSocketError: (msg: string | null) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  roomCode: null,
  user: null,
  users: [],
  announcements: [],
  connected: false,
  isOperator: false,
  socketError: null,

  setRoom: (roomCode) => set({ roomCode }),

  setUser: (user) => set({ user, isOperator: user?.role === 'operator' }),

  setUsers: (users) => set({ users }),

  addAnnouncement: (ann) => {
    set(s => ({ announcements: [...s.announcements, ann] }));
    // Auto-dismiss after 10 seconds
    setTimeout(() => get().dismissAnnouncement(ann.id), 10_000);
  },

  dismissAnnouncement: (id) =>
    set(s => ({ announcements: s.announcements.filter(a => a.id !== id) })),

  setConnected: (connected) => set({ connected }),
  setSocketError: (socketError) => set({ socketError }),
}));
