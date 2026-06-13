import './instrument'; // must be first — Sentry SDK setup
import 'dotenv/config';
import { randomBytes } from 'crypto';
import * as Sentry from '@sentry/node';
import helmet from 'helmet';
import express from 'express';
import http from 'http';
import cors from 'cors';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import pg from 'pg';
import { Server } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  ScheduleItem,
} from '@program-timer/shared';
import { recalculate, PLAN_ROOM_CAPACITY } from '@program-timer/shared';
import rateLimit from 'express-rate-limit';
import { verifyToken, deleteUser, getStripeCustomerId, setStripeCustomerId, updatePlanByStripeCustomerId, getUserEmail } from './auth';
import { stripe, PRICE_IDS, getPriceToPlan } from './stripe';
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
  updateUserRole,
  cleanupExpiredRooms,
  addAnnouncement,
} from './rooms';
import { createOAuthClient, getAuthUrl, checkCanEdit, fetchSheetData, writeSheetData } from './googleAuth';
import { encryptTokens, decryptTokens } from './tokenCrypto';

const app = express();
const server = http.createServer(app);

const isProd     = process.env.NODE_ENV === 'production';
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173';

if (isProd && !process.env.SESSION_SECRET) {
  throw new Error('[startup] SESSION_SECRET env var is required in production. Set it in your Heroku config vars.');
}
if (isProd && !CLIENT_URL.startsWith('https://')) {
  console.warn('[startup] WARNING: CLIENT_URL is not HTTPS — session cookies will be transmitted insecurely:', CLIENT_URL);
}
if (isProd && !process.env.TOKEN_ENCRYPTION_KEY) {
  throw new Error('[startup] TOKEN_ENCRYPTION_KEY is required in production. Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
}

// Support comma-separated origins and automatically include www ↔ non-www variants
const allowedOrigins: string[] = CLIENT_URL.split(',').flatMap(raw => {
  const origin = raw.trim();
  try {
    const u = new URL(origin);
    const alt = u.hostname.startsWith('www.')
      ? `${u.protocol}//${u.hostname.slice(4)}`
      : `${u.protocol}//www.${u.hostname}`;
    return [origin, alt];
  } catch {
    return [origin];
  }
});

// Required for secure cookies to work behind Heroku's reverse proxy
if (isProd) app.set('trust proxy', 1);

app.use(cors({ origin: allowedOrigins, credentials: true }));

// Security headers — CSP disabled (API server, not HTML); crossOriginEmbedderPolicy off for cross-origin use
app.use(helmet({
  contentSecurityPolicy:    false,
  crossOriginEmbedderPolicy: false,
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const apiLimiter     = rateLimit({ windowMs: 15 * 60 * 1000, max: 100,  standardHeaders: true, legacyHeaders: false });
const billingLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20,   standardHeaders: true, legacyHeaders: false });

app.use('/api/', apiLimiter);
app.use('/api/billing/', billingLimiter);

// ── Stripe webhook — must use raw body BEFORE express.json() ─────────────────
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig    = req.headers['stripe-signature'] as string;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) { res.status(500).json({ error: 'Webhook secret not configured' }); return; }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch {
    res.status(400).json({ error: 'Invalid signature' }); return;
  }

  const priceToPlan = getPriceToPlan();

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const sub     = event.data.object;
    const priceId = sub.items.data[0]?.price.id ?? '';
    const plan    = priceToPlan[priceId] ?? 'free';
    await updatePlanByStripeCustomerId(sub.customer as string, plan);
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    await updatePlanByStripeCustomerId(sub.customer as string, 'free');
  }

  // invoice.payment_failed — Stripe will retry automatically via Smart Retries/dunning.
  // The actual downgrade happens via customer.subscription.deleted once all retries are exhausted.
  if (event.type === 'invoice.payment_failed') {
    console.log('[stripe] invoice.payment_failed for customer:', (event.data.object as { customer?: string }).customer);
  }

  res.json({ received: true });
});

app.use(express.json({ limit: '5mb' }));

const PgSession = connectPg(session);
const sessionStore = process.env.DATABASE_URL
  ? new PgSession({
      pool: new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // required for Supabase connections
      }),
      tableName:            'sessions',
      createTableIfMissing: false,
      pruneSessionInterval: 60 * 60,
    })
  : undefined; // falls back to in-memory store in local dev

