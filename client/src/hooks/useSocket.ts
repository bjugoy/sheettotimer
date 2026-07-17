import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { SERVER_URL } from '../lib/api';
import type {
  ServerToClientEvents, ClientToServerEvents,
  ScheduleItem, UserRole, Room, RoomUser, Announcement,
} from '@program-timer/shared';
import { recalculate } from '@program-timer/shared';
import { useScheduleStore } from '../store/scheduleStore';
import { useSessionStore } from '../store/sessionStore';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let globalSocket: AppSocket | null = null;
// Shared across all useSocket() instances — the server emits csrf:token once on
// connection, before most components mount, so per-instance refs would start empty.
let globalCsrfToken = '';

function getSocket(): AppSocket {
  if (!globalSocket) {
    globalSocket = io(SERVER_URL || '/', { autoConnect: false, withCredentials: true });
  }
  return globalSocket;
}

export function useSocket() {
  const socketRef = useRef<AppSocket>(getSocket());

  const setItems = useScheduleStore(s => s.setItems);
  const syncItems = useScheduleStore(s => s.syncItems);
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

    // Named handler references so cleanup removes only THIS instance's listeners.
    // socket.off('event') with no handler removes ALL listeners for that event,
    // which would blow away other mounted components' handlers.
    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onCsrf       = (token: string) => { globalCsrfToken = token; };

    const onRoomJoined = ({ room, user }: { room: Room; user: RoomUser }) => {
      // Set items BEFORE roomCode so the view-transition effect in App.tsx
      // sees the correct items.length when it fires on roomCode change.
      setUser(user);
      if (room.schedule.length > 0) {
        setItems(recalculate(room.schedule, Date.now()));
        setCurrentIndex(room.currentIndex);
      } else if (user.role === 'operator') {
        const loaded = useScheduleStore.getState().items;
        if (loaded.length > 0) socket.emit('schedule:set', { schedule: loaded, _csrf: globalCsrfToken });
      }
      // Set roomCode last — by this point items/user are already in the store,
      // so App.tsx's useEffect([roomCode]) sees the correct state.
      setRoom(room.code, room.ownerId);
      // Persist session so the operator can rejoin after a page refresh
      try {
        sessionStorage.setItem('stt-session', JSON.stringify({
          code:      room.code,
          name:      user.name,
          createdAt: room.createdAt,
        }));
      } catch {}
    };

    const onRoomUsers      = (users: RoomUser[]) => setUsers(users);
    const onRoleChanged    = (user: RoomUser)    => setUser(user);
    const onScheduleUpdate = (schedule: ScheduleItem[]) => {
      syncItems(recalculate(schedule, Date.now()));
    };
    const onItemAdvance    = ({ currentIndex }: { currentIndex: number; actualEnd: number }) => {
      setCurrentIndex(currentIndex);
    };
    const onItemRevert     = ({ currentIndex }: { currentIndex: number }) => {
      setCurrentIndex(currentIndex);
    };
    const onAnnouncement   = (ann: Announcement) => addAnnouncement(ann);
    const onSessionEnded   = (reason: string) => {
      setSessionEnded(reason);
      leaveSession();
      try { sessionStorage.removeItem('stt-session'); } catch {}
    };
    const onError = (msg: string) => setSocketError(msg);

    socket.on('connect',          onConnect);
    socket.on('disconnect',       onDisconnect);
    socket.on('csrf:token',       onCsrf);
    socket.on('room:joined',      onRoomJoined);
    socket.on('room:users',       onRoomUsers);
    socket.on('room:roleChanged', onRoleChanged);
    socket.on('schedule:update',  onScheduleUpdate);
    socket.on('item:advance',     onItemAdvance);
    socket.on('item:revert',      onItemRevert);
    socket.on('announcement',     onAnnouncement);
    socket.on('session:ended',    onSessionEnded);
    socket.on('error',            onError);

    if (!socket.connected) socket.connect();

    return () => {
      socket.off('connect',          onConnect);
      socket.off('disconnect',       onDisconnect);
      socket.off('csrf:token',       onCsrf);
      socket.off('room:joined',      onRoomJoined);
      socket.off('room:users',       onRoomUsers);
      socket.off('room:roleChanged', onRoleChanged);
      socket.off('schedule:update',  onScheduleUpdate);
      socket.off('item:advance',     onItemAdvance);
      socket.off('item:revert',      onItemRevert);
      socket.off('announcement',     onAnnouncement);
      socket.off('session:ended',    onSessionEnded);
      socket.off('error',            onError);
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
    socketRef.current.emit('room:setRole', { targetSocketId, role, _csrf: globalCsrfToken });
  }, []);

  const sendSchedule = useCallback((schedule: ScheduleItem[]) => {
    socketRef.current.emit('schedule:set', { schedule, _csrf: globalCsrfToken });
  }, []);

  const updateItem = useCallback((id: string, changes: Partial<ScheduleItem>) => {
    socketRef.current.emit('schedule:updateItem', { id, changes, _csrf: globalCsrfToken });
  }, []);

  const advanceItem = useCallback(() => {
    socketRef.current.emit('item:advance', { _csrf: globalCsrfToken });
  }, []);

  const revertItem = useCallback(() => {
    socketRef.current.emit('item:revert', { _csrf: globalCsrfToken });
  }, []);

  const sendAnnouncement = useCallback((text: string) => {
    socketRef.current.emit('announcement:send', { text, _csrf: globalCsrfToken });
  }, []);

  return { createRoom, joinRoom, sendSchedule, updateItem, advanceItem, revertItem, sendAnnouncement, setUserRole };
}
