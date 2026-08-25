# 📅 Wiggli Calendar — Custom iCalendar RSVP & Event Sync Demo

A full-stack demo of **branded calendar invitations sent from your own Gmail** —
bypassing Google Calendar's default gray invite emails while **keeping native
RSVP syncing intact** (Yes / Maybe / No in Gmail, Outlook and Apple Calendar).

```
Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui
Prisma 7 + SQLite (driver adapter) · Auth.js v5 (Google OAuth) · googleapis
```

## How it works

```
┌────────────────┐   sendUpdates:"none"   ┌─────────────────────┐
│ /dashboard/    │ ─────────────────────▶ │ Google Calendar API │
│ create         │   (no default email)   │  event + attendees  │
└──────┬─────────┘                        └──────────┬──────────┘
       │ iCalUID                                     │ iCalUID
       ▼                                             ▼
┌──────────────────────────────────────────────────────────────┐
│ Gmail API · users.messages.send                              │
│ multipart/mixed                                              │
│ ├── text/html ......... branded invite + RSVP buttons        │
│ ├── text/calendar ..... METHOD:REQUEST (inline, Apple Mail)  │
│ └── application/ics ... invite.ics (Gmail/Outlook "Add")     │
└──────────────────────────────────────────────────────────────┘
```

1. **Create** inserts the event into the organizer's primary calendar with
   `sendUpdates: "none"` so Google sends nothing.
2. The returned **`iCalUID`** is stored locally and reused in a hand-built
   RFC 5545 payload (`METHOD:REQUEST`, `ORGANIZER`, `ATTENDEE;RSVP=TRUE`,
   correct folding + TEXT escaping). Because the UIDs match, native replies
   still map onto the same event.
3. Each attendee receives a personalized HTML email from the organizer's own
   Gmail with:
   - a **one-click RSVP row** (`/api/rsvp/<signed-token>?action=yes|maybe|no`)
     that records the answer in SQLite *and* patches the attendee's
     `responseStatus` on the Google event using the stored offline refresh token;
   - the inline + attached **.ics** so any mail client can respond natively.
4. `/dashboard/events` shows live statuses; **↻ Sync from Google** pulls
   authoritative responses for people who replied straight from their inbox.

## Quick start

```bash
npm install
cp .env.example .env          # then fill in the values (see below)
npx prisma migrate dev        # creates prisma/dev.db
npm run dev                   # http://localhost:3000
```

### Google Cloud setup (5 min)

1. [console.cloud.google.com](https://console.cloud.google.com) → new/existing project.
2. **APIs & Services → Library**: enable **Google Calendar API** and **Gmail API**.
3. **OAuth consent screen**: External → add yourself as a test user.
4. **Credentials → Create credentials → OAuth client ID → Web application**
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Copy client ID/secret into `.env`, set `AUTH_SECRET`
   (`openssl rand -base64 32`) and `NEXT_PUBLIC_APP_URL`.

> While your app is in the OAuth consent screen's *Testing* mode only accounts
> you added as test users can sign in — expected behavior.

## Routes

| Route                    | What it does |
|--------------------------|--------------|
| `/`                      | Landing page |
| `/dashboard/create`      | Event form + live email preview (default template or custom HTML) |
| `/dashboard/events`      | Event list, per-attendee RSVP statuses, sync button |
| `POST /api/events`       | Create GCal event (`sendUpdates:"none"`) + persist + send invites |
| `GET /api/events`        | List events with attendees |
| `POST /api/sync[?id=]`   | Pull native RSVP statuses from Google into SQLite |
| `GET/POST /api/rsvp/[t]` | One-click RSVP endpoint (HMAC-signed tokens) |
| `/api/auth/*`            | Auth.js (Google provider, offline access) |

## Data model (SQLite)

- **Event** — summary, times, timezone, `iCalUID` (unique, shared with Google),
  `googleEventId`, `sequence` (ICS SEQUENCE), custom subject/body overrides.
- **Attendee** — per-event email/name + `rsvp`
  (`NEEDS_ACTION | ACCEPTED | TENTATIVE | DECLINED`) + `respondedAt`.
- **OrganizerAccount** — cached Google refresh token so one-click RSVPs can sync
  to Google even when the organizer is logged out.
- **RsvpTokenLog** — audit trail of every button click.

## Demo limitations (by design)

- SQLite file DB, single organizer at a time, no background jobs.
- NextAuth v5 beta keeps the access token in the session JWT; refresh happens on
  sign-in flow. For long-lived production use, persist tokens server-side.
- Custom HTML bodies are sent verbatim (only the RSVP row is injected) — sanitize
  templates if you ever let untrusted users author them.