app.use(
  session({
    store: sessionStore,
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
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
});

// Per-socket event rate limiter (announcements, etc.)
const socketEventCounts = new Map<string, { count: number; resetAt: number }>();
function socketAllow(socketId: string, limit: number, windowMs: number): boolean {
  const now   = Date.now();
  const entry = socketEventCounts.get(socketId);
  if (!entry || now > entry.resetAt) {
    socketEventCounts.set(socketId, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// Per-socket room:join rate limiter — prevents room code brute-force
const joinAttempts = new Map<string, { count: number; resetAt: number }>();
function joinAllow(socketId: string): boolean {
  const now   = Date.now();
  const entry = joinAttempts.get(socketId);
  if (!entry || now > entry.resetAt) {
    joinAttempts.set(socketId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false; // max 10 join attempts per minute
  entry.count++;
  return true;
}

// Per-room announcement rate limiter — caps total throughput regardless of user count
const roomAnnounceCounts = new Map<string, { count: number; resetAt: number }>();
function roomAnnounceAllow(roomCode: string): boolean {
  const now   = Date.now();
  const entry = roomAnnounceCounts.get(roomCode);
  if (!entry || now > entry.resetAt) {
    roomAnnounceCounts.set(roomCode, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 20) return false; // max 20 announcements per room per minute
  entry.count++;
  return true;
}

// Returns the room code if the socket is an operator in their room, null otherwise.
function requireOperator(socketId: string): string | null {
  const code = getRoomForSocket(socketId);
  if (!code) return null;
  const user = getRoomUsers(code).find(u => u.id === socketId);
  if (user?.role !== 'operator') return null;
  return code;
}

// Per-socket CSRF tokens — generated on connect, validated on every mutating event
const socketCsrfTokens = new Map<string, string>();
const MUTATING_EVENTS = new Set([
  'schedule:set', 'schedule:updateItem', 'item:start', 'item:done',
  'item:advance', 'item:revert', 'room:setRole', 'announcement:send',
]);

io.on('connection', (socket) => {
  // Generate and emit a CSRF token for this socket connection
  const csrfToken = randomBytes(32).toString('hex');
  socketCsrfTokens.set(socket.id, csrfToken);
  socket.emit('csrf:token', csrfToken);

  // Reject mutating events that don't carry the correct CSRF token
  socket.use(([event, ...args], next) => {
    if (!MUTATING_EVENTS.has(event as string)) { next(); return; }
    const csrf = (args[0] as Record<string, unknown> | undefined)?._csrf;
    if (!csrf || csrf !== socketCsrfTokens.get(socket.id)) {
      socket.emit('error', 'Invalid session token — please refresh the page');
      return;
    }
    next();
  });
  // ── Room create (requires premium auth token) ────────────────────────────
  socket.on('room:create', async ({ name, authToken }) => {
    try {
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
    } catch (err) {
      console.error('[socket:room:create]', err);
      socket.emit('error', 'Failed to create room');
    }
  });

  // ── Room join — always viewer; optional auth identifies registered users ──
  socket.on('room:join', async ({ code, name, authToken }) => {
    try {
      if (!joinAllow(socket.id)) {
        socket.emit('error', 'Too many join attempts. Please wait a moment.');
        return;
      }
      if (typeof code !== 'string' || !/^[A-Z0-9]{4,8}$/.test(code)) {
        socket.emit('error', 'Invalid room code');
        return;
      }
      let userId: string | undefined;
      if (authToken) {
        const verified = await verifyToken(authToken);
        if (verified) userId = verified.userId;
      }
      const existingRoom = getRoom(code);
      if (!existingRoom) { socket.emit('error', `Room "${code}" not found`); return; }

      // Room owner rejoining gets their operator role back automatically
      const role = (userId && userId === existingRoom.ownerId) ? 'operator' : 'viewer';

      const result = joinRoom(code, socket.id, name, role, userId);
      if ('error' in result) { socket.emit('error', result.error); return; }

      registerSocket(socket.id, code);
      socket.join(code);
      socket.emit('room:joined', { room: existingRoom, user: result });
      io.to(code).emit('room:users', getRoomUsers(code));
    } catch (err) {
      console.error('[socket:room:join]', err);
      socket.emit('error', 'Failed to join room');
    }
  });

  // ── Role change — operator only; target must be a registered user ─────────
  socket.on('room:setRole', ({ targetSocketId, role }) => {
    try {
      const code = getRoomForSocket(socket.id);
      if (!code) return;
      const users     = getRoomUsers(code);
      const requester = users.find(u => u.id === socket.id);
      if (requester?.role !== 'operator') {
        socket.emit('error', 'Only operators can change roles');
        return;
      }
      const target = users.find(u => u.id === targetSocketId);
      if (role === 'operator' && !target?.userId) {
        socket.emit('error', 'Only registered users can be made operators');
        return;
      }
      const updated = updateUserRole(code, targetSocketId, role);
      if (!updated) return;
      io.to(targetSocketId).emit('room:roleChanged', updated);
      io.to(code).emit('room:users', getRoomUsers(code));
    } catch (err) {
      console.error('[socket:room:setRole]', err);
    }
  });

  // ── Schedule set (full replace) ──────────────────────────────────────────
  socket.on('schedule:set', ({ schedule }) => {
    try {
      const code = requireOperator(socket.id);
      if (!code) { socket.emit('error', 'Only operators can modify the schedule'); return; }
      const room = setSchedule(code, schedule);
      if (!room) return;
      io.to(code).emit('schedule:update', room.schedule);
    } catch (err) {
      console.error('[socket:schedule:set]', err);
    }
  });

  // ── Schedule item update ─────────────────────────────────────────────────
  socket.on('schedule:updateItem', ({ id, changes }) => {
    try {
      const code = requireOperator(socket.id);
      if (!code) { socket.emit('error', 'Only operators can modify the schedule'); return; }
      const room = getRoom(code);
      if (!room) return;
      // Whitelist allowed keys to prevent arbitrary property injection
      const ALLOWED: Set<string> = new Set([
        'title','notes','durationMs','scheduledStart','scheduledEnd',
        'status','actualStart','actualEnd',
      ]);
      const safeChanges = Object.fromEntries(
        Object.entries(changes as Record<string, unknown>).filter(([k]) => ALLOWED.has(k))
      ) as Partial<ScheduleItem>;
      const schedule = room.schedule.map(item =>
        item.id === id ? { ...item, ...safeChanges } : item
      );
      const recalced = recalculate(schedule, Date.now());
      const updated  = updateRoom(code, { schedule: recalced });
      if (updated) io.to(code).emit('schedule:update', updated.schedule);
    } catch (err) {
      console.error('[socket:schedule:updateItem]', err);
    }
  });

  // ── Advance to next item ─────────────────────────────────────────────────
  socket.on('item:advance', (_payload) => {
    try {
      const code = requireOperator(socket.id);
      if (!code) { socket.emit('error', 'Only operators can advance items'); return; }
      const room = getRoom(code);
      if (!room) return;

      const now         = Date.now();
      const currentItem = room.schedule[room.currentIndex];
      if (!currentItem) return;

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
      const updated  = updateRoom(code, { schedule: recalced, currentIndex: newIndex });
      if (updated) {
        io.to(code).emit('schedule:update', updated.schedule);
        io.to(code).emit('item:advance', { currentIndex: newIndex, actualEnd: now });
      }
    } catch (err) {
      console.error('[socket:item:advance]', err);
    }
  });

  // ── Mark item started ────────────────────────────────────────────────────
  socket.on('item:start', ({ id, actualStart }) => {
    try {
      const code = requireOperator(socket.id);
      if (!code) { socket.emit('error', 'Only operators can control the timer'); return; }
      const room = getRoom(code);
      if (!room) return;
      const idx = room.schedule.findIndex(i => i.id === id);
      if (idx === -1) return;
      const schedule = room.schedule.map((item, i) =>
        i === idx ? { ...item, status: 'active' as const, actualStart } : item
      );
      const recalced = recalculate(schedule, actualStart);
      const updated  = updateRoom(code, { schedule: recalced, currentIndex: idx });
      if (updated) io.to(code).emit('schedule:update', updated.schedule);
    } catch (err) {
      console.error('[socket:item:start]', err);
    }
  });

  // ── Mark item done ───────────────────────────────────────────────────────
  socket.on('item:done', ({ id, actualEnd }) => {
    try {
      const code = requireOperator(socket.id);
      if (!code) { socket.emit('error', 'Only operators can control the timer'); return; }
      const room = getRoom(code);
      if (!room) return;
      const schedule = room.schedule.map(item =>
        item.id === id ? { ...item, status: 'done' as const, actualEnd } : item
      );
      const recalced = recalculate(schedule, actualEnd);
      const updated  = updateRoom(code, { schedule: recalced });
      if (updated) io.to(code).emit('schedule:update', updated.schedule);
    } catch (err) {
      console.error('[socket:item:done]', err);
    }
  });

  // ── Revert to previous item ─────────────────────────────────────────────
  socket.on('item:revert', (_payload) => {
    try {
      const code = requireOperator(socket.id);
      if (!code) { socket.emit('error', 'Only operators can control the timer'); return; }
      const room = getRoom(code);
      if (!room) return;

      const now       = Date.now();
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
      const updated  = updateRoom(code, { schedule: recalced, currentIndex: prevIndex });
      if (updated) {
        io.to(code).emit('schedule:update', updated.schedule);
        io.to(code).emit('item:revert', { currentIndex: prevIndex });
      }
    } catch (err) {
      console.error('[socket:item:revert]', err);
    }
  });

  // ── Announcement — rate limited + sanitized ──────────────────────────────
  socket.on('announcement:send', ({ text }) => {
    try {
      if (!socketAllow(socket.id, 5, 10_000)) {
        socket.emit('error', 'Too many announcements. Please slow down.');
        return;
      }
      const code = getRoomForSocket(socket.id);
      if (!code) return;
      if (!roomAnnounceAllow(code)) {
        socket.emit('error', 'Room announcement limit reached. Please wait.');
        return;
      }
      const room = getRoom(code);
      if (!room) return;
      const raw = String(text ?? '').trim();
      // Reject any HTML — don't try to sanitize, just refuse
      if (raw.includes('<') || raw.includes('>')) {
        socket.emit('error', 'Announcements cannot contain HTML characters');
        return;
      }
      const sanitized = raw.slice(0, 280);
      const users  = getRoomUsers(code);
      const sender = users.find(u => u.id === socket.id);
      const ann    = addAnnouncement(code, sanitized, sender?.name ?? 'Unknown');
      io.to(code).emit('announcement', ann);
    } catch (err) {
      console.error('[socket:announcement:send]', err);
    }
  });

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    socketCsrfTokens.delete(socket.id);
    socketEventCounts.delete(socket.id);
    joinAttempts.delete(socket.id);
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
    // AES-256-GCM encrypted JSON — never stored as plaintext
    googleTokensEnc?: string;
  }
}

// Helpers so token crypto is never done inline across multiple routes
function getSessionTokens(req: express.Request) {
  if (!req.session.googleTokensEnc) return null;
  try { return decryptTokens(req.session.googleTokensEnc); } catch { return null; }
}
function setSessionTokens(req: express.Request, tokens: { access_token: string | null; refresh_token: string | null }) {
  req.session.googleTokensEnc = encryptTokens(tokens);
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
    setSessionTokens(req, {
      access_token:  tokens.access_token  ?? null,
      refresh_token: tokens.refresh_token ?? null,
    });
    res.redirect(`${CLIENT_URL}?auth=success`);
  } catch (e) {
    res.redirect(`${CLIENT_URL}?auth=error`);
  }
});

app.get('/auth/status', (req, res) => {
  const tokens = getSessionTokens(req);
  res.json({ authenticated: !!tokens?.access_token });
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ─── REST: Account management ────────────────────────────────────────────────

app.delete('/api/account', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const verified = await verifyToken(token);
  if (!verified) { res.status(401).json({ error: 'Invalid token' }); return; }

  // Cancel any active Stripe subscriptions before deleting the account
  try {
    const customerId = await getStripeCustomerId(verified.userId);
    if (customerId) {
      const subs = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 10 });
      await Promise.all(subs.data.map(sub => stripe.subscriptions.cancel(sub.id)));
    }
  } catch (err) {
    console.error('[account/delete] Stripe cancellation failed:', err);
    // Non-fatal — proceed with account deletion
  }

  const ok = await deleteUser(verified.userId);
  if (!ok) { res.status(500).json({ error: 'Failed to delete account' }); return; }
  res.json({ ok: true });
});

// ─── REST: Billing ───────────────────────────────────────────────────────────

// Look up a Stripe customer ID for a user. Primary source is the stored
// stripe_customer_id in the profile. If missing (e.g. setStripeCustomerId
// failed after checkout), fall back to a metadata search — safer than email
// lookup because supabase_id is unique, unlike email addresses.
async function resolveStripeCustomerId(userId: string): Promise<string | null> {
  const stored = await getStripeCustomerId(userId);
  if (stored) return stored;

  const results = await stripe.customers.search({
    query: `metadata['supabase_id']:'${userId}'`,
    limit: 1,
  });
  if (results.data.length > 0) {
    const customerId = results.data[0].id;
    await setStripeCustomerId(userId, customerId); // backfill so future lookups are instant
    return customerId;
  }
  return null;
}

app.post('/api/billing/checkout', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const verified = await verifyToken(token);
  if (!verified) { res.status(401).json({ error: 'Invalid token' }); return; }

  const { plan, interval = 'monthly' } = req.body as { plan: 'premium1' | 'premium2'; interval?: 'monthly' | 'yearly' };
  if (interval !== 'monthly' && interval !== 'yearly') { res.status(400).json({ error: 'Invalid interval' }); return; }
  const priceId = PRICE_IDS[plan]?.[interval];
  if (!priceId) { res.status(400).json({ error: 'Invalid plan' }); return; }

  try {
    let customerId = await getStripeCustomerId(verified.userId);
    if (!customerId) {
      const email    = await getUserEmail(verified.userId);
      const customer = await stripe.customers.create({
        email:    email ?? undefined,
        metadata: { supabase_id: verified.userId },
      });
      customerId = customer.id;
      await setStripeCustomerId(verified.userId, customerId);
    }

    // 5-minute window key: same user+plan+interval within 5 min reuses the session
    const windowKey = Math.floor(Date.now() / (5 * 60 * 1000));
    const idempotencyKey = `checkout-${verified.userId}-${plan}-${interval}-${windowKey}`;

    const session = await stripe.checkout.sessions.create({
      customer:              customerId,
      mode:                  'subscription',
      line_items:            [{ price: priceId, quantity: 1 }],
      success_url:           `${CLIENT_URL}/?billing=success`,
      cancel_url:            `${CLIENT_URL}/`,
      allow_promotion_codes: true,
    }, { idempotencyKey });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[billing/checkout]', err);
    res.status(500).json({ error: 'Checkout failed. Please try again.' });
  }
});

// Sync plan from Stripe — called on ?billing=success redirect as a webhook fallback
app.post('/api/billing/sync', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const verified = await verifyToken(token);
  if (!verified) { res.status(401).json({ error: 'Invalid token' }); return; }

  try {
    const customerId = await resolveStripeCustomerId(verified.userId);

    if (!customerId) { res.json({ plan: 'free' }); return; }

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status:   'active',
      limit:    1,
    });

    const priceToPlan = getPriceToPlan();
    const priceId     = subscriptions.data[0]?.items.data[0]?.price.id ?? '';
    const plan        = priceToPlan[priceId] ?? 'free';

    await updatePlanByStripeCustomerId(customerId, plan);
    res.json({ plan });
  } catch (err) {
    console.error('[billing/sync]', err);
    res.status(500).json({ error: 'Sync failed. Please try again.' });
  }
});

