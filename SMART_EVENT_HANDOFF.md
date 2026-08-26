# Wiggli Smart Event: Product and Engineering Handoff

## 1. Purpose

This document defines the target behavior for Wiggli Smart Event invitation generation, editing, delivery, iCalendar compatibility, and RSVP synchronization.

The central design principle is:

> AI generates only the contextual opening paragraph. Wiggli generates the rest of the invitation deterministically from the event drawer inputs. The user receives a complete first draft and can customize it with the rich-text toolbar and variable chips before sending.

This architecture keeps invitations consistent, reduces AI token usage, prevents hallucinated event details, and preserves user control.

## 2. Goals

- Build one canonical JSON document from Step 1 of the event drawer.
- Use the event type as the primary purpose and Linked-to records as subject context.
- Treat the attendee list as the only authority for who is actually participating.
- Use event title and description as supporting AI context.
- Generate one concise but personalized context paragraph per attendee audience.
- Keep the greeting, details, RSVP note, and signature deterministic.
- Keep the rich-text toolbar and variable chips in Step 2.
- Allow users to edit, remove, move, or insert available variable chips.
- Regenerate only the AI context paragraph without overwriting other user edits.
- Send a standards-compliant iCalendar invitation to every attendee.
- Display detailed event information in Google Calendar, Outlook, and Apple Calendar.
- Synchronize RSVP responses into Wiggli with Google as the current organizer calendar and an explicit inbound-reply path for cross-client reliability.

## 3. Non-Goals

The AI must not generate:

- The complete email body.
- The subject line.
- The greeting.
- The event details section.
- Date, time, location, organizer, or guest values.
- The RSVP instructions.
- The signature.
- HTML structure or styles.
- Unsupported variables.

The AI must not rewrite any deterministic email block when the user clicks Regenerate.

## 4. End-to-End Flow

```text
Step 1 event drawer inputs
        |
        v
Canonical SmartEventDocument JSON
        |
        +--> Calendar creation data
        +--> Fixed invitation blocks
        +--> iCalendar event data
        +--> Audience-safe AI context
        |
        v
One AI request for all attendee audiences
        |
        v
One context paragraph per attendee audience
        |
        v
Wiggli assembles the complete editable invitation
        |
        v
User reviews, formats, edits, removes, or inserts chips
        |
        v
Google event is created and the final Meet URL is returned
        |
        v
Variables resolve separately for every recipient
        |
        v
HTML email + plain text + METHOD:REQUEST iCalendar are sent
        |
        v
RSVP replies synchronize into Wiggli
```

## 5. Canonical Smart Event JSON

Step 1 must produce one canonical JSON document. The same document is used by AI drafting, preview rendering, calendar creation, email rendering, and ICS generation.

Recommended type name:

```ts
type SmartEventDocument = {
  schemaVersion: 1;
  event: SmartEventData;
  organizer: SmartOrganizer;
  linkedTo: SmartLinkedRecord[];
  attendees: SmartAttendee[];
  audiences: SmartAudienceContext[];
};
```

Example:

```json
{
  "schemaVersion": 1,
  "event": {
    "title": "Second interview - Senior UX Designer",
    "type": {
      "id": "interview",
      "name": "Interview",
      "context": "A structured conversation to evaluate a candidate's experience and suitability for a job opportunity."
    },
    "description": "This is a second technical interview focused on design-system experience and salary expectations.",
    "date": "2026-08-28",
    "startTime": "10:00",
    "endTime": "10:30",
    "slots": [
      {
        "date": "2026-08-28",
        "startTime": "10:00",
        "endTime": "10:30"
      }
    ],
    "timezone": "Europe/Paris",
    "location": {
      "type": "online",
      "label": "Online",
      "provider": "google",
      "value": null,
      "generatedOnCreate": true
    },
    "reminderMinutes": 15
  },
  "organizer": {
    "fullName": "Axelle Bastin",
    "email": "axelle@wiggli.com",
    "phone": "BE +32456555992"
  },
  "linkedTo": [
    {
      "type": "Candidate",
      "id": "candidate-123",
      "label": "Mustapha Boufous",
      "variable": "[Linked.Candidate]"
    },
    {
      "type": "Job",
      "id": "job-456",
      "label": "Senior UX Designer",
      "variable": "[Linked.Job]"
    },
    {
      "type": "Organization",
      "id": "organization-789",
      "label": "Wiggli",
      "variable": "[Linked.Organization]"
    }
  ],
  "attendees": [
    {
      "id": "candidate-123",
      "type": "candidate",
      "fullName": "Mustapha Boufous",
      "email": "mustapha@example.com"
    },
    {
      "id": "contact-456",
      "type": "contact",
      "fullName": "John Smith",
      "email": "john@company.com"
    },
    {
      "id": "internal-789",
      "type": "internal",
      "fullName": "Sarah Martin",
      "email": "sarah@wiggli.com"
    }
  ],
  "audiences": [
    {
      "type": "candidate",
      "allowedContextVariables": [
        "[Linked.Job]",
        "[Linked.Organization]"
      ]
    },
    {
      "type": "contact",
      "allowedContextVariables": [
        "[Linked.Candidate]",
        "[Linked.Job]",
        "[Linked.Organization]"
      ]
    },
    {
      "type": "internal",
      "allowedContextVariables": [
        "[Linked.Candidate]",
        "[Linked.Contact]",
        "[Linked.Job]",
        "[Linked.Organization]"
      ]
    }
  ]
}
```

