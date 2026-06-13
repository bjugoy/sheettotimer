# SheetToTimer — Agent Handover

**Project:** SheetToTimer — live show / run-of-show management app  
**Owner:** Richard Libres (richardtlibres@gmail.com)  
**Git user:** bjugoy  
**Last updated:** 2026-06-13  
**Head commit:** `41db46c Add Disconnect Google account button to Sheets section`

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + TypeScript (Vite), Tailwind CSS, Zustand |
| Backend | Node + Express + Socket.io (TypeScript) |
| Auth | Supabase (email + Google OAuth) |
| Database | Supabase Postgres |
| Billing | Stripe (checkout + billing portal) |
| Google Sheets | googleapis OAuth2 |
| File parsing | SheetJS (XLSX) |
| Sessions | express-session + connect-pg-simple → Supabase Postgres |
| Hosting | Heroku (server), Vercel (client) |

---

## Repo layout

```
sheettotimer/
  client/src/
    components/   # UI components
    pages/        # Route-level pages
    hooks/        # useFileParser, useGoogleSheets, useSocket, useTimer
    store/        # authStore, scheduleStore, sessionStore (Zustand)
    lib/          # api.ts (apiUrl helper), plans.ts
    utils/        # timeUtils.ts (cn, formatTime, inlineTitle, extractSheetId)
  server/src/
    index.ts      # Express + Socket.io entrypoint, all API routes
    auth.ts       # Supabase auth middleware
    googleAuth.ts # Google OAuth2 helpers + sheet fetch/write
    stripe.ts     # Stripe webhook + checkout helpers
    rooms.ts      # Socket room management
  shared/src/
    parser.ts     # Excel/CSV → ScheduleItem[] parsing logic
    types.ts      # Shared TypeScript types
  supabase/       # Supabase migration SQL files
```

---

## Environment variables

### Server (Heroku)
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL              # Supabase session pooler connection string (includes ?sslmode=require or ssl handled in code)
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI       # e.g. https://<heroku-app>.herokuapp.com/auth/google/callback
SESSION_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
CLIENT_URL                # Vercel frontend URL (for CORS + redirects)
```

### Client (Vercel)
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_API_URL              # Heroku backend URL
VITE_STRIPE_PUBLISHABLE_KEY
```

---

## Key architectural decisions

### Sessions
- `express-session` persists to Supabase Postgres via `connect-pg-simple`.
- Pool uses `ssl: { rejectUnauthorized: false }` because Supabase requires SSL.
- Table is `sessions` (created manually via Supabase migration — `createTableIfMissing: false`).
- Cross-origin cookies: `sameSite: 'none'`, `secure: true` in production.

### Google Sheets auth
- Separate OAuth2 flow from Supabase login — stored in the express session (`req.session.tokens`).
- `googleAuth.ts` uses the googleapis `tokens` event to capture refreshed tokens and saves them back to session after each API call.
- `useGoogleSheets.ts` exposes `disconnect()` which calls `POST /auth/logout` to clear the server session.
- Auth status checked via `GET /auth/status` → `{ authenticated: boolean }`.

### Billing
- Stripe only — RevenueCat was fully removed.
- Plans: `free`, `premium1` (Pro), `premium2` (Studio). No enterprise tier.
- `syncPlanFromStripe` called on PaywallPage mount to hydrate current plan.
- Billing portal: Stripe customer portal URL returned from server.

### File parsing
- SheetJS parses Excel files on the client inside `useFileParser.ts`.
- Multi-sheet workbooks: workbook stored in a `useRef`; `switchSheet(name)` re-parses without re-uploading.
- `TITLE_HINTS` regex in `shared/src/parser.ts` covers: title, item, topic, session, agenda, name, description, subject, activity, task, program, programme, segment, cue, event, action.
- Title line breaks normalized at parse time and at every display site via `inlineTitle()` in `timeUtils.ts`.

### Delete account
- `authStore.deleteAccount`: 20s AbortController timeout, treats 401 as already-deleted, fire-and-forget `supabase.auth.signOut()`.
- `ProfileModal.handleDelete`: try/finally so loading spinner always resets.

---

## Notable files

| File | What it does |
|---|---|
| `server/src/index.ts` | All Express routes + Socket.io setup + session store config |
| `server/src/googleAuth.ts` | `fetchSheetData`, `writeSheetData`, `buildClient` (token refresh) |
| `client/src/hooks/useFileParser.ts` | Excel/CSV parsing + multi-sheet support |
| `client/src/hooks/useGoogleSheets.ts` | Fetch/write/disconnect Google Sheets |
| `client/src/components/FileUploader.tsx` | Drop zone + Google Sheets URL input + disconnect link |
| `client/src/components/LoadSchedulePage.tsx` | Orchestrates file upload, sheet picker, column mapper |
| `client/src/components/ScheduleEditor.tsx` | Inline schedule editing (delete row = no time cascade) |
| `client/src/pages/PaywallPage.tsx` | Stripe-only paywall, shows current plan |
| `client/src/store/authStore.ts` | Supabase auth, plan sync, deleteAccount |
| `shared/src/parser.ts` | Row → ScheduleItem parsing, time detection, title normalization |

---

## Recent work (last session — 2026-06-13)

All implemented and pushed to `main`:

1. **Landing page** — Pricing section moved above Features; monthly/yearly toggle made more visible.
2. **Paywall** — Replaced RevenueCat with Stripe; shows current plan badge; auth gate before checkout.
3. **Multi-sheet Excel** — Sheet picker tab-strip; workbook held in ref; `switchSheet()`.
4. **"Activity" column detection** — Broadened `TITLE_HINTS` regex.
5. **Title line breaks** — Normalized in parser and at all display sites (`inlineTitle()`).
6. **Delete row (editor)** — No time cascade; delete button always visible.
7. **Delete account bugs** — try/finally, AbortController timeout, fire-and-forget sign-out.
8. **Google Sheets sessions** — Supabase Postgres session store (connect-pg-simple + SSL).
9. **Token refresh** — googleapis `tokens` event; fresh tokens saved back to session after each call.
10. **Disconnect Google account** — Button in FileUploader; calls `POST /auth/logout`; resets UI state.

---

## Known state / things to be aware of

- Google OAuth app is in **Testing** mode in Google Cloud Console → only whitelisted accounts can connect. To go live: publish the OAuth consent screen.
- `sessions` table in Supabase was created manually (no migration file). Schema is standard connect-pg-simple: `sid`, `sess`, `expire`.
- Stripe subscription cancellation does NOT automatically happen when a user deletes their account — this would need a Stripe customer lookup + cancel call wired into the `DELETE /api/account` route.
- No automated tests. All verification is manual via the running app.
- TypeScript strict mode is on. Session token fields must be normalized to `string | null` (not `undefined`) before passing to `Tokens` interface.

---

## How to run locally

```bash
# Install
npm install

# Start both client and server in dev mode
npm run dev
```

Client: http://localhost:5173  
Server: http://localhost:3000

Requires `.env` files in project root (server) and `client/` with the variables listed above.
