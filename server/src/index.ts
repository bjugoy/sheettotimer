import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import session from 'express-session';
import { Server } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  ScheduleItem,
} from '@program-timer/shared';
import { recalculate, PLAN_ROOM_CAPACITY } from '@program-timer/shared';
import { verifyToken } from './auth';
import {
  createRoom,
  getRoom,
  setSchedule,
  advanceItem,
  joinRoom,
  leaveRoom,
  getRoomUsers,
  registerSocket,
  unregisterSocket,
  getRoomForSocket,
  updateRoom,
  addAnnouncement,
} from './rooms';
import { createOAuthClient, getAuthUrl, fetchSheetData, writeSheetData } from './googleAuth';

const app = express();
const server = http.createServer(app);

const isProd     = process.env.NODE_ENV === 'production';
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173';

// Required for secure cookies to work behind Heroku's reverse proxy
if (isProd) app.set('trust proxy', 1);

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(
  session({
    secret: process.env.SESSION_SECRET ?? 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure:   isProd,
      sameSite: isProd ? 'none' : 'lax',   // 'none' required for cross-origin (Vercel → Heroku)
      httpOnly: true,
      maxAge:   24 * 60 * 60 * 1000,
    },
  })
);

// ─── Socket.io ───────────────────────────────────────────────────────────────

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST'], credentials: true },
});

