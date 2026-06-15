# SheetToTimer — Handover

## Stack

- **Frontend**: React + TypeScript + Vite, deployed on Vercel at `sheettotimer.com`
- **Backend**: Node.js + Express + Socket.io, deployed on Heroku at `sheettotimer-api-2c7cf3229f66.herokuapp.com`
- **Auth**: Supabase v2 (`@supabase/supabase-js ^2.106.2`) — email/password + Google OAuth
- **Database**: Supabase Postgres — `profiles` table holds `plan` column
- **Payments**: Stripe — checkout + billing portal
- **State**: Zustand stores (`useAuthStore`, `useScheduleStore`, `useSessionStore`)
- **Sessions**: `express-session` + `connect-pg-simple` on Heroku (for Google Sheets OAuth only)

---

## Auth initialization — how it works

`client/src/store/authStore.ts` — the only place auth state is managed.

On `initialize()` (called once from `AuthProvider` in `main.tsx`):

1. An 8-second fallback timer is set to unblock the app if everything else fails.
2. `supabase.auth.onAuthStateChange` is subscribed. Handles all events:
   - Any event with `session?.user` → fetch plan → set user/plan/loading.
   - `SIGNED_OUT` → double-check with `getSession()` before acting (SIGNED_OUT fires spuriously when the page regains focus after a popup closes).
   - `INITIAL_SESSION` with null → ignored; `getSession()` below is authoritative.
