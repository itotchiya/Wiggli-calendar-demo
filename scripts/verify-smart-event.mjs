import assert from "node:assert/strict";
import {
  buildSmartAudiences,
  eventTitleForSlot,
  parseSmartEventDocument,
} from "../src/lib/smart-event-schema.ts";
import {
  fallbackContextParagraphs,
  promptAttendancePayload,
  promptAudiencePayload,
  validateContextParagraphs,
} from "../src/lib/smart-event-context.ts";
import { buildSmartInvitationHtml } from "../src/lib/smart-email-template.ts";
import { buildSmartContextPromptPayload } from "../src/lib/gemini.ts";
import { buildRequestIcs } from "../src/lib/ics.ts";
import { buildInviteMime } from "../src/lib/google/gmail.ts";

const linkedTo = [
  { type: "Candidate", id: "candidate-1", label: "Mustapha Boufous", variable: "[Linked.Candidate]" },
  { type: "Contact", id: "contact-1", label: "John Smith", variable: "[Linked.Contact]" },
  { type: "Job", id: "job-1", label: "Senior UX Designer", variable: "[Linked.Job]" },
  { type: "Organization", id: "org-1", label: "Wiggli", variable: "[Linked.Organization]" },
];
const attendees = [
  { id: "candidate-1", type: "candidate", fullName: "Mustapha Boufous", email: "mustapha@example.com" },
  { id: "contact-1", type: "contact", fullName: "John Smith", email: "john@example.com" },
  { id: "internal-1", type: "internal", fullName: "Sarah Martin", email: "sarah@wiggli.com" },
];

const document = parseSmartEventDocument({
  schemaVersion: 1,
  event: {
    title: "Second interview - Senior UX Designer",
    type: { id: "interview", name: "Interview", context: "A formal candidate interview." },
    description: "Second technical interview focused on design systems and salary expectations.",
    date: "2026-08-28",
    startTime: "10:00",
    endTime: "10:30",
    timezone: "Europe/Paris",
    location: { type: "online", label: "Online", provider: "google", generatedOnCreate: true },
    reminderMinutes: 15,
  },
  organizer: { fullName: "Axelle Bastin", email: "axelle@wiggli.com", phone: "BE +32456555992" },
  linkedTo,
  attendees,
  audiences: buildSmartAudiences(attendees, linkedTo),
});

const candidate = document.audiences.find((item) => item.type === "candidate");
const contact = document.audiences.find((item) => item.type === "contact");
assert(candidate && !candidate.allowedContextVariables.includes("[Linked.Candidate]"));
assert(contact && !contact.allowedContextVariables.includes("[Linked.Contact]"));
assert(candidate.allowedContextVariables.includes("[Linked.Job]"));
assert.equal(eventTitleForSlot(document.event.title, 0, 1), document.event.title);
assert.equal(eventTitleForSlot(document.event.title, 0, 2), `${document.event.title} (Slot 1)`);
assert.equal(eventTitleForSlot(document.event.title, 1, 2), `${document.event.title} (Slot 2)`);

const paragraphs = fallbackContextParagraphs(document);
assert(paragraphs.candidate?.includes("[Linked.Job]"));
assert(!paragraphs.candidate?.includes("[Linked.Candidate]"));
assert(paragraphs.contact?.includes("[Linked.Candidate]"));

const html = buildSmartInvitationHtml(document, "candidate", paragraphs.candidate);
assert(html.includes('data-smart-block="ai-context"'));
assert(html.includes("<p><strong>Event details</strong></p>"));
assert(html.includes("<li>Title: [Event.Title]</li>"));
assert(html.includes("<li>When: [Event.Date] - [Event.Start_time] to [Event.End_time]</li>"));
assert(html.includes("<li>Where: Online - [Meeting.Link]</li>"));
assert(!html.includes("<strong>Title:</strong>"));
assert(!html.includes("<strong>When:</strong>"));
assert(!html.includes("<strong>Where:</strong>"));
assert(html.includes("Online - [Meeting.Link]"));
assert(html.includes("[Organizer.Email]"));
assert(html.includes("[Attendees.List]"));
assert(html.includes("Mustapha Boufous"));
assert(html.includes('href="tel:+212636857897"'));
assert(html.includes('href="mailto:toozmust@gmail.com"'));
assert(html.includes("The Wiggli Team"));
const signature = html.slice(html.indexOf('data-smart-block="signature"'));
assert(!signature.includes("[Organizer.Name]"));
assert(!signature.includes("[Organizer.Phone]"));
assert(!signature.includes("[Organizer.Email]"));

assert.throws(() => validateContextParagraphs(document, {
  paragraphs: {
    candidate: "You are invited to meet [Linked.Candidate] for this interview. The conversation will cover technical experience and next steps in a clear and useful way.",
    contact: paragraphs.contact,
    internal: paragraphs.internal,
  },
}), /unavailable variable/);