io.on('connection', (socket) => {
  // ── Room create (requires premium auth token) ────────────────────────────
  socket.on('room:create', async ({ name, authToken }) => {
    const verified = await verifyToken(authToken);
    if (!verified) {
      socket.emit('error', 'Authentication required to create a room');
      return;
    }
    const capacity = PLAN_ROOM_CAPACITY[verified.plan];
    if (capacity === 0) {
      socket.emit('error', 'A premium plan is required to create a room');
      return;
    }

    const room   = createRoom(verified.userId, capacity);
    const result = joinRoom(room.code, socket.id, name, 'operator');
    if ('error' in result) { socket.emit('error', result.error); return; }

    registerSocket(socket.id, room.code);
    socket.join(room.code);
    socket.emit('room:joined', { room, user: result });
    io.to(room.code).emit('room:users', getRoomUsers(room.code));
  });

  // ── Room join (open to all — no auth required) ───────────────────────────
  socket.on('room:join', ({ code, name, role }) => {
    const result = joinRoom(code, socket.id, name, role);
    if ('error' in result) { socket.emit('error', result.error); return; }

    const room = getRoom(code)!;
    registerSocket(socket.id, code);
    socket.join(code);
    socket.emit('room:joined', { room, user: result });
    io.to(code).emit('room:users', getRoomUsers(code));
  });

  // ── Schedule set (full replace) ──────────────────────────────────────────
  socket.on('schedule:set', (schedule) => {
    const code = getRoomForSocket(socket.id);
    if (!code) return;
    const room = setSchedule(code, schedule);
    if (!room) return;
    io.to(code).emit('schedule:update', room.schedule);
  });

  // ── Schedule item update ─────────────────────────────────────────────────
  socket.on('schedule:updateItem', ({ id, changes }) => {
    const code = getRoomForSocket(socket.id);
    if (!code) return;
    const room = getRoom(code);
    if (!room) return;
    const schedule = room.schedule.map(item =>
      item.id === id ? { ...item, ...changes } : item
    );
    const recalced = recalculate(schedule, Date.now());
    const updated = updateRoom(code, { schedule: recalced });
    if (updated) io.to(code).emit('schedule:update', updated.schedule);
  });

  // ── Advance to next item ─────────────────────────────────────────────────
  socket.on('item:advance', () => {
    const code = getRoomForSocket(socket.id);
    if (!code) return;
    const room = getRoom(code);
    if (!room) return;

    const now = Date.now();
    const currentItem = room.schedule[room.currentIndex];
    if (!currentItem) return;

    // Mark current done, start next
    const newIndex = Math.min(room.currentIndex + 1, room.schedule.length - 1);
    const schedule = room.schedule.map((item, i) => {
      if (i === room.currentIndex) {
        return { ...item, status: 'done' as const, actualEnd: now };
      }
      if (i === newIndex && room.currentIndex !== newIndex) {
        return { ...item, status: 'active' as const, actualStart: now };
      }
      return item;
    });
    const recalced = recalculate(schedule, now);
    const updated = updateRoom(code, { schedule: recalced, currentIndex: newIndex });
    if (updated) {
      io.to(code).emit('schedule:update', updated.schedule);
      io.to(code).emit('item:advance', { currentIndex: newIndex, actualEnd: now });
    }
  });

  // ── Mark item started ────────────────────────────────────────────────────
  socket.on('item:start', ({ id, actualStart }) => {
    const code = getRoomForSocket(socket.id);
    if (!code) return;
    const room = getRoom(code);
    if (!room) return;
    const idx = room.schedule.findIndex(i => i.id === id);
    if (idx === -1) return;
    const schedule = room.schedule.map((item, i) =>
      i === idx ? { ...item, status: 'active' as const, actualStart } : item
    );
    const recalced = recalculate(schedule, actualStart);
    const updated = updateRoom(code, { schedule: recalced, currentIndex: idx });
    if (updated) io.to(code).emit('schedule:update', updated.schedule);
  });

  // ── Mark item done ───────────────────────────────────────────────────────
  socket.on('item:done', ({ id, actualEnd }) => {
    const code = getRoomForSocket(socket.id);
    if (!code) return;
    const room = getRoom(code);
    if (!room) return;
    const schedule = room.schedule.map(item =>
      item.id === id ? { ...item, status: 'done' as const, actualEnd } : item
    );
    const recalced = recalculate(schedule, actualEnd);
    const updated = updateRoom(code, { schedule: recalced });
    if (updated) io.to(code).emit('schedule:update', updated.schedule);
  });

  // ── Revert to previous item ─────────────────────────────────────────────
  socket.on('item:revert', () => {
    const code = getRoomForSocket(socket.id);
    if (!code) return;
    const room = getRoom(code);
    if (!room) return;

    const now = Date.now();
    const prevIndex = Math.max(room.currentIndex - 1, 0);

    const schedule = room.schedule.map((item, i) => {
      if (i === room.currentIndex) {
        return { ...item, status: 'not_started' as const, actualStart: undefined, actualEnd: undefined };
      }
      if (i === prevIndex && prevIndex < room.currentIndex) {
        return { ...item, status: 'active' as const, actualEnd: undefined };
      }
      return item;
    });

    const recalced = recalculate(schedule, now);
    const updated = updateRoom(code, { schedule: recalced, currentIndex: prevIndex });
    if (updated) {
      io.to(code).emit('schedule:update', updated.schedule);
      io.to(code).emit('item:revert', { currentIndex: prevIndex });
    }
  });

  // ── Announcement ─────────────────────────────────────────────────────────
  socket.on('announcement:send', ({ text }) => {
    const code = getRoomForSocket(socket.id);
    if (!code) return;
    const room = getRoom(code);
    if (!room) return;
    const users = getRoomUsers(code);
    const sender = users.find(u => u.id === socket.id);
    const ann = addAnnouncement(code, text, sender?.name ?? 'Unknown');
    io.to(code).emit('announcement', ann);
  });

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const code = unregisterSocket(socket.id);
    if (code) {
      leaveRoom(code, socket.id);
      io.to(code).emit('room:users', getRoomUsers(code));
    }
  });
});

// ─── REST: Google OAuth ───────────────────────────────────────────────────────

declare module 'express-session' {
  interface SessionData {
    googleTokens?: { access_token?: string | null; refresh_token?: string | null };
  }
}

app.get('/auth/google', (_req, res) => {
  const client = createOAuthClient();
  res.redirect(getAuthUrl(client));
});

app.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) {
    res.status(400).json({ error: 'Missing code' });
    return;
  }
  try {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    req.session.googleTokens = {
      access_token: tokens.access_token ?? null,
      refresh_token: tokens.refresh_token ?? null,
    };
    res.redirect(`${CLIENT_URL}?auth=success`);
  } catch (e) {
    res.redirect(`${CLIENT_URL}?auth=error`);
  }
});

