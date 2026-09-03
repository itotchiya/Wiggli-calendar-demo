/**
 * Single source of truth for invitation template variables AND AI contexts.
 *
 * The drawer's variable chips, the AI drafting prompt, AND the server-side
 * resolver ALL import this list — so the AI can never invent a token the
 * resolver doesn't know (which previously shipped `[Company.Name]` literally).
 *
 * Contexts (event type / linked records / attendee tabs) are the AI "triggers":
 * they tell the generator WHAT the meeting is about so the invitation copy fits
 * the situation (e.g. Interview + linked Job → candidate evaluation for a role;
 * Job intake + linked Job → gathering the role's requirements).
 */

export type InviteVariable = {
  /** Exact token the agent must use, including the brackets. */
  tag: string;
  /** Human label shown in the drawer chip bar. */
  label: string;
  /** One-line description of what it resolves to (sent to the AI). */
  desc: string;
};

export const INVITE_VARIABLES: InviteVariable[] = [
  // ── Event facts ────────────────────────────────────────────────────────────
  { tag: "[Event.Title]", label: "Event title", desc: "The event title" },
  { tag: "[Event.Type]", label: "Event type", desc: "Event type, e.g. Call, Interview, Meeting, Job intake" },
  { tag: "[Event.Date]", label: "Event date", desc: "Human-readable date, e.g. Friday, August 28, 2026" },
  { tag: "[Event.Start_time]", label: "Start time", desc: "Event start time, e.g. 10:00" },
  { tag: "[Event.End_time]", label: "End time", desc: "Event end time, e.g. 10:30" },
  { tag: "[Event.Description]", label: "Event description", desc: "Notes/description the organizer wrote for this event" },
  { tag: "[Event.Location]", label: "Event location", desc: "Physical location (office or address); empty for online meetings" },
  { tag: "[Event.Reminder]", label: "Event reminder", desc: "Reminder setting, e.g. '15 minutes before' (or 'None')" },
  { tag: "[Meeting.Link]", label: "Meeting link", desc: "Google Meet URL — ONLY include if a Meet conference was selected" },

  // ── Recipient (resolved per attendee at send time) ─────────────────────────
  { tag: "[Candidate.First_name]", label: "Candidate first name", desc: "Recipient FIRST name — for the greeting line of candidate invites" },
  { tag: "[Contact.First_name]", label: "Contact first name", desc: "Recipient FIRST name — for the greeting line of contact invites" },
  { tag: "[Internal.First_name]", label: "Internal first name", desc: "Recipient FIRST name — for the greeting line of internal invites" },
  { tag: "[Candidate.Full_name]", label: "Candidate full name", desc: "RECIPIENT's full name — use in body prose when addressing the candidate as 'you'" },
  { tag: "[Contact.Full_name]", label: "Contact full name", desc: "RECIPIENT's full name — use in body prose when addressing the contact as 'you'" },
  { tag: "[Internal.Full_name]", label: "Internal full name", desc: "RECIPIENT's full name — use in body prose when addressing the internal colleague" },

  // ── Organizer & attendees ──────────────────────────────────────────────────
  { tag: "[Organizer.Name]", label: "Organizer name", desc: "The sender's name" },
  { tag: "[Organizer.Email]", label: "Organizer email", desc: "The sender's email address" },
  { tag: "[Organizer.Phone]", label: "Organizer phone", desc: "The sender's phone number, if configured" },
  { tag: "[Attendees.List]", label: "Attendees list", desc: "Bullet list of ALL participant names and email addresses" },
  { tag: "[Attendees.Candidates]", label: "Candidate attendees", desc: "Bullet list of candidate participants only" },
  { tag: "[Attendees.Contacts]", label: "Contact attendees", desc: "Bullet list of external contact participants only" },
  { tag: "[Attendees.Internals]", label: "Internal attendees", desc: "Bullet list of internal colleague participants only" },

  // ── Linked-to records (the AI context triggers) ────────────────────────────
  { tag: "[Linked.Candidate]", label: "Linked candidate", desc: "Full name of the candidate linked to this event, if any" },
  { tag: "[Linked.Contact]", label: "Linked contact", desc: "Full name of the client contact linked to this event, if any" },
  { tag: "[Linked.Job]", label: "Linked job", desc: "Title of the job linked to this event, if any" },
  { tag: "[Linked.Opportunity]", label: "Linked opportunity", desc: "Title of the opportunity linked to this event, if any" },
  { tag: "[Linked.Organization]", label: "Linked organization", desc: "Name of the organization linked to (or selected for) this event, if any" },

  // ── Legacy aliases (kept resolving; not shown as chips) ────────────────────
  { tag: "[Job.Title]", label: "Job title", desc: "Alias of [Linked.Job]" },
  { tag: "[Organization.Name]", label: "Organization name", desc: "Alias of [Linked.Organization]" },
];

