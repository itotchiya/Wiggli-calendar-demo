# AI Notetaker — Full Implementation Plan (Wiggli Calendar Demo)

**Date:** 2026-09-03 · **Status:** PLAN (not built yet)
**Sources:** `ai-notetaker-benchmark` (10 competitors) · `4-players-full-feature-inventory` ·
`technical-stack-4-players` · `cheap-ai-notetaker-prototype-stack` · current repo logic
**Stack rule:** Neon Postgres + Prisma only. No Supabase (Edge Functions → Next.js API
routes, Supabase DB → existing Neon DB + new Prisma models).

---

## 1. What we are building

A **separate sidebar item "AI Notetaker"** — its own section of the demo with everything
stored there (table list + detail sub-pages) — until the real Wiggli pages consume it.
It reuses the **current event-creation logic** (EventDrawer → `POST /api/events` →
Google Calendar + Gmail invite) and adds a context-aware AI layer on top:

```text
EventDrawer (existing) + "Enable AI Notetaker" toggle
        ↓
Event created (existing flow: Google event + Meet link + invites + previewData w/ linked records)
        ↓
AI NOTETAKER section (new sidebar item)
  Notes table (all meetings with notetaker state)
        ↓
  Note detail (sub-pages: Recording · Transcript · Summary · Insights · Actions · Ask AI)
        ↓
  Gemini structured call (ONE call: summary + insights + actions + evidence)
        ↓
  Human review → [Update record] / [Create task] / [Ignore]
```

**Product logic (from research):** Native experience (Ashby/Spott: how it lives inside the
ATS) + Deep intelligence (Metaview/BrightHire: templated summaries, evidence links,
scorecard-style insights). Our edge: the Event row already knows `eventType`,
attendees (candidate/contact/internal), and `previewData` linked records (job, contact,
organization, opportunity) — the AI reuses that context automatically.

---

## 2. Adapted cheap stack (Neon version of the research stack)

