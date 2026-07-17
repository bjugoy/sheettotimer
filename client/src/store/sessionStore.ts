import { create } from 'zustand';
import type { RoomUser, Announcement } from '@program-timer/shared';

interface SessionState {
  roomCode: string | null;
  roomOwnerId: string | null;
  user: RoomUser | null;
  users: RoomUser[];
  announcements: Announcement[];
  connected: boolean;
  isOperator: boolean;
  socketError: string | null;
  sessionEndedReason: string | null;

  setRoom: (code: string | null, ownerId?: string) => void;
  setUser: (user: RoomUser | null) => void;
  setUsers: (users: RoomUser[]) => void;
  addAnnouncement: (ann: Announcement) => void;
  dismissAnnouncement: (id: string) => void;
  setConnected: (v: boolean) => void;
  setSocketError: (msg: string | null) => void;
  setSessionEnded: (reason: string | null) => void;
  leaveSession: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  roomCode: null,
  roomOwnerId: null,
  user: null,
  users: [],
  announcements: [],
  connected: false,
  isOperator: false,
  socketError: null,
  sessionEndedReason: null,

  setRoom: (roomCode, ownerId) => set({ roomCode, ...(ownerId ? { roomOwnerId: ownerId } : {}) }),

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
  setSessionEnded: (sessionEndedReason) => set({ sessionEndedReason }),
  leaveSession: () => {
    try { sessionStorage.removeItem('stt-session'); } catch {}
    set({
      roomCode: null, roomOwnerId: null, user: null, users: [],
      isOperator: false, sessionEndedReason: null,
    });
  },
}));
