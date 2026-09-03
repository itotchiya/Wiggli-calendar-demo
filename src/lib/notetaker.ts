/** AI Notetaker brain: context packet (eventType + attendees + linked records) →
 * ONE Gemini structured call → { summary, candidate_insights, action_items }.
 * Mirrors src/lib/gemini.ts conventions (REST, JSON mode, validate + fallback).
 */

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = process.env.GEMINI_NOTETAKER_MODEL ?? process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";

export type NotetakerAttendee = { email: string; name: string | null; type: string | null };
export type LinkedRecord = { type: string; label: string };

export type NotetakerContext = {
  event: { title: string; type: string; description: string | null; start: string };
  attendees: NotetakerAttendee[];
  linked: LinkedRecord[];
  candidateName: string | null;
  jobLabel: string | null;
};

// eventType → template (Spott/Metaview per-type pattern). Match by keyword, fallback generic.
const TEMPLATES: { match: RegExp; name: string; focus: string }[] = [
  {
    match: /interview|screening|technical|hiring/i,
    name: "interview",
    focus:
      "Evaluate the candidate against the linked job: experience vs requirements, skills with evidence, motivation, compensation & availability, concerns / red flags, recommended next steps. Match skills to the job label explicitly.",
  },
  {
    match: /intake|kickoff|kick-off|brief/i,
    name: "intake",
    focus:
      "Capture hiring requirements: role scope, must-have vs nice-to-have skills, timeline, decision process, budget signals, open questions for the client.",
  },
  {
    match: /client|commercial|negotiat|proposal|deal|opportunit/i,
    name: "client",
    focus:
      "Capture business signals: needs, budget, decision-makers, objections, commitments made by each side, follow-up actions.",
  },
  {
    match: /debrief|feedback|review|retro/i,
    name: "debrief",
    focus:
      "Capture the panel's assessment: per-interviewer verdicts with evidence, agreements and disagreements, final recommendation, next steps.",
  },
];

export function pickTemplate(eventType: string | null): { name: string; focus: string } {
  const type = eventType ?? "";
  for (const t of TEMPLATES) if (t.match.test(type)) return { name: t.name, focus: t.focus };
  return {
    name: "general",
    focus: "Summarize decisions, key discussion points, and follow-ups discussed in this meeting.",
  };
}

export function buildContextPacket(args: {
  title: string;
  eventType: string | null;
  description: string | null;
  start: Date;
  attendees: NotetakerAttendee[];
  previewData: unknown;
}): NotetakerContext {
  const linked: LinkedRecord[] = (() => {
    const root = args.previewData as { linkedTo?: unknown } | null;
    if (!root || !Array.isArray(root.linkedTo)) return [];
    return root.linkedTo
      .filter((r): r is { type: unknown; label: unknown } => typeof r === "object" && r !== null)
      .map((r) => ({ type: String((r as { type: unknown }).type ?? ""), label: String((r as { label: unknown }).label ?? "") }))
      .filter((r) => r.type && r.label);
  })();
  const candidate =
    args.attendees.find((a) => a.type === "candidate") ??
    args.attendees.find((a) => linked.some((l) => l.type === "Candidate" && l.label === (a.name ?? a.email)));
  const job = linked.find((l) => l.type === "Job");
  return {
    event: { title: args.title, type: args.eventType ?? "Meeting", description: args.description, start: args.start.toISOString() },
    attendees: args.attendees,
    linked,
    candidateName: candidate ? (candidate.name ?? candidate.email) : (linked.find((l) => l.type === "Candidate")?.label ?? null),
    jobLabel: job?.label ?? null,
  };
}

function systemPrompt(template: { name: string; focus: string }): string {
  return `You are Wiggli's AI notetaker. Return valid JSON only in this shape:
{"summary":{"overview":"...","experience":[],"skills":[],"motivation":"","compensation":"","availability":"","concerns":[],"next_steps":[]},"candidate_insights":[{"field":"...","value":"...","confidence":0.0,"speaker":"candidate|interviewer|unknown","timestamp":"HH:MM:SS","evidence":"exact transcript quote"}],"action_items":[{"title":"...","owner":"organizer|candidate|contact","due_date":null,"timestamp":"HH:MM:SS","evidence":"exact transcript quote"}]}

Meeting template: ${template.name}. Focus: ${template.focus}

Rules:
- Every insight and action MUST quote its evidence verbatim from the transcript with a timestamp.
- Confidence is 0-1. Omit insights you cannot evidence.
- Use the context packet (candidate name, job, attendees, linked records) to interpret who is who; do not invent people, jobs, or facts.
- Factual and neutral. NEVER make a hiring decision or recommendation — extract evidence, the human decides.
- British English, concise. Empty arrays when nothing found — never null.`;
}

export type NotetakerOutput = {
  summary: Record<string, unknown>;
  candidate_insights: {
    field: string;
    value: string;
    confidence?: number;
    speaker?: string;
    timestamp?: string;
    evidence?: string;
  }[];
  action_items: {
    title: string;
    owner?: string;
    due_date?: string | null;
    timestamp?: string;
    evidence?: string;
  }[];
};

function validateOutput(raw: unknown): NotetakerOutput {
  if (typeof raw !== "object" || raw === null) throw new Error("Not an object.");
  const o = raw as Record<string, unknown>;
  if (typeof o.summary !== "object" || o.summary === null) throw new Error("Missing summary.");
  if (!Array.isArray(o.candidate_insights)) throw new Error("Missing candidate_insights.");
  if (!Array.isArray(o.action_items)) throw new Error("Missing action_items.");
  return o as unknown as NotetakerOutput;
}

export async function analyzeTranscript(
  context: NotetakerContext,
  transcriptText: string,
  template = pickTemplate(context.event.type)
): Promise<{ output: NotetakerOutput; raw: unknown; templateUsed: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY.");
  const response = await fetch(`${API_ROOT}/${MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${systemPrompt(template)}\n\n---\n\nContext packet:\n${JSON.stringify(context, null, 2)}\n\n---\n\nTranscript:\n${transcriptText}`,
            },
          ],
        },
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4000, responseMimeType: "application/json" },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gemini error (${response.status}): ${detail.slice(0, 200)}`);
  }
  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
  if (!text) throw new Error("Gemini returned an empty response.");
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const raw: unknown = JSON.parse(cleaned);
  return { output: validateOutput(raw), raw, templateUsed: template.name };
}

export async function askOverTranscript(args: {
  question: string;
  transcriptText: string;
  summary: unknown;
}): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY.");
  const response = await fetch(`${API_ROOT}/${MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Answer ONLY from this meeting transcript + summary. Quote evidence with timestamps. If the answer is not in the transcript, say so.\n\nSummary:\n${JSON.stringify(args.summary)}\n\nTranscript:\n${args.transcriptText}\n\nQuestion: ${args.question}`,
            },
          ],
        },
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
    }),
  });
  if (!response.ok) throw new Error(`Gemini error (${response.status}).`);
  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "No answer found in this meeting.";
}