| Layer | Research stack | Our implementation | Prototype cost |
|---|---|---|---|
| Meeting bot | Recall.ai Meeting Bot | **Phase A: SKIP.** Manual transcript paste / audio upload. **Phase B (later):** Recall.ai (`RECALL_API_KEY`) | Phase A: €0 · Phase B: $0.50/h, first 5h free |
| Transcription | Recall built-in STT ($0.15/h) | **Phase A:** paste Meet transcript, or upload audio → Gemini audio input transcribes. **Phase B:** Recall STT | Phase A: €0 |
| AI (summary+insights+actions) | Gemini 2.5 Flash-Lite | **Reuse `GEMINI_API_KEY` + `src/lib/gemini.ts` pattern** (REST `generativelanguage.googleapis.com`, JSON mode). One structured call per meeting | Free tier / $0.10-in + $0.40-out per 1M tokens |
| Backend/webhooks | Supabase Edge Functions | **Next.js API routes** (`src/app/api/notetaker/...`), same process as invite-draft | €0 |
| Database | Supabase Postgres | **Neon Postgres + Prisma** (new models below, `prisma migrate`) | €0 |
| Recording storage ≤7d | Recall included | Phase A: no recordings stored (transcript text only). Phase B: Recall 7-day free | €0 |
| Cross-meeting intel | Gemini embeddings + pgvector | **Explicitly deferred** (research §10–11: don't build until needed) | — |

**What we do NOT build in v1:** vector DB, LangChain, multiple LLMs, agent framework,
Deepgram/AssemblyAI, Zapier, custom Meet/Zoom bot, mobile recording.

**Privacy rule (from research §17):** Gemini free tier may train on content → v1 uses
**mock/test data only**. Real candidate data waits for paid-tier + DPA/consent review.
Same gate applies before enabling Recall on real meetings.

---

## 3. Data model (Prisma, Neon)

New models linked to the existing `Event` (1 Event : 1 MeetingNote). No changes to
`Event`/`Attendee` except optional `notesEnabled Boolean @default(false)` if we want it
queryable without JSON (preferred: keep flag inside MeetingNote existence — a MeetingNote
row IS the toggle; no Event migration needed).

```prisma
model MeetingNote {
  id              String   @id @default(cuid())
  eventId         String   @unique
  event           Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)

  // lifecycle: CREATED → RECORDING/UPLOADED → TRANSCRIBED → PROCESSING → READY | FAILED
  status          String   @default("CREATED")
  statusMessage   String?  // error detail when FAILED

  // capture source: MANUAL_PASTE | AUDIO_UPLOAD | MEET_TRANSCRIPT | RECALL_BOT (Phase B)
  source          String   @default("MANUAL_PASTE")
  // Phase B only:
  recallBotId     String?
  recallRecordingUrl String?

  transcriptText  String?  // full transcript (speakers + [mm:ss] lines)
  transcriptJson  Json?    // [{speaker, time, text}] when parseable

  // ONE Gemini structured-output call, stored raw + parsed:
  aiRaw           Json?    // verbatim Gemini JSON
  summary         Json?    // {overview, experience[], skills[], motivation, ...} per template
  templateUsed    String?  // eventType → template name

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  insights Insight[]
  actions  NoteAction[]

  @@index([status])
}

model Insight {
  id          String   @id @default(cuid())
  noteId      String
  note        MeetingNote @relation(fields: [noteId], references: [id], onDelete: Cascade)

  field       String   // notice_period | salary_expectation | availability | skill | ...
  value       String
  confidence  Float?
  speaker     String?  // candidate | interviewer | unknown
  timestamp   String?  // "00:21:14"
  evidence    String?  // exact transcript quote
  // review: PENDING → ACCEPTED | IGNORED
  reviewStatus String  @default("PENDING")

  @@index([noteId, reviewStatus])
}

model NoteAction {
  id          String   @id @default(cuid())
  noteId      String
  note        MeetingNote @relation(fields: [noteId], references: [id], onDelete: Cascade)

  title       String
  owner       String?  // organizer | candidate | contact
  dueDate     String?
  timestamp   String?
  evidence    String?
  // review: PENDING → CREATED_TASK | IGNORED
  reviewStatus String  @default("PENDING")

  @@index([noteId, reviewStatus])
}
```

Tasks created from actions: reuse whatever task system the demo has (Tasks sidebar item
exists in nav but has no href yet) — v1 stores `reviewStatus=CREATED_TASK`; wiring into
a real Tasks table is a Phase B item. Same for "Update record": v1 shows the suggestion
with evidence; write-back into candidate/job records waits for real Wiggli record pages.

---

## 4. Context packet (the core of the user's idea)

Assembled server-side from the **existing Event row** — no new user input. Mirrors the
`SmartEventDocument` pattern in `src/lib/smart-event-*.ts`:

```text
Event.summary / description / eventType / start-end
+ Attendees[] (email, name, type: candidate | contact | internal)
+ previewData.linkedRecords (job + description, contact, organization, opportunity)
        ↓
Template selector: eventType → prompt template
  Interview   → skills-vs-JD, experience, motivation, comp/availability, concerns, next steps
  Intake      → requirements, budget, decision-makers, timeline  (Spott template set)
  Negotiation / Client Meeting → needs, objections, deal signals, follow-ups
  Internal    → decisions, owners, deadlines
        ↓
ONE Gemini structured call: transcript + context packet + template
        ↓
{ summary, candidate_insights[], action_items[] } each with timestamp + evidence quote
```

Rules baked into the system prompt (from Ashby guardrails + our email-AI conventions):
factual, evidence-linked, no hiring verdict, human decides; British English; JSON only.

---

## 5. API routes (Next.js, replacing Supabase Edge Functions)

| Route | Method | Purpose |
|---|---|---|
| `/api/notetaker/notes` | GET (list w/ event summary + status), POST (create from `eventId` + `source` + `transcriptText` or audio ref) | Entry point; POST triggers pipeline |
| `/api/notetaker/notes/[id]` | GET (full note + insights + actions), DELETE | Detail + cleanup |
| `/api/notetaker/notes/[id]/transcript` | PUT (save/overwrite pasted transcript, re-runs AI) | Manual transcript path |
| `/api/notetaker/notes/[id]/analyze` | POST (assemble context packet → Gemini → validate → save) | The AI step; mirrors `lib/gemini.ts` REST pattern |
| `/api/notetaker/notes/[id]/ask` | POST `{question}` → answer grounded on transcript + summary | Spott/Metaview Ask-AI pattern (transcript is small; no RAG needed in v1) |
| `/api/notetaker/insights/[id]/review` | POST `{decision: ACCEPTED\|IGNORED}` | Human-in-the-loop (Spott accept/reject loop) |
| `/api/notetaker/actions/[id]/review` | POST `{decision: CREATED_TASK\|IGNORED}` | Same for action items |
| `/api/notetaker/recall-webhook` | POST | **Phase B only.** Recall bot done → fetch transcript → create note → analyze |

Pipeline inside POST analyze: load Event+Attendees → build context packet → pick template
by `eventType` → Gemini structured JSON → `validate`/fallback (same discipline as
`validateContextParagraphs`) → Prisma create MeetingNote+Insight[]+NoteAction[] →
`status=READY`. Failure → `status=FAILED` + `statusMessage` (Ashby lifecycle states).

---

## 6. UI — new "AI Notetaker" sidebar section

### 6.1 Sidebar (`src/components/chrome.tsx`)

Add after Calendar (Lucide icon e.g. `Mic`/`AudioLines` — Lucide only, per conventions):

```tsx
{ label: "AI Notetaker", icon: AudioLines, href: "/dashboard/notetaker" },
```

Active-state logic already keys off `item.href` + `pathname.startsWith` — no chrome
changes needed beyond the one line.

### 6.2 Pages (all under `src/app/dashboard/notetaker/`)

```text
/dashboard/notetaker/page.tsx            Notes TABLE (all meetings w/ notetaker state)
  columns: Meeting (event summary+date) | Type | Candidate | Job | Status chip | Updated
  row click → detail. "New note" button → pick event (dropdown of recent events) + source.
  Empty state explains Phase A (paste transcript / upload audio).

/dashboard/notetaker/[id]/page.tsx       Note DETAIL with sub-tabs (all data from §3):
  Tab Recording  — Phase A: source badge + upload/paste box. Phase B: player + Recall meta.
  Tab Transcript — full text, speaker color, timestamp gutter, search box.
  Tab Summary    — templated sections per eventType (experience/skills/motivation/...).
  Tab Insights   — cards: field → value + confidence + evidence quote + [mm:ss]
                   + [Update record→pending] [Ignore]. (Spott suggest→accept/reject loop)
  Tab Actions    — cards: title + owner + due + evidence + [Create task] [Ignore].
  Tab Ask AI     — chat box over transcript+summary ("What salary did she ask?").
```

Detail header shows linked context chips (candidate → job → org), reusing the
linked-record arrow-chip pattern (open single pages in new tabs per user rule).

### 6.3 EventDrawer hook (current creation logic — minimal touch)

In `src/components/event-drawer.tsx`, next to the event-type selector: a single
"Enable AI Notetaker" checkbox. On successful `POST /api/events`, if checked →
`POST /api/notetaker/notes {eventId, source: MANUAL_PASTE}` creating a `CREATED` note
that appears in the table. No changes to invite/Google/RSVP flow. Reschedule/edit:
note stays linked to the Event (same id); re-analysis is manual via "Re-analyze".

---

## 7. Gemini call design (one call, structured)

Reuse `src/lib/gemini.ts` conventions: REST `POST
https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=`,
`responseMimeType: "application/json"`, `responseSchema`, server-side key, validate +
fallback, never expose key client-side. New file `src/lib/notetaker.ts`:
`buildNotetakerPrompt(event, attendees, linkedRecords, template, transcript)`,
`callNotetakerAI()`, `validateNotetakerOutput()`.

Output schema = research §5 adapted + `templateUsed`:

```json
{
  "summary": { "overview": "", "experience": [], "skills": [],
               "motivation": "", "compensation": "", "availability": "",
               "concerns": [], "next_steps": [] },
  "candidate_insights": [
    { "field": "notice_period", "value": "30 days", "confidence": 0.94,
      "speaker": "candidate", "timestamp": "00:21:14",
      "evidence": "My notice period is one month." } ],
  "action_items": [
    { "title": "Send technical assignment", "owner": "organizer",
      "due_date": null, "timestamp": "00:42:10",
      "evidence": "I'll send you the technical assignment after the call." } ]
}
```

Per-type templates change the `summary` keys + system-prompt focus (§4), not the schema.

---

## 8. Lifecycle / states (Ashby requirement from research)

`CREATED → TRANSCRIBED → PROCESSING → READY | FAILED`, plus Phase B
`RECORDING/JOINING`. Table shows a status chip for each; FAILED shows `statusMessage` +
Retry button (re-POST analyze). Consent: v1 banner on detail page ("Test data only —
free-tier AI may train on content"); real-consent UX (opt-in/out per location, invite
disclosure text — Ashby pattern) is a Phase B gate before Recall goes live.

---

## 9. Env vars (additive only)

```text
# Phase A — already present:
GEMINI_API_KEY=...            # + optional GEMINI_MODEL (default gemini-3.5-flash-lite pattern)
# Phase B — only when bot testing starts:
RECALL_API_KEY=...
RECALL_WEBHOOK_SECRET=...
```

No changes to Google OAuth, Resend, Neon, or auth.

---

## 10. Build order (each step independently verifiable)

1. Prisma models (§3) → `prisma migrate` (Neon) → `prisma generate`.
2. `src/lib/notetaker.ts` (context packet + template selector + Gemini call + validator).
3. API routes (§5) Phase A only (skip recall-webhook).
4. Sidebar item (§6.1) + table page (§6.2 list).
5. Detail page + 6 sub-tabs (§6.2 detail), incl. Ask AI.
6. Review actions (accept/ignore → status flips).
7. EventDrawer checkbox (§6.3).
8. Seed: 1 mock interview transcript + mock event (deterministic test emails per
   memory: candidate from `{linksomoney, luxqoox, must.boufous}@gmail/outlook`) →
   verify READY output by hand.
9. `npm run lint` + `npm run build` green → commit + push (directly on main per workflow).
10. Phase B (later, separate plan): Recall bot schedule on event create, webhook,
    consent UX, task/record write-back, embeddings.

## 11. Open questions for the user (from last brainstorm — still needed)

1. Phase A only, or A+B Recall bot now? (Recommend: A first.)
2. Real past transcript/recording available for testing, or mock one?
3. Does a linked job currently carry description text in `previewData`, or add a JD field?
4. Confirm the real event-type names (from Settings → Custom Fields → event-type).
