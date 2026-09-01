/** Gemini generates ONLY Smart Event context paragraphs. */

import {
  fallbackContextParagraphs,
  promptAttendancePayload,
  promptAudiencePayload,
  validateContextParagraphs,
  type SmartContextParagraphs,
} from "./smart-event-context";
import type { SmartEventDocument } from "./smart-event-schema";

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";

function systemPrompt(): string {
  return `You generate the contextual opening paragraph for Wiggli calendar invitations.

Return valid JSON only in this shape:
{"paragraphs":{"candidate":"...","contact":"...","internal":"..."}}

Generate only keys requested in audiences.

TONE — mirror Wiggli legacy interview emails (interview_email.html, interview_confirmation_email.html):
- Concise, professional, transactional, courteous. British English (organise).
- Direct, factual, action-oriented — no marketing fluff (no excited, delighted, thrilled, looking forward).
- Formal, neutral. No adjectives about culture or enthusiasm.

STRICT SCOPE:
- Write exactly one plain-text paragraph per audience.
- Write 1 or 2 sentences only.
- Target 20-35 words and never exceed 45 words.
- Infer the event's purpose from the JSON: event.type + title + description + linked records + attendee composition. Derive a natural reason (e.g. job intake with Job+Contact → gathering requirements for that role to discuss with the client contact; only internals → internal alignment).
- Use attendee composition as primary signal: if actualAttendees contains only "internal", frame the paragraph as an internal discussion/alignment/session — even when a Job, Contact, Organization or Opportunity is linked. Do not describe external linked records as attending.
- The inviter is ALWAYS the organizer. Never make a [Linked.*] variable the grammatical subject of "has invited you / has requested / has scheduled". Linked records are always objects of "regarding / concerning / to discuss / for" — e.g. "regarding [Linked.Job] at [Linked.Organization]" or "to discuss the requirements for [Linked.Job] with [Linked.Contact]". WRONG: "[Linked.Contact] has invited you to a job intake" — CORRECT: "You are invited to a job intake session to discuss the requirements and expectations for [Linked.Job]".
- Title and description are supporting context only. Use useful attendee-facing meaning from them, such as interview stage, technical focus, or salary expectations, but do not repeat them verbatim.
- The attendance.actualAttendees list is the only source of who will participate. AttendanceStatus "context_only" means the linked record is a topic to be discussed, not a participant — mention it only with "regarding / concerning / to discuss / for the role of [Linked.Job]".
- Only use "with [Linked.*]" when that linked record's attendanceStatus is "attending" (the same person is also in actualAttendees). Otherwise use "regarding" or "concerning".
- Use attendee types to understand composition. If only internal attendees are present, use phrasing like "internal session", "internal discussion", "alignment on [Linked.Job]" — never "with [Linked.Contact]" as if they will join.
- Do not list or name attendees in the paragraph; the deterministic event details already show the guest list.
- Do not copy the complete title or description and do not output [Event.Title] or [Event.Description].
- Use only [Linked.*] variables listed in that audience's allowedContextVariables.
- Whenever you refer to an allowed linked record, always use its exact [Linked.*] variable, never its literal label, name, or title.
- Do not repeat a linked record's literal label from the title or description; if that record is not in the audience's allowed linked records, omit it.
- Never mention a linked record that is absent or excluded.
- Never mention the recipient's own linked entity as another person.
- Do not invent people, jobs, organizations, opportunities, stages, locations, dates, times, URLs, or facts.
- Do not write a greeting, subject, details list, RSVP note, signature, markdown, HTML, or line breaks.
- End with a brief call to action like "Please review the details below and confirm your availability." when natural — do not add it if the paragraph is already at the word limit.`;
}

export function buildSmartContextPromptPayload(document: SmartEventDocument) {
  return {
    event: {
      type: document.event.type,
      titleSupportingContext: document.event.title,
      descriptionSupportingContext: document.event.description ?? null,
    },
    attendance: promptAttendancePayload(document),
    audiences: promptAudiencePayload(document),
  };
}

function userPrompt(document: SmartEventDocument, instruction?: string): string {
  const payload = buildSmartContextPromptPayload(document);
  return [
    "Generate the context paragraphs from this JSON:",
    JSON.stringify(payload, null, 2),
    instruction
      ? `Optional user tone adjustment for the context paragraphs only: ${instruction}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function parseJsonResponse(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

export async function generateSmartContextParagraphs(
  document: SmartEventDocument,
  instruction?: string
): Promise<{ paragraphs: SmartContextParagraphs; source: "ai" | "fallback" }> {
  const fallback = fallbackContextParagraphs(document);
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { paragraphs: fallback, source: "fallback" };

  try {
    const response = await fetch(`${API_ROOT}/${MODEL}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt()}\n\n---\n\n${userPrompt(document, instruction)}` }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 400,
          responseMimeType: "application/json",
        },
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Gemini API error (${response.status}): ${detail.slice(0, 200)}`);
    }
    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const raw = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
    if (!raw) throw new Error("Gemini returned an empty response.");
    return {
      paragraphs: validateContextParagraphs(document, parseJsonResponse(raw)),
      source: "ai",
    };
  } catch (error) {
    console.error("[smart-event-ai] falling back to deterministic paragraphs:", error);
    return { paragraphs: fallback, source: "fallback" };
  }
}
