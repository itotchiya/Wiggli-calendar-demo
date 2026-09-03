/** Recall.ai Meeting Bot REST client (EU region by default).
 * Docs: https://docs.recall.ai — bot create, async transcription, download schemas.
 * Auth: `Authorization: Token <RECALL_API_KEY>` (server-side only, never client).
 * Rule from Recall agent guide: retry on retryable statuses, never poll — use webhooks.
 */

const REGION = process.env.RECALL_REGION ?? "eu-central-1";
const BASE = `https://${REGION}.recall.ai`;

function apiKey(): string {
  const key = process.env.RECALL_API_KEY;
  if (!key) throw new Error("Missing RECALL_API_KEY.");
  return key;
}

const RETRYABLE = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

export async function recallFetch(path: string, init: RequestInit = {}, attempt = 0): Promise<Response> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      Authorization: `Token ${apiKey()}`,
      ...(init.headers ?? {}),
    },
  });
  if (RETRYABLE.has(response.status) && attempt < 4) {
    const waitMs = Math.min(1000 * 2 ** attempt, 8000);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return recallFetch(path, init, attempt + 1);
  }
  return response;
}

export type CreateBotInput = {
  meetingUrl: string;
  joinAt: string; // ISO8601 — always pass, even for "join now"
  eventId: string;
};

export type RecallBot = { id: string; status?: string; [key: string]: unknown };

/** Schedule (or immediately join) a notetaker bot. Minimal pattern per Recall guide. */
export async function createNotetakerBot(input: CreateBotInput): Promise<RecallBot> {
  const response = await recallFetch("/api/v1/bot/", {
    method: "POST",
    body: JSON.stringify({
      meeting_url: input.meetingUrl,
      join_at: input.joinAt,
      bot_name: "Wiggli Notetaker",
      chat: {
        on_bot_join: {
          send_to: "everyone",
          message: "Wiggli Notetaker is recording this meeting for AI notes.",
          pin: true,
        },
      },
      metadata: { wiggli_event_id: input.eventId },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Recall create bot failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return (await response.json()) as RecallBot;
}

/** Start a post-meeting transcript job (Recall.ai Transcription, auto language). */
export async function createAsyncTranscript(recordingId: string): Promise<{ transcriptId?: string }> {
  const response = await recallFetch(`/api/v1/recording/${recordingId}/create_transcript/`, {
    method: "POST",
    body: JSON.stringify({
      provider: { recallai_async: { language_code: "auto" } },
      diarization: { use_separate_streams_when_available: true },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Recall create transcript failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  const data = (await response.json()) as { id?: string };
  return { transcriptId: data.id };
}

/** Resolve the downloadable transcript JSON URL via transcript id. */
export async function getTranscriptDownloadUrl(transcriptId: string): Promise<string> {
  const response = await recallFetch(`/api/v1/transcript/${transcriptId}/`);
  if (!response.ok) throw new Error(`Recall get transcript failed (${response.status}).`);
  const data = (await response.json()) as { data?: { download_url?: string } };
  const url = data.data?.download_url;
  if (!url) throw new Error("Recall transcript has no download_url yet.");
  return url;
}

export type RecallWord = { text?: string; start_timestamp?: number; end_timestamp?: number };
export type RecallParticipant = { id?: number | string; name?: string; is_host?: boolean };
export type RecallTranscriptDoc = {
  participants?: RecallParticipant[];
  transcript?: { participant?: { id?: number | string; name?: string }; words?: RecallWord[] }[];
};

export async function downloadTranscriptJson(url: string): Promise<RecallTranscriptDoc> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Recall transcript download failed (${response.status}).`);
  return (await response.json()) as RecallTranscriptDoc;
}

export type ReadableLine = { speaker: string; time: string; text: string };

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

/** Speaker-grouped readable lines (Recall sample-app pattern). */
export function toReadableTranscript(doc: RecallTranscriptDoc): ReadableLine[] {
  const names = new Map<string, string>();
  for (const p of doc.transcript ?? []) {
    const id = String(p.participant?.id ?? "?");
    if (!names.has(id)) names.set(id, p.participant?.name ?? `Speaker ${id}`);
  }
  const lines: ReadableLine[] = [];
  for (const p of doc.transcript ?? []) {
    const id = String(p.participant?.id ?? "?");
    const words = (p.words ?? []).map((w) => w.text ?? "").join(" ").trim();
    if (!words) continue;
    const first = (p.words ?? [])[0]?.start_timestamp ?? 0;
    lines.push({ speaker: names.get(id) ?? id, time: formatTime(first), text: words });
  }
  return lines;
}

export function readableToText(lines: ReadableLine[]): string {
  return lines.map((l) => `[${l.time}] ${l.speaker}: ${l.text}`).join("\n");
}

// --- Webhook verification (official Recall function, adapted to Web Headers) ---

import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyRecallRequest(args: { secret: string; headers: Headers; rawBody: string }): void {
  const { secret, headers, rawBody } = args;
  const id = headers.get("webhook-id") ?? headers.get("svix-id");
  const ts = headers.get("webhook-timestamp") ?? headers.get("svix-timestamp");
  const sig = headers.get("webhook-signature") ?? headers.get("svix-signature");
  if (!secret || !secret.startsWith("whsec_")) throw new Error("RECALL_VERIFICATION_SECRET missing or invalid.");
  if (!id || !ts || !sig) throw new Error("Missing Recall verification headers.");
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${rawBody}`).digest("base64");
  for (const part of sig.split(" ")) {
    const [version, signature] = part.split(",");
    if (version !== "v1" || !signature) continue;
    const a = Buffer.from(signature, "base64");
    const b = Buffer.from(expected, "base64");
    if (a.length === b.length && timingSafeEqual(a, b)) return;
  }
  throw new Error("Recall signature mismatch.");
}

/** Fresh mixed-video playback URL (signed, ~5h expiry — fetch per view, never cache). */
export async function getRecordingVideoUrl(recordingId: string): Promise<string> {
  const response = await recallFetch(`/api/v1/recording/${recordingId}/`);
  if (!response.ok) throw new Error(`Recall get recording failed (${response.status}).`);
  const data = (await response.json()) as {
    media_shortcuts?: { video_mixed?: { data?: { download_url?: string } } };
  };
  const url = data.media_shortcuts?.video_mixed?.data?.download_url;
  if (!url) throw new Error("Recording has no playable video yet.");
  return url;
}