3. `supabase.auth.getSession()` is called. Supabase's own method; handles token refresh internally. It awaits the internal `_initializePromise` (which already ran `_recoverAndRefresh`) so there is no double-refresh race.
   - Session exists → fetch plan → set user/plan/loading.
   - Null → clear user (only if `onAuthStateChange` hasn't already signed us in).
   - Throws → unblock loading without signing out.
4. `_oauthCallback` is true when there is an `access_token` in the URL hash or a `code` query param (PKCE OAuth callback or password reset). In that case `getSession()` is skipped and we wait for `onAuthStateChange` to fire `SIGNED_IN`.

**Why `fetchPlan` uses `get().plan` as fallback** (not `'free'`): `onAuthStateChange` can fire after `getSession()` has already set the correct plan. If `fetchPlan` fails in the callback, falling back to `'free'` would overwrite the correct value. Using `get().plan` preserves whatever is already in the store.

**Critical past mistake to never repeat**: Earlier versions introduced a `_readStoredSession()` function that read localStorage manually and an early return — `if (!_storedSession) { set({ loading: false }); return; }` — that skipped `getSession()` entirely if the manual read found nothing. Any failure in the localStorage read (wrong key, missing `user` field, parse error) caused an immediate sign-out on every page refresh. Deleted in commit `7690f78`. Never bypass `getSession()`.

---

## Routing

`client/src/main.tsx`

| Path | Component | Behaviour |
|------|-----------|-----------|
| `/` | `RootRedirect` | Checks `?room=CODE` first — if present, navigate to `/app` with `state.joinCode` regardless of auth. Otherwise: logged in → `/dashboard`, logged out → `/landing`. Spinner while loading. |
| `/landing` | `LandingPage` | Public. Redirects to `/dashboard` if user resolves to logged-in on mount. |
| `/app` | `App` | Public. Unauthenticated users see the join screen. |
| `/dashboard` | `DashboardPage` | Guarded — `!authLoading && !user` → 1.5s grace → redirect to `/landing`. |
| `/privacy`, `/terms` | Static pages | Public. |

**Room invite links**: The share feature copies `${window.location.origin}?room=CODE`. `RootRedirect` intercepts `?room=` and sends users to `/app` with the code pre-filled in state, so guests can join without a Supabase account.

**Rule**: unauthenticated users are never auto-sent to `/dashboard` or timer view unless they arrive via a room code.

---

## Google Sheets OAuth

Uses a **popup window** (not full-page redirect) to avoid losing the Supabase session.

1. `useGoogleSheets.ts` → `startOAuth()` opens a popup to `/auth/google` on the Heroku server.
2. Server handles the Google OAuth exchange, stores tokens in express-session (inside `session.save()` callback to avoid race), then serves an HTML page that calls `window.close()`.
3. Client polls `popup.closed` every 500ms. When closed, calls `checkAuthStatus()` to update `googleAuthenticated` in the schedule store.

**Mobile fallback**: On mobile browsers `window.open()` with size parameters is often blocked (returns `null`). In that case `startOAuth()` falls back to `window.location.href = /auth/google` — a full-page redirect through the OAuth flow. The callback page's `window.close()` will be a no-op on a tab not opened by script, so after 800ms it redirects to `CLIENT_URL/?auth=success`. `App.tsx` calls `checkAuthStatus()` on every mount, which picks up the session and updates `googleAuthenticated`.

**Why not `postMessage`**: Google sets `Cross-Origin-Opener-Policy: same-origin` on its OAuth pages, which nullifies `window.opener` in the popup.

**Why spurious Supabase sign-outs happened after popup close**: When the popup closes, the browser fires a visibility-change event. Supabase's `_handleVisibilityChange` triggers a token refresh, which can emit a transient `SIGNED_OUT`. Fixed by the double-check in the `SIGNED_OUT` handler.

---

## Billing (Stripe)

`client/src/lib/billing.ts`

- `startCheckout(token)` — posts to `/api/billing/checkout` with `returnUrl: window.location.href`. Stripe redirects back to the originating page with `?billing=success`.
- `openBillingPortal(token)` — same pattern with `/api/billing/portal`.
- `?billing=success` is handled in `AuthProvider` (`main.tsx`). Strips the param and calls `syncPlanFromStripe` to pull the updated plan from Stripe directly (the Stripe webhook updates `profiles.plan` asynchronously so reading Supabase immediately after checkout may return the old value).

---

## Real-time rooms (Socket.io)

`client/src/hooks/useSocket.ts`

- `room:create` — operator only, requires a valid Supabase `authToken`.
- `room:join` — anyone. Guests without a token join as viewers and cannot be promoted to operator.
- **Ordering in `room:joined` handler**: `setUser` and `setItems` are called **before** `setRoom`. The view-transition `useEffect` in `App.tsx` watches `roomCode`. When `roomCode` is set, it reads `items.length` and `isOperator`. Setting `roomCode` last ensures those values are already correct when the effect fires. Getting this order wrong causes viewers to get stuck on the load screen.
- Operators auto-rejoin on page refresh via a `sessionStorage` entry (`stt-session`) that is written on `room:joined` and cleared on `session:ended`.

---

## Dashboard

`client/src/pages/DashboardPage.tsx`

- Productions and events are cached in module-level variables (`_prodsCache`, `_eventsCache`) so navigating back from the timer shows the list instantly without a spinner.
- `loadProds()` is called only when `user && !authLoading` — waits for the token to be fully refreshed before making API calls. Without this guard, the call fires with a stale (expired) access token and gets a 401.
- Auth guard: `!authLoading && !user` → 1.5-second timer → redirect to `/landing`. The delay absorbs transient sign-out events.

---

## Known subtleties

1. **`onAuthStateChange` subscription is never cleaned up.** `initialize()` registers a listener but the store never calls `unsubscribe()`. In production this is fine (singleton store, called once). In React StrictMode dev, effects run twice — two listeners are created. Not harmful but produces duplicate `fetchPlan` calls on every auth event.

2. **Heroku session store**: `connect-pg-simple` persists sessions in Postgres so they survive dyno restarts on deploy. `SESSION_SECRET` supports comma-separated values (`NEW,OLD`) for rotation — the first signs, all verify.

3. **Supabase token lifetime**: Access tokens expire after 1 hour (default). `getSession()` auto-refreshes using the refresh token. If the refresh token is also expired (Supabase project default: 7 days), the user is signed out — this is correct behaviour, not a bug.

4. **Google Sheets tokens are server-side only**: Stored in the express-session (Postgres-backed). If the session is cleared or the user switches browsers, they must reconnect Google Sheets. Completely separate from Supabase auth.

5. **`?code=` detection for `_oauthCallback`**: Supabase PKCE flow appends `?code=...` to the redirect URL after Google sign-in. The `_oauthCallback` flag catches this and prevents `getSession()` from running before the PKCE exchange completes. If any other feature were to add `?code=` to a URL, it would accidentally trigger this path.

---

## Scalability risks

These are not bugs today but will become problems as user numbers grow. Listed by urgency.

### 1. In-memory room storage — bites on every deploy

`server/src/rooms.ts` stores all rooms in a plain `Map` in the Node.js process. Two consequences:
- **Deploys kill all active sessions.** Every Heroku deploy restarts the dyno and wipes the Map. Every operator and viewer in a live room gets disconnected with no recovery path.
- **Cannot scale horizontally.** Two dynos = two Maps. A room created on dyno A is invisible to a user whose socket lands on dyno B.

**Fix when needed:** Replace the Map with Redis for room storage, and add the Socket.io Redis adapter so events route across dynos. `connect-pg-simple` (already in place for Google Sheets sessions) shows the pattern for externalising server state.

### 2. No rate limiting on mutating socket events

`schedule:set`, `item:advance`, `item:revert`, `item:start`, `item:done` have no rate limits. A malicious operator could spam `schedule:set` with large payloads in a tight loop — each one is stored in memory and broadcast to every viewer in the room. The join limiter (10/min per socket) and announcement limiter (20/room/min) exist but the expensive events are unprotected.

**Fix when needed:** Wrap all mutating events in a per-socket rate limiter (e.g. `rate-limiter-flexible`). Add a cap on schedule item count and string lengths inside the `schedule:set` handler.

### 3. No schedule payload validation

`schedule:set` accepts whatever array the client sends. Nothing checks item count, field types, or string lengths. A crafted payload with thousands of items or MB-sized strings gets stored in memory and echoed to all viewers. (`schedule:updateItem` does whitelist field names but does not validate content.)

**Fix when needed:** Validate item count (e.g. max 500), and enforce a string length cap on `title` and `notes` inside `schedule:set`.

### 4. Memory leak in rate-limiter Maps

`joinAttempts` and `roomAnnounceCounts` in `server/src/index.ts` are Maps that grow indefinitely. Entries are only evicted when they happen to be accessed after their `resetAt` time. A bot opening thousands of unique socket connections would fill the Map with entries that are never touched again.

**Fix when needed:** Add a `setInterval` that sweeps expired entries, or replace with `rate-limiter-flexible` which handles TTL automatically.

### 5. Supabase connection pressure

Every API call (plan check, productions load, etc.) consumes a Supabase Postgres connection. Supabase routes through pgBouncer so it is somewhat protected, but under sustained concurrent traffic pool exhaustion happens before row limits. `fetchPlan` is called on every token refresh (once per user per hour), adding a DB round-trip per active user.

**Fix when needed:** Cache the plan in the auth store for the session duration (it already is) and avoid redundant fetches. At high scale, move plan checks to a dedicated lightweight endpoint backed by a connection pool sized appropriately.

### 6. Sticky sessions required if adding a second dyno

Socket.io's long-polling fallback (used during the WebSocket handshake) requires all requests from one client to hit the same server. Without sticky sessions in Heroku's load balancer, long-polling clients get routed to random dynos and fail to establish a room connection. This is a non-issue with a single dyno.

**Fix when needed:** Enable session affinity in Heroku (`heroku features:enable http-session-affinity`) before adding a second dyno. The in-memory room store (point 1) must also be externalised first, otherwise sticky sessions alone are not sufficient.

---

## Recent commits

| Commit | Summary |
|--------|---------|
| (latest) | Fix Google Sheets OAuth on mobile — fallback to full-page redirect when popup blocked; callback page redirects to `/?auth=success` after `window.close()` fails so `checkAuthStatus()` runs on app mount |
| `6175774` | Fix timer-page refresh flash — `initialView` checks `sessionStorage('stt-session')` first to skip load screen |
| `826dd9a` | Fix Supabase `_initializePromise` deadlock — `onAuthStateChange` made synchronous; `fetchPlan` deferred via `setTimeout(fn, 0)` |
| `26fbd21` | Skip `SIGNED_OUT` during init phase; fix plan fallback from `'free'` to `get().plan` |
| `7690f78` | **Definitive auth fix** — deleted `_storedSession` early-return that skipped `getSession()` and signed out users on every refresh |
| `b1bacae` | Fix plan resetting to free on refresh; wait for `!authLoading` before loading productions |
| `0f47348` | `/?room=CODE` invite links now route correctly to `/app`; session-ended screen respects auth state |
| `9f0eb2f` | Fix join-room race: `setRoom()` called last so view-transition sees correct state |
| `8966cd9` | Module-level cache for productions/events to avoid reload spinner on dashboard return |
| `b0cf4a3` | Remove edit-access probe from sheet fetch path; fetch only needs read permission |
| `9a79cdb` | Fix spurious sign-out after Google Sheets popup closes |
| `ec5da6c` | Fix billing redirect — return to originating page, handle `?billing=success` on any route |
| `dd41cd3` | Fix Google Sheets OAuth popup: poll `popup.closed` instead of postMessage |
