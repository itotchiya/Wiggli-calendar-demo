# Multi-slot invites: technical logic

This covers three parts:

1. Sending N slot emails into **one Gmail thread**.
2. Syncing the **RSVP responses** from that thread.
3. **Cancelling the other slots** when one slot gets a Yes.

---

## 1. Sending N emails into one Gmail thread

Code: `createSmartMultiSlotEventsAndInvite()` in `src/lib/events-service.ts`,
`sendInviteEmail()` in `src/lib/google/gmail.ts`.

### 1.1 One Google event per slot

Each slot is its own event on the organizer's primary calendar:

```ts
calendar.events.insert({
  calendarId: "primary",
  sendUpdates: "none",          // Google sends NO email; we send our own
  requestBody: { summary, start, end, attendees, ... },
})
// → returns { id, iCalUID }
```

All slots are stored locally with the same `slotGroupId` (a UUID), which ties
them together.

The email for each slot carries an ICS whose `UID` = that slot's `iCalUID`.
That is how an RSVP click on the card maps back to the right Google event.

### 1.2 Send the first email, capture its IDs

The first slot's email is sent normally with the Gmail API:

```ts
const res = await gmail.users.messages.send({
  userId: "me",
  requestBody: { raw: base64url(mime) },    // no threadId → new conversation
});
// res.data.id       → Gmail message id
// res.data.threadId → Gmail thread id   ← keep it
```

Gmail **rewrites the `Message-ID` header** we put in the MIME, so the real one
has to be read back right after sending:

```ts
const meta = await gmail.users.messages.get({
  userId: "me",
  id: res.data.id,
  format: "metadata",
  metadataHeaders: ["Message-ID"],
});
// meta.data.payload.headers["Message-ID"] → delivered RFC Message-ID ← keep it
```

This gives us two values:

| Value            | Source                           | Used for                              |
| ---------------- | -------------------------------- | ------------------------------------- |
| `threadId`       | `messages.send` response         | server-side threading in the sender's Gmail |
| `rootMessageId`  | `messages.get` → `Message-ID`    | `In-Reply-To` / `References` headers so the recipient's client threads it |

### 1.3 Send the remaining slots into the same thread

Every following slot email reuses those values:

```ts
gmail.users.messages.send({
  userId: "me",
  requestBody: {
    threadId,                          // join the same Gmail thread
    raw: base64url(mime),              // MIME headers below
  },
});
```

```
Subject:     <exactly the same subject as email 1>
In-Reply-To: <rootMessageId>
References:  <rootMessageId> <slot2MessageId> ...
```

Three conditions keep the emails in one conversation, on both the sender's
side and the recipient's:

1. **Same `Subject`**: Gmail breaks a thread when the subject changes.
2. **`threadId`** on `messages.send`: threads it in the sender's mailbox.
3. **`In-Reply-To` / `References`** pointing at the **delivered** Message-ID:
   threads it in the recipient's mailbox (Gmail, Outlook, Apple).

The recipient gets one inbox row. Opening it shows each slot's native
Yes / No / Maybe card in order.

After each send, the `threadId` and delivered `Message-ID` are saved on that
slot's recipient row (`Attendee.inviteThreadId`, `Attendee.inviteMessageId`),
so later messages (the cancellation) can go into the same thread.

### 1.4 MIME of each slot email

```
multipart/mixed
├── multipart/alternative
│   ├── text/plain
│   ├── text/html
│   └── text/calendar; method=REQUEST     ← the RSVP card
└── application/ics  (invite.ics)
```

```
BEGIN:VCALENDAR
METHOD:REQUEST
BEGIN:VEVENT
UID:<this slot's Google iCalUID>
SEQUENCE:0
ORGANIZER:mailto:<organizer>
ATTENDEE;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:<recipient>
DTSTART / DTEND / SUMMARY ...
END:VEVENT
END:VCALENDAR
```

The `method=` on the `text/calendar` part must match `METHOD:` inside the ICS
(RFC 6047).

```
Email 1 (slot 1)  send ──► capture threadId + delivered Message-ID
Email 2 (slot 2)  send { threadId, In-Reply-To: root, References: [root] }
Email 3 (slot 3)  send { threadId, In-Reply-To: root, References: [root, msg2] }
                         └── same Subject on all three
```

---

## 2. RSVP sync from the thread

Each card in the thread is a separate event (its own `UID`), so a Yes on the
slot 2 card updates **only** slot 2.

### 2.1 How the response travels

| Recipient client | Clicking "Yes" on a card                                                        |
| ---------------- | ------------------------------------------------------------------------------- |
| Gmail            | Google matches the `UID` to the organizer's event and sets that recipient's `responseStatus: "accepted"` directly on it |
| Outlook / Apple  | Sends a `METHOD:REPLY` email (ICS with `UID` + `PARTSTAT=ACCEPTED`) to the organizer's inbox |

### 2.2 How Wiggli picks it up

**a) Google Calendar push webhook (instant):** `src/lib/google/calendar-watch.ts`