app.get('/auth/status', (req, res) => {
  res.json({ authenticated: !!req.session.googleTokens?.access_token });
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ─── REST: Fetch Google Sheet ─────────────────────────────────────────────────

app.post('/api/sheets/fetch', async (req, res) => {
  const accessToken = req.session.googleTokens?.access_token;
  if (!accessToken) {
    res.status(401).json({ error: 'Not authenticated with Google' });
    return;
  }
  const { spreadsheetId, range } = req.body as { spreadsheetId: string; range?: string };
  if (!spreadsheetId) {
    res.status(400).json({ error: 'Missing spreadsheetId' });
    return;
  }
  try {
    const data = await fetchSheetData(accessToken, spreadsheetId, range);
    res.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

// ─── REST: Write back to Google Sheet ────────────────────────────────────────

app.post('/api/sheets/write', async (req, res) => {
  const accessToken = req.session.googleTokens?.access_token;
  if (!accessToken) {
    res.status(401).json({ error: 'Not authenticated with Google' });
    return;
  }
  const { spreadsheetId, range, values } = req.body as {
    spreadsheetId: string;
    range: string;
    values: (string | number | null)[][];
  };
  if (!spreadsheetId || !range || !values) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  try {
    await writeSheetData(accessToken, spreadsheetId, range, values);
    res.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
});

// ─── RevenueCat webhook ───────────────────────────────────────────────────────
//
// Setup in RC Dashboard → Integrations → Webhooks → Add endpoint:
//   URL:    https://your-domain.com/webhooks/revenuecat
//   Header: Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>
//
// Event types that change the plan:
//   INITIAL_PURCHASE / RENEWAL / PRODUCT_CHANGE → activate plan
//   EXPIRATION / BILLING_ISSUE                  → revert to free

type RCEventType =
  | 'INITIAL_PURCHASE' | 'RENEWAL' | 'PRODUCT_CHANGE' | 'SUBSCRIBER_ALIAS'
  | 'CANCELLATION' | 'EXPIRATION' | 'BILLING_ISSUE' | 'TRANSFER';

interface RCWebhookPayload {
  api_version: string;
  event: {
    type: RCEventType;
    app_user_id: string;
    aliases?: string[];
    entitlement_ids?: string[];
  };
}

const ACTIVATE_EVENTS: RCEventType[] = ['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE'];
const EXPIRE_EVENTS:   RCEventType[] = ['EXPIRATION', 'BILLING_ISSUE'];

function entitlementsToPlan(ids: string[]): import('@program-timer/shared').Plan {
  if (ids.includes('enterprise')) return 'premium3';
  if (ids.includes('studio'))     return 'premium2';
  if (ids.includes('pro'))        return 'premium1';
  return 'free';
}

app.post('/webhooks/revenuecat', async (req, res) => {
  // Verify the shared secret (set REVENUECAT_WEBHOOK_SECRET in server/.env)
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (secret) {
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${secret}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  const payload = req.body as RCWebhookPayload;
  const event   = payload?.event;
  if (!event?.app_user_id) { res.json({ ok: true }); return; }

  const userId = event.app_user_id;

  // Import lazily to avoid circular deps
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = process.env.SUPABASE_URL ?? '';
  const supabaseKey = process.env.SUPABASE_SECRET_KEY ?? '';
  if (!supabaseUrl || !supabaseKey) { res.json({ ok: true }); return; }

  const admin = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (ACTIVATE_EVENTS.includes(event.type)) {
    const plan = entitlementsToPlan(event.entitlement_ids ?? []);
    await admin.from('profiles').update({ plan }).eq('id', userId);
    console.log(`[rc webhook] ${event.type} → user ${userId} → plan ${plan}`);
  } else if (EXPIRE_EVENTS.includes(event.type)) {
    await admin.from('profiles').update({ plan: 'free' }).eq('id', userId);
    console.log(`[rc webhook] ${event.type} → user ${userId} → plan free`);
  }

  res.json({ ok: true });
});

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ ok: true }));

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3001', 10);
server.listen(PORT, () => {
  console.log(`Program Timer server running on http://localhost:${PORT}`);
});