app.post('/api/billing/portal', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const verified = await verifyToken(token);
  if (!verified) { res.status(401).json({ error: 'Invalid token' }); return; }

  try {
    const customerId = await resolveStripeCustomerId(verified.userId);

    if (!customerId) { res.status(400).json({ error: 'No billing account found' }); return; }

    const session = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: `${CLIENT_URL}/`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[billing/portal]', err);
    res.status(500).json({ error: 'Could not open billing portal. Please try again.' });
  }
});

// ─── REST: Fetch Google Sheet ─────────────────────────────────────────────────

app.post('/api/sheets/fetch', async (req, res) => {
  const authHeader = req.headers.authorization?.replace('Bearer ', '');
  if (authHeader) {
    const verified = await verifyToken(authHeader);
    if (!verified || verified.plan === 'free') {
      res.status(403).json({ error: 'Google Sheets integration requires a Pro or Studio plan' });
      return;
    }
  }
  const tokens = getSessionTokens(req);
  if (!tokens?.access_token) {
    res.status(401).json({ error: 'Not authenticated with Google' });
    return;
  }
  const { spreadsheetId, range } = req.body as { spreadsheetId: string; range?: string };
  if (!spreadsheetId || typeof spreadsheetId !== 'string') {
    res.status(400).json({ error: 'Missing spreadsheetId' });
    return;
  }
  if (!/^[a-zA-Z0-9_-]{10,100}$/.test(spreadsheetId)) {
    res.status(400).json({ error: 'Invalid spreadsheet ID format' });
    return;
  }
  try {
    const { canEdit, freshTokens: editFreshTokens } = await checkCanEdit(tokens, spreadsheetId);
    if (editFreshTokens) setSessionTokens(req, editFreshTokens);
    if (!canEdit) {
      res.status(403).json({ error: 'You don\'t have edit access to this sheet. Open it in Google Sheets and make sure you\'re an editor.' });
      return;
    }
    const { headers, rows, freshTokens } = await fetchSheetData(tokens, spreadsheetId, range);
    if (freshTokens) setSessionTokens(req, freshTokens);
    res.json({ headers, rows });
  } catch (e: unknown) {
    console.error('[sheets/fetch]', e);
    res.status(500).json({ error: 'Failed to fetch sheet data. Check your Google Sheets connection.' });
  }
});

