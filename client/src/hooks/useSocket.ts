import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { SERVER_URL } from '../lib/api';
import type { ServerToClientEvents, ClientToServerEvents, ScheduleItem, UserRole } from '@program-timer/shared';
import { recalculate } from '@program-timer/shared';
import { useScheduleStore } from '../store/scheduleStore';
import { useSessionStore } from '../store/sessionStore';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let globalSocket: AppSocket | null = null;

function getSocket(): AppSocket {
  if (!globalSocket) {
    globalSocket = io(SERVER_URL || '/', { autoConnect: false, withCredentials: true });
  }
  return globalSocket;
}

export function useSocket() {
  const socketRef = useRef<AppSocket>(getSocket());
  const setItems = useScheduleStore(s => s.setItems);
  const setCurrentIndex = useScheduleStore(s => s.setCurrentIndex);
  const setRoom = useSessionStore(s => s.setRoom);
  const setUser = useSessionStore(s => s.setUser);
  const setUsers = useSessionStore(s => s.setUsers);
  const setConnected    = useSessionStore(s => s.setConnected);
  const addAnnouncement = useSessionStore(s => s.addAnnouncement);
  const setSocketError  = useSessionStore(s => s.setSocketError);
  const setSessionEnded = useSessionStore(s => s.setSessionEnded);
  const leaveSession    = useSessionStore(s => s.leaveSession);

  useEffect(() => {
    const socket = socketRef.current;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('room:joined', ({ room, user }) => {
      setRoom(room.code);
      setUser(user);
      if (room.schedule.length > 0) {
        setItems(recalculate(room.schedule, Date.now()));
        setCurrentIndex(room.currentIndex);
      } else if (user.role === 'operator') {
        const loaded = useScheduleStore.getState().items;
        if (loaded.length > 0) socketRef.current.emit('schedule:set', loaded);
      }
      // Persist session so the operator can rejoin after a page refresh
      try {
        localStorage.setItem('stt-session', JSON.stringify({
          code:      room.code,
          name:      user.name,
          createdAt: room.createdAt,
        }));
      } catch {}
    });

    socket.on('room:users', setUsers);

    socket.on('room:roleChanged', (user) => {
      setUser(user); // updates isOperator for the affected client
    });

    socket.on('schedule:update', (schedule) => {
      const recalced = recalculate(schedule, Date.now());
      setItems(recalced);
    });

    socket.on('item:advance', ({ currentIndex }) => {
      setCurrentIndex(currentIndex);
    });

    socket.on('item:revert', ({ currentIndex }) => {
      setCurrentIndex(currentIndex);
    });

    socket.on('announcement', addAnnouncement);

    socket.on('session:ended', (reason) => {
      setSessionEnded(reason);
      leaveSession();
      try { localStorage.removeItem('stt-session'); } catch {}
    });

    socket.on('error', (msg) => setSocketError(msg));

    if (!socket.connected) socket.connect();

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room:joined');
      socket.off('room:users');
      socket.off('room:roleChanged');
      socket.off('session:ended');
      socket.off('schedule:update');
      socket.off('item:advance');
      socket.off('item:revert');
      socket.off('announcement');
      socket.off('error');
      setSocketError(null);
    };
  }, []);

  const createRoom = useCallback((name: string, authToken: string) => {
    socketRef.current.emit('room:create', { name, authToken });
  }, []);

  const joinRoom = useCallback((code: string, name: string, authToken?: string) => {
    socketRef.current.emit('room:join', { code, name, ...(authToken ? { authToken } : {}) });
  }, []);

  const setUserRole = useCallback((targetSocketId: string, role: UserRole) => {
    socketRef.current.emit('room:setRole', { targetSocketId, role });
  }, []);

  const sendSchedule = useCallback((schedule: ScheduleItem[]) => {
    socketRef.current.emit('schedule:set', schedule);
  }, []);

  const updateItem = useCallback((id: string, changes: Partial<ScheduleItem>) => {
    socketRef.current.emit('schedule:updateItem', { id, changes });
  }, []);

  const advanceItem = useCallback(() => {
    socketRef.current.emit('item:advance');
  }, []);

  const revertItem = useCallback(() => {
    socketRef.current.emit('item:revert');
  }, []);

  const sendAnnouncement = useCallback((text: string) => {
    socketRef.current.emit('announcement:send', { text });
  }, []);

  return { createRoom, joinRoom, sendSchedule, updateItem, advanceItem, revertItem, sendAnnouncement, setUserRole };
}