/** Plain `tag` list — used by the AI prompt + the resolver guard. */
export const INVITE_VARIABLE_TAGS: string[] = INVITE_VARIABLES.map((v) => v.tag);

/** Human-readable guide for the AI prompt. */
export const VARIABLE_GUIDE = INVITE_VARIABLES.map((v) => `${v.tag} — ${v.desc}`).join("\n");

/**
 * Hard guard: any `[...]` token NOT in the canonical list is stripped from the
 * AI output before it reaches the user. This prevents invented tokens like
 * `[Company.Name]` or `[Vacancy.Title]` from shipping to Gmail literally.
 */
export function stripUnknownTokens(text: string): string {
  return text.replace(/\[[^\]\n]{1,40}\]/g, (tok) =>
    INVITE_VARIABLE_TAGS.includes(tok) ? tok : ""
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI CONTEXT TRIGGERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What each event type MEANS, used by the AI to understand the purpose of the
 * meeting. Custom event types fall back to the user-authored description from
 * the event-type settings, then to a generic line.
 */
export const EVENT_TYPE_CONTEXTS: Record<string, string> = {
  call: "A phone conversation to discuss, clarify, or follow up on a specific topic.",
  interview:
    "A structured conversation to evaluate a candidate's experience and suitability for a job opportunity.",
  meeting: "A general discussion to share information, align on a topic, or agree on next steps.",
  "job intake":
    "A discussion to gather requirements, responsibilities, expectations, and hiring needs for a job opening.",
};

export function eventTypeContext(name: string, userDescription?: string | null): string {
  const key = name.trim().toLowerCase();
  if (EVENT_TYPE_CONTEXTS[key]) return EVENT_TYPE_CONTEXTS[key];
  if (userDescription?.trim()) return `Custom event type "${name}": ${userDescription.trim()}`;
  return `Custom event type "${name}". Infer the meeting's purpose from the title, description and linked records.`;
}

/**
 * What it MEANS when a record type is linked to the event. These are the main
 * triggers: e.g. "Job intake" + linked Job means the discussion concerns that
 * job. Linking a person provides context but does not mean they are attending.
 */
export const LINKED_RECORD_CONTEXTS: Record<string, string> = {
  Candidate:
    "A specific CANDIDATE is linked ([Linked.Candidate] = their name). The event may concern their profile, application or evaluation; this does not mean they are attending.",
  Contact:
    "A client CONTACT is linked ([Linked.Contact] = their name). They provide client context; this does not mean they are attending.",
  Job:
    "A JOB is linked ([Linked.Job] = its title). The event is about this opening: its requirements, profile, process or candidates.",
  Opportunity:
    "An OPPORTUNITY is linked ([Linked.Opportunity] = its title). The event concerns this business/recruiting opportunity.",
  Organization:
    "An ORGANIZATION is linked ([Linked.Organization] = its name). The event relates to this company.",
};

/**
 * Per attendee tab: who the recipient is and what the invitation must achieve.
 * The AI writes ONE tailored invitation per tab.
 */
export const TAB_AUDIENCE_CONTEXTS: Record<"candidate" | "contact" | "internal", string> = {
  candidate:
    "A job candidate. Describe other participants only when the attendance data marks them as attending.",
  contact:
    "An external client contact. Describe candidates or other participants only when the attendance data marks them as attending.",
  internal:
    "An internal colleague. Use the attendee composition to frame an internal discussion or a session with external participants accurately.",
};

/**
 * Fallback rule text: when no job/opportunity is linked, the AI must infer the
 * subject from the title + description instead of inventing one.
 */
export const NO_LINKED_FALLBACK_RULE =
  "If no job/opportunity is linked, do NOT invent one: infer what the meeting is about from the event title, its type and the description, and keep the wording generic where information is missing.";
