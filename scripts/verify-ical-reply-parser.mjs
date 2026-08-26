import assert from "node:assert/strict";
import {
  IcalReplyParseError,
  parseIcalReply,
} from "../src/lib/ical-reply-parser.ts";

const foldedReply = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "METHOD:REPLY",
  "BEGIN:VEVENT",
  "UID:event-123@example.com",
  "ORGANIZER;CN=Calendar Owner:MAILTO:Owner@Example.COM",
  'ATTENDEE;CN="Guest; One";PARTSTAT="accep',
  ' ted":MAILTO:Guest@',
  " Example.COM",
  "END:VEVENT",
  "END:VCALENDAR",
  "",
].join("\r\n");

assert.deepEqual(parseIcalReply(foldedReply), {
  uid: "event-123@example.com",
  organizerEmail: "owner@example.com",
  attendeeEmail: "guest@example.com",
  status: "ACCEPTED",
});

const lowercaseLfReply = [
  "begin:vcalendar",
  "method:reply",
  "begin:vevent",
  "uid:event-456@example.com",
  'organizer;cn="Owner, Example":owner@example.com',
  'attendee;partstat="tentative";rsvp=true:mailto:guest@example.com',
  "end:vevent",
  "end:vcalendar",
].join("\n");

assert.deepEqual(parseIcalReply(lowercaseLfReply), {
  uid: "event-456@example.com",
  organizerEmail: "owner@example.com",
  attendeeEmail: "guest@example.com",
  status: "TENTATIVE",
});

const validReply = [
  "BEGIN:VCALENDAR",
  "METHOD:REPLY",
  "BEGIN:VEVENT",
  "UID:event-789@example.com",
  "ORGANIZER:mailto:owner@example.com",
  "ATTENDEE;PARTSTAT=DECLINED:mailto:guest@example.com",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

assert.equal(parseIcalReply(validReply).status, "DECLINED");

const invalidReplies = [
  {
    ics: validReply.replace("METHOD:REPLY", "METHOD:REQUEST"),
    message: /METHOD must be REPLY/,
  },
  {
    ics: validReply.replace("UID:event-789@example.com\r\n", ""),
    message: /missing UID/,
  },
  {
    ics: validReply.replace("ORGANIZER:mailto:owner@example.com\r\n", ""),
    message: /missing ORGANIZER/,
  },
  {
    ics: validReply.replace(
      "ATTENDEE;PARTSTAT=DECLINED:mailto:guest@example.com\r\n",
      ""
    ),
    message: /missing ATTENDEE/,
  },
  {
    ics: validReply.replace(";PARTSTAT=DECLINED", ""),
    message: /missing PARTSTAT/,
  },
  {
    ics: validReply.replace("PARTSTAT=DECLINED", "PARTSTAT=NEEDS-ACTION"),
    message: /Unsupported iCalendar PARTSTAT/,
  },
];

for (const { ics, message } of invalidReplies) {
  assert.throws(
    () => parseIcalReply(ics),
    (error) => error instanceof IcalReplyParseError && message.test(error.message)
  );
}

console.log("iCalendar METHOD:REPLY parser verification passed.");
