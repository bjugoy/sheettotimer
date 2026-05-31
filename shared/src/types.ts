// ─── Schedule item ──────────────────────────────────────────────────────────

export type ItemStatus = 'not_started' | 'active' | 'done' | 'overtime';

export interface ScheduleItem {
  id: string;
  title: string;
  scheduledStart: number;   // Unix ms — the original planned start
  scheduledEnd: number;     // Unix ms — the original planned end
  projectedStart: number;   // Unix ms — recalculated after overruns
  projectedEnd: number;     // Unix ms — recalculated after overruns
  durationMs: number;       // original planned duration in ms
  actualStart?: number;     // Unix ms — when operator marked it started
  actualEnd?: number;       // Unix ms — when operator marked it done
  status: ItemStatus;
  notes?: string;                         // speaker notes / teleprompter copy
  customFields?: Record<string, string>;  // user-defined columns (paid plans)
  // what-if override (not persisted to server)
  whatIfDurationMs?: number;
}

// ─── Parsed / raw row from spreadsheet ──────────────────────────────────────

export interface RawRow {
  [key: string]: string | number | null | undefined;
}

export type ColumnRole = 'startTime' | 'endTime' | 'duration' | 'title' | 'notes' | 'custom' | 'ignore';

export interface ColumnMapping {
  sourceKey: string;   // original column header or index
  role: ColumnRole;
}

export interface ParseResult {
  rows: RawRow[];
  suggestedMapping: ColumnMapping[];
  headers: string[];
  warnings: string[];
}

// ─── Plans ───────────────────────────────────────────────────────────────────

export type Plan = 'free' | 'premium1' | 'premium2' | 'premium3';

export const PLAN_ROOM_CAPACITY: Record<Plan, number> = {
  free:      0,
  premium1:  5,
  premium2:  15,
  premium3:  50,
};

// ─── Session / room ──────────────────────────────────────────────────────────

export type UserRole = 'operator' | 'viewer';

export interface RoomUser {
  id: string;
  name: string;
  role: UserRole;
}

export interface Room {
  code: string;
  schedule: ScheduleItem[];
  currentIndex: number;
  startedAt?: number;   // Unix ms when the session was started
  createdAt: number;
  capacity: number;     // max users allowed (set from owner's plan)
  ownerId: string;      // Supabase user ID of the creator
}

// ─── Announcements ──────────────────────────────────────────────────────────

export interface Announcement {
  id: string;
  text: string;         // max 280 chars
  sentBy: string;       // user name
  sentAt: number;       // Unix ms
}

// ─── Socket.io event payloads ────────────────────────────────────────────────

export interface ServerToClientEvents {
  'schedule:update': (schedule: ScheduleItem[]) => void;
  'item:advance': (payload: { currentIndex: number; actualEnd: number }) => void;
  'item:revert': (payload: { currentIndex: number }) => void;
  'announcement': (announcement: Announcement) => void;
  'room:users': (users: RoomUser[]) => void;
  'room:joined': (payload: { room: Room; user: RoomUser }) => void;
  'room:roleChanged': (user: RoomUser) => void;
  'error': (message: string) => void;
}

export interface ClientToServerEvents {
  'room:join': (payload: { code: string; name: string }) => void;
  'room:create': (payload: { name: string; authToken: string }) => void;
  'room:setRole': (payload: { targetSocketId: string; role: UserRole }) => void;
  'schedule:set': (schedule: ScheduleItem[]) => void;
  'schedule:updateItem': (payload: { id: string; changes: Partial<ScheduleItem> }) => void;
  'item:start': (payload: { id: string; actualStart: number }) => void;
  'item:done': (payload: { id: string; actualEnd: number }) => void;
  'item:advance': () => void;
  'item:revert': () => void;
  'announcement:send': (payload: { text: string }) => void;
}
