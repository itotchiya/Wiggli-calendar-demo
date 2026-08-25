/**
 * Gemini-powered invitation template generation for the EventDrawer (step 2).
 * Uses the cheapest stable model via the REST API — no SDK dependency.
 *
 * The variable vocabulary is the SINGLE canonical list from invite-variables.ts,
 * so the AI can only use tokens the server resolver actually understands.
 *
 * Context triggers (from the drawer inputs) tell the AI what the meeting is
 * about: event type + linked records are the primary signals; when nothing is
 * linked it falls back to title + description.
 */

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";

import {
  INVITE_VARIABLE_TAGS,
  VARIABLE_GUIDE,
  stripUnknownTokens,
  eventTypeContext,
  LINKED_RECORD_CONTEXTS,
  TAB_AUDIENCE_CONTEXTS,
  NO_LINKED_FALLBACK_RULE,
} from "./invite-variables";

export type InviteTab = "candidate" | "contact" | "internal";

export type LinkedRecordRef = { type: string; title: string };

export type TemplateContext = {
  eventType: string;
  /** AI guidance for the event type (backend context or custom description). */
  eventTypeDescription?: string;
  title: string;
  description?: string;
  when: string;
  /** True when a real Google Meet conference will be provisioned. */
  hasMeetLink?: boolean;
  locationLabel?: string | null;
  reminderLabel?: string | null;
  /** Every linked-to record: the AI's main "what are we talking about" trigger. */
  linkedRecords?: LinkedRecordRef[];
  organizationName?: string | null;
  /** Names per attendee group, so the AI knows which roster variables exist. */
  attendeeGroups?: {
    candidates: string[];
    contacts: string[];
    internals: string[];
  };
  organizerName: string;
};

function systemPrompt(tab: InviteTab, ctx: TemplateContext): string {
  const triggerLines: string[] = [];
  triggerLines.push(`EVENT TYPE — ${ctx.eventType}: ${eventTypeContext(ctx.eventType, ctx.eventTypeDescription)}`);
  const linked = ctx.linkedRecords ?? [];
  if (linked.length > 0) {
    triggerLines.push(
      `LINKED RECORDS (main context triggers — the event is ABOUT these): ${linked
        .map((r) => `${r.type} "${r.title}"`)
        .join(", ")}.`
    );
    for (const r of linked) {
      const guidance = LINKED_RECORD_CONTEXTS[r.type];
      if (guidance) triggerLines.push(`- ${guidance}`);
    }
  } else {
    triggerLines.push(`NO LINKED RECORDS. ${NO_LINKED_FALLBACK_RULE}`);
  }

  return `You write professional, warm calendar-invitation emails for a recruiting platform called Wiggli.
Audience: ${TAB_AUDIENCE_CONTEXTS[tab]}

WHAT THIS MEETING IS ABOUT (use this to shape the invitation's substance):
${triggerLines.join("\n")}

YOU MUST ONLY USE THESE EXACT PLACEHOLDER VARIABLES (copy them exactly, brackets included):
${VARIABLE_GUIDE}

STRICT RULES — the email is a TEMPLATE resolved later, per recipient:
- NEVER write concrete facts as literal text. EVERY fact must appear via one of the variables above.
- NAME CONVENTION (important):
  • Open each email by greeting the RECIPIENT with their FIRST name only: [Candidate.First_name], [Contact.First_name], or [Internal.First_name].
  • [Candidate.Full_name] / [Contact.Full_name] / [Internal.Full_name] resolve to the RECIPIENT's own full name — only use them when referring to the recipient in prose ("you", "Mr/Ms [X.Full_name]").
  • To MENTION ANOTHER PERSON (the linked candidate, contact, etc.) use the [Linked.*] variables: [Linked.Candidate], [Linked.Contact], [Linked.Job], [Linked.Opportunity], [Linked.Organization].
  • For groups of participants use [Attendees.Candidates], [Attendees.Contacts], [Attendees.Internals], or [Attendees.List] for everyone.
- Other facts → variables:
  • date/time → [Event.Date], [Event.Start_time], [Event.End_time]
  • purpose/notes → [Event.Description] (only if a description exists)
  • location → [Event.Location] (only for physical meetings)
  • sender name → [Organizer.Name]
  • video link → [Meeting.Link] (ONLY if you are told a Meet link exists)
  • company → [Linked.Organization]; linked job → [Linked.Job]; linked opportunity → [Linked.Opportunity]
- Do NOT invent any other [Token]. Only the variables listed above exist. If you write a [Token] not in the list, it will appear broken to the recipient.
- Do NOT invent dates, times, addresses, names, or URLs. Let the variables carry them. If a linked value was not provided, do not reference its variable.
- Mention that full details are listed in the calendar invitation.

FORMAT RULES:
- Output ONLY the email body text (no subject line, no markdown fences, no headings).
- Greet with the correct FIRST-name greeting variable, then 1–3 short paragraphs that fit the meeting's purpose (see context above), referencing [Event.Date], [Event.Start_time]-[Event.End_time] and the relevant [Linked.*] variables where natural, and [Meeting.Link] if a Meet exists.
- End with "[Organizer.Name]" on its own line.`;
}

