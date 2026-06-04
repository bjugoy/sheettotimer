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
import { createOAuthClient, getAuthUrl, fetchSheetData, writeSheetData } from './googleAuth';

const app = express();
const server = http.createServer(app);

const isProd     = process.env.NODE_ENV === 'production';
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173';

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
    const sub      = event.data.object;
    const priceId  = sub.items.data[0]?.price.id ?? '';
    const plan     = priceToPlan[priceId] ?? 'free';
    await updatePlanByStripeCustomerId(sub.customer as string, plan);
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    await updatePlanByStripeCustomerId(sub.customer as string, 'free');
  }

  res.json({ received: true });
});

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
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
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

  // ── Room join — always viewer; optional auth identifies registered users ──
  socket.on('room:join', async ({ code, name, authToken }) => {
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
  });

  // ── Role change — operator only; target must be a registered user ─────────
  socket.on('room:setRole', ({ targetSocketId, role }) => {
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

// ─── REST: Account management ────────────────────────────────────────────────

app.delete('/api/account', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const verified = await verifyToken(token);
  if (!verified) { res.status(401).json({ error: 'Invalid token' }); return; }
  const ok = await deleteUser(verified.userId);
  if (!ok) { res.status(500).json({ error: 'Failed to delete account' }); return; }
  res.json({ ok: true });
});

// ─── REST: Billing ───────────────────────────────────────────────────────────

app.post('/api/billing/checkout', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const verified = await verifyToken(token);
  if (!verified) { res.status(401).json({ error: 'Invalid token' }); return; }

  const { plan } = req.body as { plan: 'premium1' | 'premium2' };
  const priceId  = PRICE_IDS[plan];
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

    const session = await stripe.checkout.sessions.create({
      customer:              customerId,
      mode:                  'subscription',
      line_items:            [{ price: priceId, quantity: 1 }],
      success_url:           `${CLIENT_URL}/?billing=success`,
      cancel_url:            `${CLIENT_URL}/`,
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[billing/checkout]', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Checkout failed' });
  }
});

// Sync plan from Stripe — called on ?billing=success redirect as a webhook fallback
app.post('/api/billing/sync', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const verified = await verifyToken(token);
  if (!verified) { res.status(401).json({ error: 'Invalid token' }); return; }

  try {
    const customerId = await getStripeCustomerId(verified.userId);
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
    res.status(500).json({ error: err instanceof Error ? err.message : 'Sync failed' });
  }
});

app.post('/api/billing/change-plan', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const verified = await verifyToken(token);
  if (!verified) { res.status(401).json({ error: 'Invalid token' }); return; }

  const { plan } = req.body as { plan: 'premium1' | 'premium2' };
  const priceId  = PRICE_IDS[plan];
  if (!priceId) { res.status(400).json({ error: 'Invalid plan' }); return; }

  try {
    const customerId = await getStripeCustomerId(verified.userId);
    if (!customerId) { res.status(400).json({ error: 'No billing account found' }); return; }

    const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 });
    const sub = subscriptions.data[0];
    if (!sub) { res.status(400).json({ error: 'No active subscription found' }); return; }

    await stripe.subscriptions.update(sub.id, {
      items:              [{ id: sub.items.data[0].id, price: priceId }],
      proration_behavior: 'always_invoice',
    });

    await updatePlanByStripeCustomerId(customerId, plan);
    res.json({ plan });
  } catch (err) {
    console.error('[billing/change-plan]', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Plan change failed' });
  }
});

app.post('/api/billing/portal', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const verified = await verifyToken(token);
  if (!verified) { res.status(401).json({ error: 'Invalid token' }); return; }

  try {
    const customerId = await getStripeCustomerId(verified.userId);
    if (!customerId) { res.status(400).json({ error: 'No billing account found' }); return; }

    const session = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: `${CLIENT_URL}/`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[billing/portal]', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Portal failed' });
  }
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
  if (ids.includes('studio')) return 'premium2';
  if (ids.includes('pro'))    return 'premium1';
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
}, 60 * 60 * 1000); // check every hour

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3001', 10);
server.listen(PORT, () => {
  console.log(`Program Timer server running on http://localhost:${PORT}`);
});
