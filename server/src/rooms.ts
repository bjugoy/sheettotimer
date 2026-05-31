import type { Room, RoomUser, ScheduleItem, Announcement } from '@program-timer/shared';
import { v4 as uuid } from 'uuid';

// In-memory store — replace with Redis for multi-instance deployments
const rooms = new Map<string, Room>();
const roomUsers = new Map<string, Map<string, RoomUser>>();
const announcements = new Map<string, Announcement[]>();

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function createRoom(ownerId: string, capacity: number): Room {
  let code = generateCode();
  while (rooms.has(code)) code = generateCode();

  const room: Room = {
    code,
    schedule: [],
    currentIndex: 0,
    createdAt: Date.now(),
    capacity,
    ownerId,
  };

  rooms.set(code, room);
  roomUsers.set(code, new Map());
  announcements.set(code, []);
  return room;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function updateRoom(code: string, changes: Partial<Room>): Room | undefined {
  const room = rooms.get(code);
  if (!room) return undefined;
  const updated = { ...room, ...changes };
  rooms.set(code, updated);
  return updated;
}

export function setSchedule(code: string, schedule: ScheduleItem[]): Room | undefined {
  return updateRoom(code, { schedule });
}

export function advanceItem(code: string, actualEnd: number): Room | undefined {
  const room = rooms.get(code);
  if (!room) return undefined;
  const newIndex = Math.min(room.currentIndex + 1, room.schedule.length - 1);

  const schedule = room.schedule.map((item, i) => {
    if (i === room.currentIndex) {
      return { ...item, status: 'done' as const, actualEnd };
    }
    if (i === newIndex) {
      return { ...item, status: 'active' as const, actualStart: actualEnd };
    }
    return item;
  });

  return updateRoom(code, { schedule, currentIndex: newIndex });
}

// ─── Users ───────────────────────────────────────────────────────────────────

export function joinRoom(
  code: string,
  socketId: string,
  name: string,
  role: RoomUser['role'],
  userId?: string
): RoomUser | { error: string } {
  const room = rooms.get(code);
  if (!room) return { error: `Room "${code}" not found` };

  const current = roomUsers.get(code)!;
  if (current.size >= room.capacity) {
    return { error: `Room is full (capacity: ${room.capacity})` };
  }

  const user: RoomUser = { id: socketId, name, role, ...(userId ? { userId } : {}) };
  current.set(socketId, user);
  return user;
}

/** Returns codes of rooms older than maxAgeMs and removes them. */
export function cleanupExpiredRooms(maxAgeMs: number): string[] {
  const cutoff = Date.now() - maxAgeMs;
  const expired: string[] = [];
  for (const [code, room] of rooms) {
    if (room.createdAt < cutoff) {
      rooms.delete(code);
      roomUsers.delete(code);
      announcements.delete(code);
      expired.push(code);
    }
  }
  return expired;
}

export function leaveRoom(code: string, socketId: string): void {
  roomUsers.get(code)?.delete(socketId);
}

export function getRoomUsers(code: string): RoomUser[] {
  return Array.from(roomUsers.get(code)?.values() ?? []);
}

export function updateUserRole(
  code: string,
  socketId: string,
  role: RoomUser['role']
): RoomUser | undefined {
  const users = roomUsers.get(code);
  if (!users) return undefined;
  const user = users.get(socketId);
  if (!user) return undefined;
  const updated = { ...user, role };
  users.set(socketId, updated);
  return updated;
}

// Find which room a socket is in
const socketRooms = new Map<string, string>();

export function registerSocket(socketId: string, roomCode: string): void {
  socketRooms.set(socketId, roomCode);
}

export function unregisterSocket(socketId: string): string | undefined {
  const code = socketRooms.get(socketId);
  socketRooms.delete(socketId);
  return code;
}

export function getRoomForSocket(socketId: string): string | undefined {
  return socketRooms.get(socketId);
}

// ─── Announcements ───────────────────────────────────────────────────────────

export function addAnnouncement(code: string, text: string, sentBy: string): Announcement {
  const ann: Announcement = {
    id: uuid(),
    text: text.slice(0, 280),
    sentBy,
    sentAt: Date.now(),
  };
  announcements.get(code)?.push(ann);
  return ann;
}