assert.throws(() => validateContextParagraphs(document, {
  paragraphs: {
    candidate: "You are invited to a second-stage interview regarding Senior UX Designer. The conversation will focus on technical experience and next steps in a clear and useful way.",
    contact: paragraphs.contact,
    internal: paragraphs.internal,
  },
}), /use variables for linked records/);

const contactOnlyDocument = parseSmartEventDocument({
  ...document,
  event: { ...document.event, title: "Discussion with General Motors" },
  linkedTo: [linkedTo[1]],
  audiences: buildSmartAudiences(attendees, [linkedTo[1]]),
});
const contactOnlyParagraphs = fallbackContextParagraphs(contactOnlyDocument);
assert(!contactOnlyParagraphs.contact?.includes("General Motors"));
assert(!contactOnlyParagraphs.contact?.includes("[Linked.Organization]"));

const internalOnlyAttendees = [attendees[2]];
const internalOnlyDocument = parseSmartEventDocument({
  ...document,
  attendees: internalOnlyAttendees,
  audiences: buildSmartAudiences(internalOnlyAttendees, linkedTo),
});
const attendancePayload = promptAttendancePayload(internalOnlyDocument);
assert.deepEqual(attendancePayload.actualAttendees, [{
  id: "internal-1",
  fullName: "Sarah Martin",
  type: "internal",
}]);
assert(attendancePayload.linkedRecordAttendance.every((record) => record.status === "context_only"));
const internalAudiencePayload = promptAudiencePayload(internalOnlyDocument)[0];
assert.equal(internalAudiencePayload.type, "internal");
assert(internalAudiencePayload.linkedRecords.every((record) => record.attendanceStatus === "context_only"));
const internalFallback = fallbackContextParagraphs(internalOnlyDocument).internal;
assert(internalFallback?.includes("regarding [Linked.Candidate] and [Linked.Job]"));
assert(!internalFallback?.includes("with [Linked.Candidate]"));
const aiPromptPayload = buildSmartContextPromptPayload(internalOnlyDocument);
assert.equal(aiPromptPayload.attendance.actualAttendees[0].type, "internal");
assert(aiPromptPayload.audiences[0].linkedRecords.every((record) => record.attendanceStatus === "context_only"));

const ics = buildRequestIcs({
  uid: "smart-event@example.com",
  sequence: 0,
  organizer: { name: document.organizer.fullName, email: document.organizer.email },
  attendees: document.attendees.map((attendee) => ({ name: attendee.fullName, email: attendee.email })),
  title: document.event.title,
  description: document.event.description,
  location: "https://meet.google.com/abc-defg-hij",
  startUtc: new Date("2026-08-28T08:00:00Z"),
  endUtc: new Date("2026-08-28T08:30:00Z"),
  url: "https://meet.google.com/abc-defg-hij",
  reminderMinutes: 15,
});
assert(ics.includes("METHOD:REQUEST"));
assert(ics.includes("CUTYPE=INDIVIDUAL"));
assert(ics.includes("X-NUM-GUESTS=0"));
assert(ics.includes("CREATED:"));
assert(ics.includes("LAST-MODIFIED:"));
assert.equal((ics.match(/RSVP=TRUE/g) ?? []).length, document.attendees.length);
assert(ics.includes("X-MICROSOFT-CDO-BUSYSTATUS:BUSY"));
assert(ics.includes("BEGIN:VALARM"));

const mime = buildInviteMime({
  from: document.organizer.email,
  to: [document.attendees[0].email],
  subject: "Invitation: [Event.Title]",
  html,
  text: "Invitation",
  icsContent: ics,
});
assert(mime.includes("Content-Class: urn:content-classes:calendarmessage"));
assert(mime.includes('Content-Type: text/calendar; method=REQUEST; charset="UTF-8"; component="VEVENT"'));

const threadedMime = buildInviteMime({
  from: document.organizer.email,
  to: [document.attendees[0].email],
  subject: "Invitation: Interview",
  html,
  text: "Invitation",
  icsContent: ics,
  messageId: "<slot-2@calendar.wiggli.local>",
  inReplyTo: "<slot-1@calendar.wiggli.local>",
  references: ["<slot-1@calendar.wiggli.local>"],
});
assert(threadedMime.includes("Message-ID: <slot-2@calendar.wiggli.local>"));
assert(threadedMime.includes("In-Reply-To: <slot-1@calendar.wiggli.local>"));
assert(threadedMime.includes("References: <slot-1@calendar.wiggli.local>"));

console.log("Smart Event schema, audience filtering, fallback, and draft verification passed.");
