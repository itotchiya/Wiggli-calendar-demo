import assert from "node:assert/strict";
import { buildInviteMime } from "../src/lib/google/gmail.ts";
import { buildRequestIcs } from "../src/lib/ics.ts";
import { parseIcalReply } from "../src/lib/ical-reply-parser.ts";

const organizerAlias = "organizer-abc123@events.example.com";
const organizerEmail = "owner@example.com";
const attendeeEmail = "candidate@example.net";
const startUtc = new Date("2026-09-15T09:00:00.000Z");
const endUtc = new Date("2026-09-15T09:30:00.000Z");

const ics = buildRequestIcs({
  prodId: "-//Wiggli//Resend RSVP//EN",
  uid: "slot-1@example.com",
  sequence: 0,
  organizer: { email: organizerAlias, name: "Wiggli Calendar" },
  attendees: [
    { email: attendeeEmail, name: "Candidate, Example", partstat: "NEEDS-ACTION", rsvp: true, includeGuestCount: false },
    { email: organizerEmail, name: "Owner Example", partstat: "ACCEPTED", rsvp: false, includeGuestCount: false },
  ],
  title: "Interview; backend",
  description: "Short description, with punctuation; and\na newline.",
  location: "Online, Google Meet",
  startUtc,
  endUtc,
  url: "https://meet.google.com/abc-defg-hij",
});

assert.match(ics, /\r\nMETHOD:REQUEST\r\n/);
assert.match(ics, /PRODID:-\/\/Wiggli\/\/Resend RSVP\/\/EN/);
const unfoldedIcs = ics.replace(/\r\n[ \t]/g, "");
assert.match(unfoldedIcs, /ORGANIZER;CN="Wiggli Calendar":mailto:organizer-abc123@events\.example\.com/);
assert.match(unfoldedIcs, /PARTSTAT=NEEDS-ACTION;RSVP=TRUE;/);
assert.match(unfoldedIcs, /PARTSTAT=ACCEPTED;CN="Owner Example":mailto:owner@example\.com/);
assert(!/PARTSTAT=ACCEPTED;RSVP=TRUE/.test(unfoldedIcs));
assert.match(ics, /SUMMARY:Interview\\; backend/);
assert.match(ics, /DESCRIPTION:Short description\\, with punctuation\\; and\\na newline\./);
assert(!/(^|[^\r])\n/.test(ics), "ICS must use CRLF only");
for (const line of ics.split("\r\n")) {
  assert(Buffer.byteLength(line, "utf8") <= 75, `Unfolded line exceeds 75 octets: ${line}`);
}

const rootMessageId = "<wiggli-root@events.example.com>";
const childMessageId = "<wiggli-child@events.example.com>";
const raw = buildInviteMime({
  from: '"Wiggli Calendar" <organizer-abc123@events.example.com>',
  replyTo: organizerAlias,
  to: [attendeeEmail],
  subject: "Invitation: Backend interview",
  html: "<p>Please choose this slot.</p>",
  text: "Please choose this slot.",
  icsContent: ics,
  icsFilename: "invite-slot-2.ics",
  messageId: childMessageId,
  inReplyTo: rootMessageId,
  references: [rootMessageId],
  idempotencyKey: "calendar/event-2/attendee-1/0",
  date: new Date("2026-09-01T12:00:00.000Z"),
});

assert.match(raw, /Content-Type: multipart\/mixed/);
assert.match(raw, /Content-Type: multipart\/alternative/);
assert.equal((raw.match(/Content-Type: text\/calendar; method=REQUEST/g) ?? []).length, 1);
assert.equal((raw.match(/Content-Disposition: inline; filename="invite-slot-2\.ics"/g) ?? []).length, 1);
assert.equal((raw.match(/Content-Disposition: attachment; filename="invite-slot-2\.ics"/g) ?? []).length, 1);
assert.match(raw, /Message-ID: <wiggli-child@events\.example\.com>/);
assert.match(raw, /In-Reply-To: <wiggli-root@events\.example\.com>/);
assert.match(raw, /References: <wiggli-root@events\.example\.com>/);
assert.match(raw, /Resend-Idempotency-Key: calendar\/event-2\/attendee-1\/0/);
const encodedCalendar = Buffer.from(ics, "utf8").toString("base64");
assert.equal(raw.replace(/\r\n/g, "").split(encodedCalendar).length - 1, 2);

const reply = parseIcalReply([
  "BEGIN:VCALENDAR",
  "METHOD:REPLY",
  "BEGIN:VEVENT",
  "UID:slot-1@example.com",
  "SEQUENCE:0",
  `ORGANIZER:mailto:${organizerAlias}`,
  `ATTENDEE;PARTSTAT=ACCEPTED:mailto:${attendeeEmail}`,
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n"));
assert.deepEqual(reply, {
  uid: "slot-1@example.com",
  organizerEmail: organizerAlias,
  attendeeEmail,
  status: "ACCEPTED",
  sequence: 0,
});

console.log("Resend RSVP ICS, MIME, threading, and reply verification passed.");
