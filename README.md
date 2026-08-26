# 📅 Wiggli Calendar — Custom iCalendar RSVP & Event Sync Demo

A full-stack demo for comparing Gmail Smart Events, Workable-style Resend RSVP
invitations, and native Google Calendar invitations while keeping attendee
responses synchronized.

```
Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui
Prisma 7 + PostgreSQL · Auth.js v5 (Google OAuth) · Google APIs · Resend SMTP
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
npx prisma migrate deploy     # initializes your PostgreSQL database
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

## Data model (PostgreSQL)

- **Event** — summary, times, timezone, `iCalUID` (unique, shared with Google),
  `googleEventId`, `sequence` (ICS SEQUENCE), custom subject/body overrides.
- **Attendee** — per-event email/name + `rsvp`
  (`NEEDS_ACTION | ACCEPTED | TENTATIVE | DECLINED`) + `respondedAt`.
- **OrganizerAccount** — cached Google refresh token so one-click RSVPs can sync
  to Google even when the organizer is logged out.
- **RsvpTokenLog** — audit trail of every button click.

## Deploy to Vercel

1. Import this GitHub repository into Vercel as a Next.js project.
2. Connect a managed PostgreSQL database (Neon, Prisma Postgres, Supabase, or
   another PostgreSQL provider).
3. Add `DATABASE_URL` using the pooled runtime connection and `DIRECT_URL`
   using the direct migration connection. If only one URL is provided, use it
   for both variables.
4. Add the remaining values from `.env.example` in **Project Settings →
   Environment Variables**. Never commit real secrets.
5. In Google Cloud, add the production OAuth redirect URI:
   `https://wiggli-calendar-demo.vercel.app/api/auth/callback/google`.
6. Set `NEXT_PUBLIC_APP_URL` to
   `https://wiggli-calendar-demo.vercel.app` and redeploy.
7. In Resend, register
   `https://wiggli-calendar-demo.vercel.app/api/resend/inbound` for the
   `email.received` event, then add its signing secret as
   `RESEND_WEBHOOK_SECRET` and redeploy once more.

`vercel.json` runs `prisma migrate deploy` before every production build, and
`postinstall` regenerates Prisma Client for the deployment runtime.

### Required Vercel environment variables

```text
DATABASE_URL
DIRECT_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
AUTH_SECRET
NEXT_PUBLIC_APP_URL
GEMINI_API_KEY
RESEND_API_KEY
RESEND_CALENDAR_DOMAIN
RESEND_FROM_NAME
RESEND_WEBHOOK_SECRET
```

Use these non-secret values for this deployment:

```text
NEXT_PUBLIC_APP_URL=https://wiggli-calendar-demo.vercel.app
RESEND_CALENDAR_DOMAIN=lalla.surf
RESEND_FROM_NAME=Wiggli Calendar
```

Keep `RESEND_API_KEY` and `RESEND_WEBHOOK_SECRET` only in Vercel environment
variables. Do not commit either secret.

## Demo limitations (by design)

- Existing local SQLite demo rows are not copied into PostgreSQL automatically.
- No background job queue; event creation and invitation delivery happen in
  the request lifecycle.
- NextAuth v5 beta keeps the access token in the session JWT; refresh happens on
  sign-in flow. For long-lived production use, persist tokens server-side.
- Custom HTML bodies are sent verbatim (only the RSVP row is injected) — sanitize
  templates if you ever let untrusted users author them.