function userPrompt(ctx: TemplateContext, tab: InviteTab, instruction?: string): string {
  const groups = ctx.attendeeGroups;
  const parts = [
    `Event type: ${ctx.eventType}`,
    `Title: ${ctx.title}`,
    ctx.description ? `Description/notes from organizer (available as [Event.Description]): ${ctx.description}` : "No description written — do not use [Event.Description].",
    `When: ${ctx.when} — refer to this ONLY as [Event.Date], [Event.Start_time], [Event.End_time]`,
    ctx.hasMeetLink
      ? "A Google Meet link WILL be inserted as [Meeting.Link] — mention it."
      : "No video link — do NOT include [Meeting.Link].",
    ctx.locationLabel
      ? `Physical location (available as [Event.Location]): ${ctx.locationLabel}`
      : "No physical location — do NOT use [Event.Location].",
    ctx.reminderLabel ? `Reminder: ${ctx.reminderLabel} (available as [Event.Reminder]).` : null,
    // Linked-to triggers delivered to the agent:
    ...(ctx.linkedRecords ?? []).map((r) => {
      const tag =
        r.type === "Candidate" ? "[Linked.Candidate]" :
        r.type === "Contact" ? "[Linked.Contact]" :
        r.type === "Job" ? "[Linked.Job]" :
        r.type === "Opportunity" ? "[Linked.Opportunity]" :
        "[Linked.Organization]";
      return `LINKED ${r.type.toUpperCase()} (use variable ${tag}): ${r.title}`;
    }),
    ctx.organizationName && !(ctx.linkedRecords ?? []).some((r) => r.type === "Organization")
      ? `Organization (use variable [Linked.Organization]): ${ctx.organizationName}`
      : null,
    groups
      ? `Attendee groups — candidates: ${groups.candidates.length ? `[Attendees.Candidates] (${groups.candidates.length})` : "none"}; contacts: ${groups.contacts.length ? `[Attendees.Contacts] (${groups.contacts.length})` : "none"}; internals: ${groups.internals.length ? `[Attendees.Internals] (${groups.internals.length})` : "none"}. Only use a group variable if its group is not "none".`
      : null,
    `Participant roster (everyone): render with [Attendees.List] if you need all names`,
    `Sender: use [Organizer.Name]`,
  ].filter(Boolean);

  const base = `Write the ${tab} invitation email body. Every fact must appear via one of the allowed variables above — never as literal text.\n\n${parts.join("\n")}`;
  return instruction
    ? `${base}\n\nRevision instruction from the user — apply it while keeping ALL placeholder rules: ${instruction}`
    : base;
}

async function callGemini(ctx: TemplateContext, tab: InviteTab, instruction?: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured.");

  const res = await fetch(`${API_ROOT}/${MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: `${systemPrompt(tab, ctx)}\n\n---\n\n${userPrompt(ctx, tab, instruction)}` }] },
      ],
      generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini API error (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!raw) throw new Error("Gemini returned an empty response.");
  // Guard: drop any token the resolver won't understand.
  return stripUnknownTokens(raw);
}

export async function generateInviteDraft(
  ctx: TemplateContext,
  tabs: InviteTab[],
  instruction?: string
): Promise<{ drafts: Record<InviteTab, string>; subjects: Record<InviteTab, string> }> {
  const entries = await Promise.all(
    tabs.map(async (tab) => {
      const subject = await callGeminiSubject(ctx, tab);
      const body = await callGemini(ctx, tab, instruction);
      return [tab, { body, subject }] as const;
    })
  );
  const drafts = {} as Record<InviteTab, string>;
  const subjects = {} as Record<InviteTab, string>;
  for (const [tab, v] of entries) {
    drafts[tab] = v.body;
    subjects[tab] = v.subject;
  }
  return { drafts, subjects };
}

async function callGeminiSubject(ctx: TemplateContext, tab: InviteTab): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured.");

  const linkedNote = (ctx.linkedRecords ?? [])
    .map((r) => `\nLINKED ${r.type}: ${r.title}`)
    .join("");
  const orgNote =
    ctx.organizationName && !(ctx.linkedRecords ?? []).some((r) => r.type === "Organization")
      ? `\nOrganization: ${ctx.organizationName}`
      : "";

  const res = await fetch(`${API_ROOT}/${MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Write ONE concise email subject line (max 60 chars, no quotes, no markdown) for a ${tab} invitation.
The subject may include these variables only: ${INVITE_VARIABLE_TAGS.join(", ")}.
Event type: ${ctx.eventType}
Title: ${ctx.title}${orgNote}${linkedNote}
Sender: ${ctx.organizerName}`,
            },
          ],
        },
      ],
      generationConfig: { temperature: 0.6, maxOutputTokens: 40 },
    }),
  });

  if (!res.ok) throw new Error(`Gemini API error (${res.status})`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim()
      .replace(/^["']|["']$/g, "") || "";
  if (!text) throw new Error("Gemini returned an empty subject.");
  // Guard subjects too.
  return stripUnknownTokens(text);
}