```ts
calendar.events.watch({
  calendarId: "primary",
  requestBody: { id: channelId, type: "web_hook", address: WEBHOOK_URL, token: secret },
})
```

- Google POSTs to `/api/google/calendar-webhook` on any change to the calendar.
- The request has **headers only, no event data**: `X-Goog-Channel-ID`,
  `X-Goog-Channel-Token`, `X-Goog-Resource-State` (`sync` | `exists`).
- The handler checks the token, answers `200` immediately, then in `after()`:
  ```ts
  calendar.events.list({ calendarId: "primary", updatedMin: now - 10min,
                         singleEvents: true, showDeleted: true })
  ```
  and copies each attendee's `responseStatus` into `Attendee.rsvp`.
- Auth uses the organizer's stored **refresh token**, since there's no browser session.
- Channels expire after at most **7 days** and cannot be extended. A new
  channel is opened before expiry and the old one is closed with `channels.stop`.
- The URL must be public HTTPS with a valid certificate, so it doesn't work on localhost.

**b) Poll fallback (every 15 s):** `POST /api/sync`

1. **REPLY emails** (`src/lib/google/gmail-replies.ts`):
   ```ts
   gmail.users.messages.list({ q: 'newer_than:30d {filename:ics "METHOD:REPLY"}' })
   ```
   Parse each ICS, find the event by `UID`, set the RSVP, then patch the
   Google event so Google holds the same state:
   ```ts
   calendar.events.patch({ eventId, sendUpdates: "none",
                           requestBody: { attendees: [...with new responseStatus] } })
   ```
   That patch also fires the webhook.
2. **Calendar pull** (`src/lib/sync-service.ts`): `events.list` with
   `updatedMin` = last pull, which returns only the events that changed, and
   updates `Attendee.rsvp`.
3. Runs the cancel logic below.

```
Card "Yes" ──► Google event responseStatus = accepted
                    │
        ┌───────────┴────────────┐
   webhook (instant)        poll (≤15 s)
        └───────────┬────────────┘
                    ▼
     events.list(updatedMin) → Attendee.rsvp = ACCEPTED
                    ▼
          resolveAcceptedSlotGroups()
```

---

## 3. One slot accepted → cancel the others

Code: `resolveAcceptedSlotGroups()` / `cancelSlot()` in `src/lib/slot-groups.ts`.

### 3.1 Find the winning slot

```
find groups: events WHERE slotGroupId IS NOT NULL
                       AND status = SCHEDULED
                       AND a recipient rsvp = ACCEPTED

for each group:
  live   = slots in the group still SCHEDULED
  if live.length < 2 → done
  chosen = the live slot with the earliest ACCEPTED (respondedAt)
  every other live slot → cancelSlot()
```

### 3.2 `cancelSlot()`

**Step 1: atomic claim (idempotency).** The webhook and the poll can run at the same time:

```ts
const { count } = await db.event.updateMany({
  where: { id: slot.id, status: "SCHEDULED" },
  data:  { status: "CANCELLED", sequence: slot.sequence + 1 },
});
if (count === 0) return;   // someone else already cancelled it
```

**Step 2: delete the Google event, silently.**

```ts
calendar.events.delete({ calendarId: "primary", eventId, sendUpdates: "none" })
// 404 / 410 = already gone → ignore
```

`sendUpdates: "none"` stops Google from sending its own cancellation email in a
**separate** thread. We send ours into the original thread instead.

**Step 3: send a CANCEL into the same thread**, using the saved IDs:

```ts
gmail.users.messages.send({
  userId: "me",
  requestBody: {
    threadId: attendee.inviteThreadId,          // same Gmail thread
    raw: base64url(mime),
  },
});
```

```
Subject:     <same subject as the invite>
In-Reply-To: <attendee.inviteMessageId>
References:  <attendee.inviteMessageId>

Content-Type: text/calendar; method=CANCEL
```

```
BEGIN:VCALENDAR
METHOD:CANCEL
BEGIN:VEVENT
UID:<same UID as the cancelled slot>
SEQUENCE:<previous + 1>
STATUS:CANCELLED
...
END:VEVENT
END:VCALENDAR
```

The same `UID` with a higher `SEQUENCE` and `METHOD:CANCEL` makes the
recipient's calendar remove that slot and mark its card as cancelled, inside
the same conversation.

**Step 4: sync guard.** While pulling from Google, a grouped event that is
`CANCELLED` locally is never set back to `SCHEDULED`. Otherwise a pull that
read Google just before the delete could revive the slot, which would lead to
a second CANCEL email.

```
Yes on slot 2
   ▼
claim slot 1, slot 3   (SCHEDULED → CANCELLED, SEQUENCE+1)
   ▼
events.delete(slot 1), events.delete(slot 3)      sendUpdates: "none"
   ▼
Gmail send METHOD:CANCEL for slot 1 and slot 3
   { threadId, In-Reply-To: inviteMessageId, same Subject }
   ▼
Thread now shows: slot 1 ✕ cancelled · slot 2 ✓ accepted · slot 3 ✕ cancelled
```
