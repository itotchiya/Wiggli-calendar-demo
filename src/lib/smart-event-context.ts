import { TAB_AUDIENCE_CONTEXTS } from "./invite-variables";
import {
  allowedLinkedRecordsForAudience,
  audienceForAttendeeType,
  type SmartAudience,
  type SmartEventDocument,
  type SmartLinkedRecord,
} from "./smart-event-schema";

export type SmartContextParagraphs = Partial<Record<SmartAudience, string>>;

function contextualFocus(document: SmartEventDocument): string[] {
  const source = `${document.event.title} ${document.event.description ?? ""}`.toLowerCase();
  const focus: string[] = [];
  if (/second|2nd|second-stage/.test(source)) focus.push("the second stage of the process");
  if (/final|last stage/.test(source)) focus.push("the final stage of the process");
  if (/technical|technical assessment|coding/.test(source)) focus.push("technical experience");
  if (/salary|compensation|expectation/.test(source)) focus.push("salary expectations");
  if (/design system/.test(source)) focus.push("design-system experience");
  if (/portfolio/.test(source)) focus.push("portfolio experience");
  if (/culture|values/.test(source)) focus.push("team and culture fit");
  return [...new Set(focus)].slice(0, 3);
}

function attendeeForLinkedRecord(document: SmartEventDocument, record: SmartLinkedRecord) {
  return document.attendees.find((attendee) => attendee.id === record.id);
}

function linkedPhrase(document: SmartEventDocument, audience: SmartAudience): string {
  const records = allowedLinkedRecordsForAudience(audience, document.linkedTo);
  const find = (type: string) => records.find((record) => record.type === type);
  const person = audience === "candidate"
    ? find("Contact")
    : audience === "contact"
      ? find("Candidate")
      : find("Candidate") ?? find("Contact");
  const personAttends = person ? Boolean(attendeeForLinkedRecord(document, person)) : false;
  const job = find("Job")?.variable;
  const opportunity = find("Opportunity")?.variable;
  const organization = find("Organization")?.variable;
  const topics = [
    audience === "internal" && person && !personAttends ? person.variable : null,
    job ?? opportunity,
  ].filter((value): value is string => Boolean(value));
  return [
    person && personAttends ? ` with ${person.variable}` : "",
    topics.length ? ` regarding ${topics.join(" and ")}` : "",
    organization ? ` at ${organization}` : "",
  ].join("");
}

/** Deterministic fallback when AI is unavailable — legacy transactional tone. */
export function fallbackContextParagraph(
  document: SmartEventDocument,
  audience: SmartAudience
): string {
  const eventType = document.event.type.name.toLowerCase();
  const phrase = linkedPhrase(document, audience);
  // Legacy style: concise 1-2 sentences, transactional, ends with action.
  // phrase is like " regarding [Linked.Job] at [Linked.Organization]" or " with [Linked.Contact] ..."
  if (audience === "candidate") {
    const base = phrase
      ? `You have been invited to an interview${phrase}`
      : `You have been invited to an interview for the ${eventType}`;
    return `${base}. Please review the details below and confirm your availability.`;
  }
  if (audience === "contact") {
    const base = phrase
      ? `An interview has been scheduled${phrase}`
      : `An interview has been scheduled for the ${eventType}`;
    return `${base}. Please review the details below and confirm your availability.`;
  }
  const base = phrase
    ? `An interview has been scheduled${phrase}`
    : `An interview has been scheduled for the ${eventType}`;
  return `${base}. Please review the details below.`;
}

export function fallbackContextParagraphs(document: SmartEventDocument): SmartContextParagraphs {
  return Object.fromEntries(
    document.audiences.map(({ type }) => [type, fallbackContextParagraph(document, type)])
  ) as SmartContextParagraphs;
}

export function promptAudiencePayload(document: SmartEventDocument) {
  return document.audiences.map(({ type, allowedContextVariables }) => ({
    type,
    audienceContext: TAB_AUDIENCE_CONTEXTS[type],
    recipients: document.attendees
      .filter((attendee) => audienceForAttendeeType(attendee.type) === type)
      .map((attendee) => ({ id: attendee.id, fullName: attendee.fullName, type: attendee.type })),
    allowedContextVariables,
    linkedRecords: allowedLinkedRecordsForAudience(type, document.linkedTo).map((record) => {
      const attendee = attendeeForLinkedRecord(document, record);
      return {
        ...record,
        attendanceStatus: attendee ? "attending" : "context_only",
        attendeeType: attendee?.type ?? null,
      };
    }),
  }));
}

export function promptAttendancePayload(document: SmartEventDocument) {
  return {
    actualAttendees: document.attendees.map((attendee) => ({
      id: attendee.id,
      fullName: attendee.fullName,
      type: attendee.type,
    })),
    linkedRecordAttendance: document.linkedTo.map((record) => {
      const attendee = attendeeForLinkedRecord(document, record);
      return {
        linkedRecordId: record.id,
        linkedRecordType: record.type,
        variable: record.variable,
        status: attendee ? "attending" : "context_only",
        attendeeType: attendee?.type ?? null,
      };
    }),
  };
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function includesLiteralLinkedLabel(paragraph: string, label: string): boolean {
  const normalizedParagraph = paragraph.toLocaleLowerCase();
  const normalizedLabel = label.trim().toLocaleLowerCase();
  if (!normalizedLabel || normalizedLabel.length < 2) return false;
  return normalizedParagraph.includes(normalizedLabel);
}

export function validateContextParagraphs(
  document: SmartEventDocument,
  value: unknown
): SmartContextParagraphs {
  if (!value || typeof value !== "object") throw new Error("AI response must be an object.");
  const raw = value as Record<string, unknown>;
  const paragraphsRaw = (raw.paragraphs ?? raw) as Record<string, unknown>;
  const result: SmartContextParagraphs = {};

  for (const audience of document.audiences) {
    const paragraph = paragraphsRaw[audience.type];
    if (typeof paragraph !== "string" || !paragraph.trim()) {
      throw new Error(`Missing ${audience.type} context paragraph.`);
    }
    const normalized = paragraph.trim().replace(/\s+/g, " ");
    const count = wordCount(normalized);
    if (count < 15 || count > 45) throw new Error(`${audience.type} paragraph must contain 15-45 words.`);
    if (/<[^>]+>/.test(normalized) || /\r|\n/.test(paragraph)) {
      throw new Error(`${audience.type} paragraph must be plain text.`);
    }
    const tokens = normalized.match(/\[[^\]]+\]/g) ?? [];
    if (tokens.some((token) => !audience.allowedContextVariables.includes(token))) {
      throw new Error(`${audience.type} paragraph contains an unavailable variable.`);
    }
    if (document.linkedTo.some((record) => includesLiteralLinkedLabel(normalized, record.label))) {
      throw new Error(`${audience.type} paragraph must use variables for linked records.`);
    }
    result[audience.type] = normalized;
  }
  return result;
}