Fields that do not exist must be omitted rather than sent as fabricated or placeholder values.

### Multi-Slot Email Threading and Calendar Titles

Workable's ICS (attached: two `METHOD:REQUEST` files, one VEVENT each, distinct
UIDs `smqj...` and `krsj...`, same `ORGANIZER` `c4f00...@events.workablemail.com`,
`SUMMARY` with `(Slot N)` suffix) and the inbox screenshots show the problem:

- **Google-native multi-slot** (`sendUpdates: "all"`) — each slot is a separate
  Google Calendar event → Google emails a separate native invitation per
  slot with subject `Invitation: <title> (Slot N) @ <date>`. Gmail threads by
  subject, so slots land in **separate list entries** (see the `Tchiya` rows:
  `(Slot 1) @ Wed Aug 26`, `(Slot 2) @ Fri Aug 28`, …). Each row has a card,
  but they are not grouped.
- **Branded single-subject multi-slot** — all slots share `Invitation:
  <title>` and are threaded via `In-Reply-To`/`References`. Gmail shows
  **one list entry, one thread**, but Google-native cards are absent because
  those branded mails carry only our custom ICS.

Gmail renders a native **Yes / No / Maybe** card for any valid
`METHOD:REQUEST` VCALENDAR it can parse — the card is not exclusive to
Google-native invites. **However, Gmail renders at most ONE card per email
message, and inside a multi-VEVENT ICS it only surfaces the FIRST VEVENT**
(the rest are ignored for rendering; verified live 2026-08-26 and documented
by users since 2019 on the Calendar support forum). "One email → N stacked
cards" is therefore impossible in Gmail; it works in Apple Mail and Outlook
only.

Wiggli Smart Event therefore splits by slot count:

- **Single-slot** (`slots.length === 1`) — hybrid: Google event created with
  `sendUpdates: "all"` (src/lib/events-service.ts:219) so Gmail shows the
  guaranteed native card, plus one branded email with a single-VEVENT ICS
  (`invite.ics`). Result is two messages (native + branded) with slightly
  different subjects (`@ <date>` suffix on the native); see the `Tchiya` vs
  `toozmust` rows in the screenshot.
