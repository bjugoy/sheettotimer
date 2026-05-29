# Program Timer

Real-time event schedule management for live event producers and conference organizers.

## Features

- **Live countdown timer** — Full-screen, high-contrast display with green/yellow/red color coding
- **Spreadsheet import** — Upload `.xlsx` / `.ods`, or connect Google Sheets via OAuth
- **Auto column detection** — Maps Start Time, End Time, Duration, Title, and Notes automatically
- **Real-time recalculation** — If an item runs over, projected times for all subsequent items cascade forward
- **What-if mode** — Simulate duration changes without committing them
- **Inline schedule editor** — Edit titles, times, and durations; drag to reorder
- **Multi-user rooms** — Share a 6-character room code; Operators edit, Viewers read only
- **Announcements** — Operators send 280-char messages that appear as banners on all viewers
- **Teleprompter mode** — Fullscreen presenter view with large countdown and speaker notes
- **Google Sheets sync-back** — Push edited schedules back to the source sheet

---

## Project structure

```
ProgramScheduler/
├── client/        React + TypeScript + Vite frontend
├── server/        Node.js + Express + Socket.io backend
├── shared/        Types and parser utilities (used by both)
└── README.md
```

---

## Quick start

### Prerequisites

- Node.js 18+
- npm 9+

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Description |
|---|---|
| `PORT` | Server port (default `3001`) |
| `CLIENT_URL` | Frontend URL for CORS (default `http://localhost:5173`) |
| `SESSION_SECRET` | Any random string for session signing |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL |

### 3. Run in development

```bash
npm run dev
```

This starts both the server (`:3001`) and the Vite dev server (`:5173`) concurrently.

Open **http://localhost:5173** in your browser.

---

## Google OAuth setup

To enable Google Sheets integration:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. Create a new **OAuth 2.0 Client ID** (Web application type)
3. Add an **Authorized redirect URI**: `http://localhost:3001/auth/google/callback`
4. Enable the **Google Sheets API** under *APIs & Services → Library*
5. Copy the Client ID and Secret into your `.env` file

Without these credentials, file upload (`.xlsx` / `.ods`) still works fully.

---

## Usage

### Loading a schedule

**Option A — File upload:**  
Drag and drop any `.xlsx` or `.ods` file onto the upload zone, or click to browse. The parser auto-detects columns and shows a mapping confirmation UI.

**Option B — Google Sheets:**  
Sign in with Google, then paste your sheet URL. The app reads the sheet and shows the same mapping UI.

**Supported row formats:**
- `Start Time | End Time | Title`
- `Start Time | Duration (minutes or HH:MM) | Title`
- `Time range in one cell (e.g. "9:00-10:00") | Title`

### Running the show

- The **timer view** shows the current item countdown, next item, and full schedule list
- Click **Start** to mark an item as active (starts the live countdown)
- Click **Mark done & advance** or press **Space** in presenter mode to move to the next item
- The schedule automatically recalculates projected times whenever items run over or under

### Team collaboration

1. One operator creates a room — they get a 6-character code
2. Share the room code or the auto-generated URL
3. Viewers join as read-only; additional operators can also join
4. Operators can send announcements that appear as banners for 10 seconds

### Presenter mode

Click **Presenter** in the top bar to open the teleprompter view:
- Fullscreen, large countdown
- Speaker notes per item (edit in the schedule editor)
- **Space / Enter** to advance, **Esc** to close

### What-if mode

In the schedule editor, type in the **What-if** column to simulate a different duration for any future item. The projected times update live but are not committed until you click **Apply**.

---

## Production deployment

### Vercel + Railway

- Deploy `client/` to Vercel (set `VITE_API_URL` if using a different domain)
- Deploy `server/` to Railway or any Node.js host
- Set all environment variables in each platform's dashboard
- Update `GOOGLE_REDIRECT_URI` to your production domain

### Single VPS

```bash
npm run build
# Then serve with PM2 or systemd:
node server/dist/index.js
# Serve client/dist/ with nginx
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS |
| State | Zustand |
| Real-time | Socket.io |
| File parsing | SheetJS (xlsx) |
| Backend | Node.js, Express |
| Google Sheets | googleapis SDK |