// ─── REST: Write back to Google Sheet ────────────────────────────────────────

app.post('/api/sheets/write', async (req, res) => {
  const authHeader = req.headers.authorization?.replace('Bearer ', '');
  if (authHeader) {
    const verified = await verifyToken(authHeader);
    if (!verified || verified.plan === 'free') {
      res.status(403).json({ error: 'Google Sheets integration requires a Pro or Studio plan' });
      return;
    }
  }
  const tokens = getSessionTokens(req);
  if (!tokens?.access_token) {
    res.status(401).json({ error: 'Not authenticated with Google' });
    return;
  }
  const { spreadsheetId, range, values } = req.body as {
    spreadsheetId: string;
    range: string;
    values: (string | number | null)[][];
  };
  if (!spreadsheetId || typeof spreadsheetId !== 'string' || !range || !values) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  if (!/^[a-zA-Z0-9_-]{10,100}$/.test(spreadsheetId)) {
    res.status(400).json({ error: 'Invalid spreadsheet ID format' });
    return;
  }
  if (!Array.isArray(values) || !values.every(Array.isArray) || values.length > 10_000) {
    res.status(400).json({ error: 'Invalid values format' });
    return;
  }
  try {
    const { freshTokens } = await writeSheetData(tokens, spreadsheetId, range, values);
    if (freshTokens) setSessionTokens(req, freshTokens);
    res.json({ ok: true });
  } catch (e: unknown) {
    console.error('[sheets/write]', e);
    res.status(500).json({ error: 'Failed to write to sheet. Check your Google Sheets connection.' });
  }
});

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ ok: true }));

// ─── Room expiry — clean up sessions older than 24 h ─────────────────────────

const ROOM_MAX_AGE_MS = 24 * 60 * 60 * 1000;

setInterval(() => {
  const expired = cleanupExpiredRooms(ROOM_MAX_AGE_MS);
  for (const code of expired) {
    io.to(code).emit('session:ended', 'This session expired after 24 hours.');
    io.socketsLeave(code);
  }
  if (expired.length > 0) {
    console.log(`[cleanup] Expired ${expired.length} room(s): ${expired.join(', ')}`);
  }
}, 60 * 60 * 1000);

// ─── 404 catch-all ───────────────────────────────────────────────────────────

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ─── Sentry Express error handler — must be after all routes ─────────────────

Sentry.setupExpressErrorHandler(app);

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3001', 10);
server.listen(PORT, () => {
  console.log(`Program Timer server running on http://localhost:${PORT}`);
});

// ─── Global error guards — prevent silent crashes ────────────────────────────

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
