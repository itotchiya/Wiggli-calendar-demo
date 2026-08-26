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

STRICT SCOPE:
- Write exactly one plain-text paragraph per audience.
- Write 2 or 3 natural sentences.
- Target 45-75 words and never exceed 90 words.
- Event type and linked records are the primary logic.
- Title and description are supporting context. Use useful attendee-facing meaning from them, such as interview stage, technical focus, or salary expectations.
- The attendance.actualAttendees list is the only source of who will participate in the event.
- A linked record with attendanceStatus or status "context_only" provides subject context only. Never describe that person or entity as attending, joining, meeting, interviewing, or being present.
- Only describe a linked person as participating when the same linked record is marked "attending".
- Use attendee types to understand the meeting composition. If only internal attendees are present, frame it as an internal discussion even when candidates or contacts are linked as context.
- Do not list or name attendees in the paragraph; the deterministic event details already show the guest list.
- Do not copy the complete title or description and do not output [Event.Title] or [Event.Description].
- Use only [Linked.*] variables listed in that audience's allowedContextVariables.
- Whenever you refer to an allowed linked record, always use its exact [Linked.*] variable, never its literal label, name, or title.
- Do not repeat a linked record's literal label from the title or description; if that record is not in the audience's allowed linked records, omit it.
- Never mention a linked record that is absent or excluded.
- Never mention the recipient's own linked entity as another person.
- Do not invent people, jobs, organizations, opportunities, stages, locations, dates, times, URLs, or facts.
- Do not write a greeting, subject, details list, RSVP note, signature, markdown, HTML, or line breaks.
- Keep the writing formal, warm, clear, and specific without sounding verbose.`;
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