- **Multi-slot** (`slots.length > 1`) — **one thread, one subject, one email
  PER SLOT**. All Google events are created with `sendUpdates: "none"`
  (silent), then each attendee receives N chained emails via
  `createSmartMultiSlotEventsAndInvite`:
  - Message k carries its own **single-VEVENT** `METHOD:REQUEST` ICS built
    with `buildRequestIcs`, whose UID is slot k's real Google `iCalUID`,
    `SUMMARY` `"<title> (Slot k)"`, and per-slot times/location — so every
    message renders a genuine Yes/No/Maybe card for that slot.
  - All N messages share the subject `Invitation: <title>` and are forced
    into ONE Gmail conversation via `threadId` (server-side grouping,
    captured from the first send's API response) plus RFC chaining headers:
    `In-Reply-To` = last delivered Message-ID and a growing `References`
    chain. Collapsed inbox shows one row; expanding shows Slots 1…N stacked,
    each with RSVP buttons.
  - Variable anchoring is per-slot in these emails: `[Event.Date]`,
    `[Event.Start_time]`/`[End_time]`, `[Slot.Number]`, `[Meeting.Link]`
    resolve to the message's own slot; `[Attendees.*]`, `[Organizer.*]`,
    `[Linked.*]`, `[Slot.Total]` stay event-wide.
  - The multi-slot note block (full option list) appears only on the FIRST
    message of the thread.

Other invariants:

- Each slot keeps its own Google `UID`/`iCalUID`, date, time, RSVP status,
  and per-slot `SUMMARY` suffix (`Backend interview (Slot 1)` etc.).
- `[Event.Title]` resolves to the base title in the branded email body, not
  the slot-suffixed ICS `SUMMARY`.
- A single-slot event keeps the base title with no suffix.
- RSVP sync patches (`PATCH … sendUpdates: "none"`) stay silent to avoid
  re-notifying (src/lib/events-service.ts:561, src/lib/google/gmail-replies.ts:119).

Thread state (`InviteThreadState`) is scoped per recipient and now tracks
`threadId`, `rootMessageId`, and a `references[]` chain populated as each
message is delivered. Native Google invitation mode (src/app/api/
native-events/route.ts:106) still uses `sendUpdates: "all"` per slot
(separate threads by design) — the grouped multi-card threading applies
to Smart Event branded delivery.

### Gmail Outgoing Message-ID Regeneration (critical for threading)

Gmail REGENERATES the `Message-ID` of every message sent through
`gmail.users.messages.send`: any custom ID we author (e.g.
`<wiggli-…@calendar.wiggli.local>`) does NOT survive delivery — Gmail stores
its own `<CAHmhv…@mail.gmail.com>` ID instead. Verified live 2026-08-26:
messages replied-to `<wiggli-…@calendar.wiggli.local>` IDs never grouped into
one conversation because those referenced addresses did not exist after
delivery. Consequently `sendInviteEmail` (src/lib/google/gmail.ts) reads the
delivered message back via `users.messages.get(format:"metadata")`
immediately after send and returns Gmail's ACTUAL `Message-ID` as
`rfcMessageId`; callers must use that returned value (never their own)
for subsequent `In-Reply-To`/`References`.

### Gmail New-Sender RSVP Gate

When an organizer sends calendar invitations to a recipient who has never
interacted with that sender before, Gmail suppresses the interactive
Yes/No/Maybe card on SOME of the burst and replaces it with a gray banner:
"This event isn't in your calendar yet. You haven't interacted with
<sender> before…" with `[Add to calendar] [Report spam]`. Typically the
first processed message renders a full card and later same-second messages
hit the gate (observed live 2026-08-26: 1 message with card + 3 with banner
across two split conversations). This is Google anti-spam behavior, not a
MIME/header defect — no header combination bypasses it. It self-heals once
the recipient clicks "Add to calendar", RSVPs, or replies once; subsequent
invitations from that sender render cards normally.

### AI Request JSON Derived From Step 1

The canonical document keeps `attendees` and `linkedTo` separate. Before generation, the server derives explicit attendance metadata so the model cannot confuse a contextual record with a participant. This example shows an internal-only event that has candidate and job records linked as context:

```json
{
  "event": {
    "type": {
      "id": "interview",
      "name": "Interview",
      "context": "A structured conversation to evaluate a candidate's experience and suitability for a job opportunity."
    },
    "titleSupportingContext": "Second interview - Senior UX Designer",
    "descriptionSupportingContext": "This is a second technical interview focused on design-system experience and salary expectations."
  },
  "attendance": {
    "actualAttendees": [
      {
        "id": "internal-789",
        "fullName": "Sarah Martin",
        "type": "internal"
      }
    ],
    "linkedRecordAttendance": [
      {
        "linkedRecordId": "candidate-123",
        "linkedRecordType": "Candidate",
        "variable": "[Linked.Candidate]",
        "status": "context_only",
        "attendeeType": null
      },
      {
        "linkedRecordId": "job-456",
        "linkedRecordType": "Job",
        "variable": "[Linked.Job]",
        "status": "context_only",
        "attendeeType": null
      }
    ]
  },
  "audiences": [
    {
      "type": "internal",
      "audienceContext": "An internal colleague. Use the attendee composition to frame an internal discussion or a session with external participants accurately.",
      "recipients": [
        {
          "id": "internal-789",
          "fullName": "Sarah Martin",
          "type": "internal"
        }
      ],
      "allowedContextVariables": [
        "[Linked.Candidate]",
        "[Linked.Job]"
      ],
      "linkedRecords": [
        {
          "type": "Candidate",
          "id": "candidate-123",
          "label": "Mustapha Boufous",
          "variable": "[Linked.Candidate]",
          "attendanceStatus": "context_only",
          "attendeeType": null
        },
        {
          "type": "Job",
          "id": "job-456",
          "label": "Senior UX Designer",
          "variable": "[Linked.Job]",
          "attendanceStatus": "context_only",
          "attendeeType": null
        }
      ]
    }
  ]
}
```

`actualAttendees` is the only source of participation truth. A linked record marked `context_only` may explain what the event concerns, but the generated paragraph must not state or imply that it is attending.

## 6. AI Context Priority

The AI receives context in this order:

| Priority | Input | Purpose |
|---|---|---|
| 1 | Event type and its backend context | Defines what kind of meeting this is |
| 2 | Actual attendees and their types | Defines who is participating and whether the session is internal or external |
| 3 | Linked-to records with attendance status | Defines what the event concerns without assuming participation |
| 4 | Event title | Provides supporting clues such as "second interview" or "salary discussion" |
| 5 | Event description | Provides supporting detail such as technical focus, interview stage, or salary expectations |

Event title and description are supporting context only. The AI must not output `[Event.Title]` or `[Event.Description]` in the context paragraph.

The deterministic details block displays those values separately.

### Default Event Types

The default order and AI context descriptions are:

| Order | Name | AI context description |
|---|---|---|
| 1 | Call | A phone conversation to discuss, clarify, or follow up on a specific topic. |
| 2 | Interview | A structured conversation to evaluate a candidate's experience and suitability for a job opportunity. |
| 3 | Meeting | A general discussion to share information, align on a topic, or agree on next steps. |
| 4 | Job intake | A discussion to gather requirements, responsibilities, expectations, and hiring needs for a job opening. |

Users can rename, describe, reorder, delete, or add event types in the Event Type custom-field manager. The saved description becomes the event type context sent to the AI. The event drawer displays saved event types in that order, followed by the `Add custom event type` action.

### Description Visibility

Because Description is included in the email details and the iCalendar DESCRIPTION, the Step 1 description must be treated as attendee-facing content. Internal confidential notes must use a separate field and must never be sent to AI or attendees.

## 7. AI Output Scope

The AI generates one context paragraph per attendee audience.

The paragraph should have enough space to feel customized without becoming long:

- One paragraph.
- Two to three sentences.
- Target 45 to 75 words.
- Hard maximum 90 words.
- Formal, natural, and clear.
- No bullets.
- No greeting.
- No signature.
- No event details list.
- No RSVP instructions.
- No HTML.

Example candidate paragraph:

```text
You are invited to a second-stage technical interview regarding [Linked.Job] at [Linked.Organization]. The conversation will focus on your design-system experience and provide an opportunity to discuss salary expectations and the next steps in the process.
```

Example contact paragraph when the linked candidate is also marked `attending`:

```text
You are invited to participate in a second-stage technical interview with [Linked.Candidate] regarding [Linked.Job] at [Linked.Organization]. The session will focus on design-system experience, salary expectations, and the candidate's suitability for the next stage of the process.
```

## 8. Audience-Safe Linked Records and Attendance

The AI must never mention a recipient as if they were a different participant.

Linked records and attendees serve different purposes:

| Input | Meaning |
|---|---|
| `attendees` | People who will receive invitations and participate in the event |
| `linkedTo` | People, jobs, opportunities, or organizations that provide subject context |

For every linked record, compare its ID with the attendee IDs and derive:

- `attending`: the same entity is in the attendee list and may be described as participating.
- `context_only`: the entity is not in the attendee list and must not be described as joining, meeting, interviewing, or being present.

When every actual attendee is internal, the copy must describe an internal discussion even if candidates or contacts are linked. Those records may still explain what or whom the internal discussion concerns.

Audience variable filtering rules:

| Audience | Records excluded from AI context |
|---|---|
| Candidate or freelancer | Linked Candidate records |
| Contact | Linked Contact records |
| Internal attendee | Linked Internal records, if that linked type is added later |

Safe default: exclude all linked records matching the recipient audience type.

Example:

```ts
function linkedRecordsForAudience(
  audience: "candidate" | "contact" | "internal",
  linkedTo: SmartLinkedRecord[]
) {
  return linkedTo.filter((record) => {
    if (audience === "candidate" && record.type === "candidate") return false;
    if (audience === "contact" && record.type === "contact") return false;
    if (audience === "internal" && record.type === "internal") return false;
    return true;
  });
}
```

The filtered linked records determine the only `[Linked.*]` chips the AI is allowed to use for that audience.
Filtering controls which variables are available; `attendanceStatus` independently controls whether a linked entity may be described as participating.

## 9. AI Request and Response

The application should make one AI request for all required audiences.

Recommended system rules:

```text
You generate one formal context paragraph for each requested calendar-invitation audience.

Use the event type as the primary purpose.
Use only the provided allowed linked records.
Use actualAttendees as the only source of who participates.
Use the title and description as supporting context.

Rules:
- Return valid JSON only.
- Write one paragraph per requested audience.
- Write two or three sentences per paragraph.
- Target 45-75 words and never exceed 90 words.
- Do not write a greeting, subject, details list, RSVP note, signature, or HTML.
- Do not output [Event.Title] or [Event.Description].
- Only use the provided allowed [Linked.*] variables.
- Whenever referring to an allowed linked record, use its exact [Linked.*] variable rather than its literal label, name, or title.
- Do not repeat a linked record's literal label from the title or description when that record is not explicitly linked.
- Do not mention absent linked records.
- Do not mention the recipient's own linked entity.
- Never describe a context_only linked record as attending, joining, meeting, interviewing, or being present.
- Only describe a linked person as participating when that record is marked attending.
- If only internal attendees are present, frame the event as an internal discussion.
- Use attendee types to understand participation, but do not list attendee names in the context paragraph.
- Do not invent people, jobs, opportunities, organizations, dates, locations, or URLs.
- Use only useful attendee-facing information from the title and description.
```

Recommended generation settings:

```json
{
  "temperature": 0.3,
  "maxOutputTokens": 400
}
```

Expected response:

```json
{
  "draftVersion": 1,
  "paragraphs": {
    "candidate": "You are invited to a second-stage technical interview regarding [Linked.Job] at [Linked.Organization]. The conversation will focus on your design-system experience and provide an opportunity to discuss salary expectations and the next steps in the process.",
    "contact": "You are invited to participate in a second-stage technical interview with [Linked.Candidate] regarding [Linked.Job] at [Linked.Organization]. The session will focus on design-system experience, salary expectations, and the candidate's suitability for the next stage of the process.",
    "internal": "You are invited to join a second-stage technical interview with [Linked.Candidate] regarding [Linked.Job] at [Linked.Organization]. The session will cover design-system experience, salary expectations, and the candidate's readiness for the next stage."
  }
}
```

## 10. AI Output Validation

The server must validate every AI paragraph before returning it to the drawer.

Required validation:

- Output is valid JSON.
- Only requested audience keys are present.
- Every value is a non-empty string.
- Maximum 90 words.
- No HTML tags.
- No greeting or signature block.
- No unsupported `[Token]` values.
- No `[Event.Title]`, `[Event.Description]`, date, location, attendee-list, organizer, or RSVP variables.
- Every `[Linked.*]` variable is in that audience's `allowedContextVariables` list.

If validation fails, use a deterministic fallback paragraph assembled from the event type and allowed linked records.

## 11. Deterministic Email Structure

Every invitation begins with the same application-generated structure.

```text
Subject: Invitation: [Event.Title]

Hello [Recipient.First_name],

[AI context paragraph]

Event details

- Title: [Event.Title]
- Description: [Event.Description]
- When: [Event.Date] - [Event.Start_time] to [Event.End_time]
- Where: [location type] - [location value]
- Organizer: [Organizer.Name] ([Organizer.Email])
- Guests:
  [Attendees.List]

Please respond with Yes, Maybe or No from the calendar invitation. Your response will be synchronized automatically.

Best regards,

The Wiggli Team
```

Conditional rows:

- Omit Description when no description was entered.
- Omit Where when no location was selected.
- Use `Online - [Meeting.Link]` for generated online meetings.
- Use `Company address - [Event.Location]` for company locations.
- Use `Other location - [Event.Location]` for custom locations.
- Use the provider-specific link variable only when that integration provides one.

## 12. Rich Editor and Chips

The entire assembled invitation remains inside the current rich editor.

The user can:

- Apply bold, italic, underline, bullet lists, and numbered lists.
- Edit any text.
- Remove a chip.
- Move a chip.
- Insert another available chip.
- Rewrite the AI paragraph manually.
- Change the greeting.
- Remove or rewrite deterministic explanatory text before sending.

The AI remains restricted even though the user is unrestricted.

### Block Markers

The first draft should use stable block markers:

```html
<div data-smart-block="greeting">...</div>
<div data-smart-block="ai-context">...</div>
<div data-smart-block="event-details">...</div>
<div data-smart-block="rsvp-note">...</div>
<div data-smart-block="signature">...</div>
```

The complete document is editable. Block markers exist to scope AI regeneration and must not make the content read-only.

### Regeneration

Rename the button to:

```text
Regenerate context paragraph
```

Regeneration replaces only the contents of:

```html
[data-smart-block="ai-context"]
```

It must preserve:

- User formatting elsewhere.
- Edited greeting.
- Fixed details.
- Chips moved or removed outside the AI block.
- RSVP note.
- Signature.

If the user deletes the AI block completely, regeneration inserts a new AI block after the greeting.

## 13. Variable Vocabulary

### Recipient Variables

```text
[Candidate.First_name]
[Contact.First_name]
[Internal.First_name]
```

Only the greeting variable appropriate for the active audience should be inserted initially.

### Linked Variables Available to AI

```text
[Linked.Candidate]
[Linked.Contact]
[Linked.Job]
[Linked.Opportunity]
[Linked.Organization]
```

The AI may use only the linked variables allowed for that audience.

### Fixed Template Variables

```text
[Event.Title]
[Event.Description]
[Event.Date]
[Event.Start_time]
[Event.End_time]
[Event.Location]
[Meeting.Link]
[Organizer.Name]
[Organizer.Email]
[Organizer.Phone]
[Attendees.List]
```

`[Attendees.List]` must resolve to attendee full names and email addresses:

```text
- Mustapha Boufous (mustapha@example.com)
- John Smith (john@company.com)
- Sarah Martin (sarah@wiggli.com)
```

### Chip Availability

The chip bar must show only values available from Step 1.

Examples:

- No description: hide `[Event.Description]`.
- No physical location: hide `[Event.Location]`.
- No online meeting: hide `[Meeting.Link]`.
- No linked job: hide `[Linked.Job]`.
- No linked candidate: hide `[Linked.Candidate]`.
- The default Smart Event signature is fixed text and contains no variables.

## 14. Subject

The initial subject is deterministic and editable:

```text
Invitation: [Event.Title]
```

The AI does not generate or regenerate the subject.

## 15. HTML Email Rendering

Use simple email-safe HTML with inline styles.

Requirements:

- Maximum width around 600px.
- White background.
- System font stack.
- No complex branding frame.
- No JavaScript.
- No external stylesheets.
- No unsupported CSS layout dependencies.
- Escape all user-provided text.
- Preserve safe rich-text formatting from the editor.
- Sanitize user-edited HTML before sending.

The plain-text alternative must contain the same information in readable text form.

## 16. iCalendar Event Requirements

The invitation email and iCalendar event are separate representations of the same event. Both must be generated from `SmartEventDocument`.

Every attendee receives the same event details and their own recipient-specific email text.

Required VCALENDAR properties:

```text
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Wiggli//Smart Event//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
```

Required VEVENT properties:

```text
BEGIN:VEVENT
UID:<stable UID shared with the organizer calendar event>
SEQUENCE:<integer revision>
DTSTAMP:<UTC timestamp>
DTSTART:<UTC timestamp>
DTEND:<UTC timestamp>
SUMMARY:<event title>
DESCRIPTION:<detailed event information>
LOCATION:<physical location or online meeting URL>
ORGANIZER;CN=<organizer full name>:mailto:<organizer email>
ATTENDEE;CN=<guest full name>;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:<guest email>
STATUS:CONFIRMED
TRANSP:OPAQUE
URL:<meeting URL when available>
END:VEVENT
END:VCALENDAR
```

Required behavior:

- One ATTENDEE line per guest.
- Every attendee line includes `RSVP=TRUE`.
- Initial `PARTSTAT=NEEDS-ACTION`.
- The UID must match the event created in the organizer calendar.
- Sequence must increase for event updates.
- Dates must be valid RFC 5545 values.
- Long lines must use RFC 5545 folding.
- Text fields must escape backslash, comma, semicolon, and newline characters.
- Include a VALARM when the user selected a reminder.

## 17. iCalendar DESCRIPTION Content

The calendar event must contain enough information to be useful independently of the email.

Recommended DESCRIPTION:

```text
<event description when present>

Event: <event title>
Type: <event type>
When: <formatted date/time and timezone>
Where: <location type and full location/link>
Organizer: <full name> (<email>)
Guests:
- <full name> (<email>)
- <full name> (<email>)

Please respond with Yes, Maybe, or No from your calendar application.
```

The details can appear in both the email and the iCalendar event. This is intentional: the email explains the invitation, while the calendar item remains useful after the email is closed.

## 18. Google, Outlook, and Apple Calendar Compatibility

All clients must receive the same standards-compliant ICS data, but each client controls its own visual rendering. Wiggli cannot guarantee identical card styling across Google Calendar, Outlook, and Apple Calendar.

Compatibility delivery structure:

```text
multipart/mixed
|- multipart/alternative
|  |- text/plain
|  `- text/html
|- text/calendar; method=REQUEST; charset=UTF-8 (inline)
`- application/ics; name="invite.ics" (attachment)
```

Client notes:

| Client | Important behavior |
|---|---|
| Gmail / Google Calendar | Uses matching UID and attendee list to associate the invitation with the Google event |
| Outlook | Reads METHOD:REQUEST, ORGANIZER, ATTENDEE, UID, SEQUENCE, and RSVP properties |
| Apple Mail / Calendar | Benefits from the inline `text/calendar; method=REQUEST` part and standard UTC dates |

Optional Outlook interoperability fields may be added after client testing, such as busy-status extensions, but they must not replace standard RFC 5545 properties.

## 19. RSVP Status Mapping

Wiggli RSVP statuses:

| iCalendar / provider value | Wiggli value | UI label |
|---|---|---|
| NEEDS-ACTION / needsAction | NEEDS_ACTION | Pending |
| ACCEPTED / accepted | ACCEPTED | Accepted / Yes |
| TENTATIVE / tentative | TENTATIVE | Tentative / Maybe |
| DECLINED / declined | DECLINED | Declined / No |

## 20. RSVP Synchronization Architecture

### Google Responses

The Google Calendar event is currently the organizer's authoritative calendar event.

Flow:

```text
Attendee responds in Google Calendar
        |
        v
Google updates attendee responseStatus
        |
        v
Wiggli /api/sync reads the Google event
        |
        v
Local Attendee.rsvp is updated
        |
        v
Calendar preview dialog displays the new status
```

### Outlook and Apple Responses

Outlook and Apple Calendar normally send an iCalendar `METHOD:REPLY` response back to the organizer.

Matching UID often allows Google Calendar to update the organizer's event, after which the existing Google sync path works. However, relying only on provider-side interpretation is not sufficient for a guaranteed cross-client implementation.

For reliable Outlook and Apple synchronization, implement inbound RSVP ingestion:

```text
Outlook / Apple sends METHOD:REPLY email
        |
        v
Organizer Gmail receives the reply
        |
        v
Gmail push notification or History API detects the message
        |
        v
Wiggli fetches and parses the text/calendar MIME part
        |
        v
Validate UID + ORGANIZER + ATTENDEE
        |
        v
Read ATTENDEE PARTSTAT
        |
        v
Update local RSVP status
        |
        v
Patch the Google event with sendUpdates="none"
```

Required reply fields:

```text
METHOD:REPLY
UID:<same UID as the request>
ATTENDEE;PARTSTAT=ACCEPTED|TENTATIVE|DECLINED:mailto:<attendee email>
ORGANIZER:mailto:<organizer email>
```

### Important Current-State Caveat

The current application synchronizes authoritative statuses by reading Google Calendar. Universal Outlook/Apple reliability requires the inbound `METHOD:REPLY` ingestion described above. This work must be treated as a required implementation item, not assumed complete merely because an ICS attachment exists.

## 21. Security and Validation

- Sanitize custom rich-editor HTML before sending.
- Escape all event, attendee, organizer, and linked-record values.
- Never send internal-only notes to AI, email, or ICS.
- Validate attendee email addresses.
- Deduplicate attendees by normalized lowercase email.
- Validate AI output against allowed variables per audience.
- Do not trust AI-generated HTML because AI must return plain JSON text only.
- Validate inbound RSVP organizer, UID, and attendee before applying status changes.
- Store inbound response audit information for troubleshooting.

## 22. Recommended File Architecture

New files:

```text
src/lib/smart-event-schema.ts
src/lib/smart-event-context.ts
src/lib/smart-email-template.ts
src/lib/ical-reply-parser.ts
src/app/api/inbound-calendar-replies/route.ts
```

Responsibilities:

| File | Responsibility |
|---|---|
| `smart-event-schema.ts` | Canonical JSON types, normalization, and validation |
| `smart-event-context.ts` | Audience filtering, attendee/linked-record participation metadata, allowed AI variables, deterministic fallback paragraphs |
| `smart-email-template.ts` | Fixed draft assembly, HTML rendering, plain-text rendering, location formatting |
| `ical-reply-parser.ts` | Parse METHOD:REPLY, UID, attendee email, and PARTSTAT |
| `inbound-calendar-replies/route.ts` | Receive/process provider notifications or queued inbound replies |

Files to modify:

| File | Change |
|---|---|
| `src/components/event-drawer.tsx` | Build one SmartEventDocument and assemble the fixed editable draft |
| `src/components/rich-body-editor.tsx` | Preserve block markers and variable chips |
| `src/app/api/invite-draft/route.ts` | Accept SmartEventDocument and return context paragraphs only |
| `src/lib/gemini.ts` | Replace full-email generation with one constrained multi-audience paragraph call |
| `src/lib/event-types.ts` | Define ordered defaults, persist custom descriptions/order, and migrate legacy defaults |
| `src/app/api/drawer-events/route.ts` | Accept the canonical document and reviewed draft |
| `src/lib/events-service.ts` | Resolve chips, render final email, create ICS, and send per recipient |
| `src/lib/invite-variables.ts` | Add organizer email/phone variables and restrict AI-allowed variable subset |
| `src/lib/ics.ts` | Ensure complete DESCRIPTION, organizer CN, attendee RSVP fields, sequence, and alarms |
| `src/lib/google/gmail.ts` | Preserve calendar MIME parts and per-recipient Gmail threading headers (`Message-ID` / `In-Reply-To` / `References`) for multi-slot delivery; after send, read back Gmail's ACTUAL delivered Message-ID (Gmail regenerates authored ones) and return it as `rfcMessageId` |
| `src/lib/sync-service.ts` | Merge provider and inbound METHOD:REPLY statuses |

## 23. Migration From Current Implementation

1. Introduce `SmartEventDocument` without changing the current email flow.
2. Build and inspect the document when entering Step 2.
3. Change Gemini to return only audience context paragraphs.
4. Add deterministic draft assembly with block markers and existing chips.
5. Change Regenerate to replace only the AI context block.
6. Add fixed organizer email/phone variables and guest email rendering.
7. Change the send API to receive the reviewed assembled drafts plus the canonical document.
8. Keep the existing Google Calendar and Gmail delivery pipeline.
9. Add cross-client ICS fixtures and rendering tests.
10. Implement inbound METHOD:REPLY parsing for reliable Outlook/Apple synchronization.
11. Derive attendance status by matching linked-record IDs against actual attendee IDs before AI generation.

## 24. Multi-Slot Delivery — Verified Facts (2026-08-26, live Gmail)

1. Gmail renders **at most one invitation card per message**; a multi-VEVENT
   ICS surfaces only its first VEVENT. One-email-N-cards is impossible in
   Gmail (works in Apple Mail/Outlook). Solution in place: N chained emails,
   each with a single-VEVENT ICS, all in one conversation via `threadId` +
   RFC headers.
2. Gmail **regenerates outgoing Message-IDs**. Chain replies using the ID
   read back from the API after send, never an authored `<wiggli-…>` ID.
3. Gmail's **new-sender gate** may replace cards with the gray
   "Add to calendar" banner for recipients who never interacted with the
   organizer. Not fixable via MIME; clears after one interaction.
4. The attendee's RSVP on any slot's card updates that slot's Google event
   (UID mapping is per-slot by design).

## 25. Acceptance Criteria

### Draft Generation

- Entering Step 2 creates exactly one canonical JSON document.
- One AI call returns paragraphs for all attendee audiences present.
- Each paragraph is two or three sentences and no more than 90 words.
- Title and description influence wording but do not appear as AI variables.
- AI output contains only allowed `[Linked.*]` variables.
- Candidate messages do not mention the linked candidate as another person.
- Contact messages do not mention the linked contact as another person.
- The AI request includes every actual attendee with their attendee type.
- Every allowed linked record is marked `attending` or `context_only`.
- A context-only candidate or contact is never described as participating.
- An internal-only attendee list produces internal-meeting wording even when external people are linked.

### Editor

- The first draft contains greeting, AI paragraph, details, RSVP note, and signature.
- Variable chips are visible and editable.
- User can remove, move, and insert available chips.
- Toolbar formatting remains functional.
- Regenerate changes only the AI context paragraph.
- Other user edits survive regeneration.

### Email

- Every attendee receives the template for their attendee audience.
- First-name greeting resolves per recipient.
- All remaining chips resolve before delivery.
- Description row is omitted when empty.
- Location label and value match the Step 1 selection.
- Guests contain names and email addresses.
- HTML and plain-text versions contain equivalent information.
- Every Smart Event slot is delivered hybrid: Google's native invitation (`sendUpdates: "all"`) with the interactive Gmail Yes/No/Maybe card + the branded HTML+ICS email threaded together.
- Multi-slot emails use one stable branded subject per recipient and append to one Gmail thread via `threadId` + RFC threading headers.
- Multi-slot native calendar cards (Google invites + ICS) use the base title with `(Slot N)` while the branded email subject remains unsuffixed.

### Calendar

- Every invitation includes inline `text/calendar; method=REQUEST`.
- Every invitation includes an attached `.ics` file.
- UID matches the organizer calendar event.
- Every attendee has `RSVP=TRUE` and `PARTSTAT=NEEDS-ACTION` initially.
- Event title, description, date/time, location, organizer, guests, URL, and reminder appear in ICS when provided.
- Every multi-slot Google event and ICS SUMMARY includes its correct `(Slot N)` suffix.
- Invitations are tested in current Gmail/Google Calendar, Outlook, and Apple Mail/Calendar clients.

### Synchronization

- Google responses update Wiggli through Calendar API sync.
- Outlook and Apple `METHOD:REPLY` fixtures are parsed correctly.
- ACCEPTED, TENTATIVE, and DECLINED map correctly to Wiggli statuses.
- Duplicate replies are idempotent.
- Unknown UID, organizer, or attendee replies are rejected or quarantined.
- Preview dialog displays the latest synchronized statuses.

## 25. Testing Matrix

Required audiences:

```text
Candidate only
Contact only
Internal only
Candidate + Contact
Candidate + Internal
Contact + Internal
Candidate + Contact + Internal
```

Required linked combinations:

```text
No linked records
Candidate
Contact
Job
Opportunity
Organization
Candidate + Job
Candidate + Job + Organization
Contact + Job + Organization
```

Required attendance/context combinations:

```text
Linked candidate attending
Linked candidate context-only
Linked contact attending
Linked contact context-only
Candidate + contact linked, internal attendees only
Job + candidate + contact linked, internal attendees only
```

Required location combinations:

```text
No location
Google Meet
Manual online URL
Company address
Custom address
```

Required calendar clients:

```text
Gmail / Google Calendar
Outlook desktop
Outlook web
Apple Mail / Calendar
```

Required RSVP actions:

```text
Accept / Yes
Tentative / Maybe
Decline / No
Change response after the first reply
Duplicate reply delivery
```

## 26. Final Ownership Boundary

```text
AI owns:
The initial context paragraph for each attendee audience.

Wiggli owns:
The canonical event JSON, subject, greeting, details, RSVP note,
signature, chips, variable resolution, HTML, plain text, ICS,
delivery, validation, and synchronization.

User owns:
The reviewed final invitation and any edits made before sending.
```
