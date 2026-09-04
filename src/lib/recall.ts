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
      // Grid view: all cameras at once (default speaker_view shows only the
      // active speaker fullscreen). gallery_view_v2 = newest grid layout.
      recording_config: { video_mixed_layout: "gallery_view_v2" },
      // Leave behavior: stop recording + leave 60s after everyone is gone
      // (60s grace so brief drops don't kill the bot; ignored in the first
      // minute while people are still joining). Cap idle burns: nobody joins
      // within 10 min, or never admitted within 10 min → leave.
      automatic_leave: {
        everyone_left_timeout: { timeout: 60, activate_after: 60 },
        noone_joined_timeout: 600,
        waiting_room_timeout: 600,
      },
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

export type RecallTimestamp = number | { relative?: number | null; absolute?: string | null } | null | undefined;
export type RecallWord = { text?: string; start_timestamp?: RecallTimestamp; end_timestamp?: RecallTimestamp };
export type RecallParticipant = { id?: number | string; name?: string | null; is_host?: boolean };
export type RecallTranscriptEntry = { participant?: RecallParticipant | null; words?: RecallWord[] };
export type RecallTranscriptDoc =
  | RecallTranscriptEntry[]
  | { transcript?: RecallTranscriptEntry[]; participants?: RecallParticipant[] }
  | { paragraphs?: RecallTranscriptEntry[] };

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

/** Seconds from a Recall timestamp: number, {relative}, or {absolute ISO}. */
export function recallTimestampToSeconds(ts: RecallTimestamp): number {
  if (typeof ts === "number" && Number.isFinite(ts)) return ts;
  if (ts && typeof ts === "object") {
    if (typeof ts.relative === "number" && Number.isFinite(ts.relative)) return ts.relative;
    if (typeof ts.absolute === "string") {
      const ms = Date.parse(ts.absolute);
      if (Number.isFinite(ms)) return ms / 1000;
    }
  }
  return 0;
}

function transcriptEntries(doc: RecallTranscriptDoc): RecallTranscriptEntry[] {
  if (Array.isArray(doc)) return doc;
  const obj = doc as { transcript?: unknown; paragraphs?: unknown };
  if (Array.isArray(obj.transcript)) return obj.transcript as RecallTranscriptEntry[];
  if (Array.isArray(obj.paragraphs)) return obj.paragraphs as RecallTranscriptEntry[];
  return [];
}

/** Speaker-grouped readable lines (Recall sample-app pattern, schema-tolerant). */
export function toReadableTranscript(doc: RecallTranscriptDoc): ReadableLine[] {
  const entries = transcriptEntries(doc);
  const names = new Map<string, string>();
  for (const p of entries) {
    const id = String(p.participant?.id ?? "?");
    if (!names.has(id)) names.set(id, p.participant?.name ?? `Speaker ${id}`);
  }
  const lines: ReadableLine[] = [];
  for (const p of entries) {
    const id = String(p.participant?.id ?? "?");
    const words = (p.words ?? []).map((w) => w.text ?? "").join(" ").trim();
    if (!words) continue;
    const first = recallTimestampToSeconds((p.words ?? [])[0]?.start_timestamp);
    lines.push({ speaker: names.get(id) ?? id, time: formatTime(first), text: words });
  }
  return lines;
}

/** Retrieve a recording to resolve its transcript download URL. */
export async function getRecordingTranscriptSource(recordingId: string): Promise<{ transcriptId?: string; downloadUrl?: string }> {
  const response = await recallFetch(`/api/v1/recording/${recordingId}/`);
  if (!response.ok) throw new Error(`Recall get recording failed (${response.status}).`);
  const data = (await response.json()) as {
    media_shortcuts?: { transcript?: { id?: string; data?: { download_url?: string } } };
  };
  return {
    transcriptId: data.media_shortcuts?.transcript?.id,
    downloadUrl: data.media_shortcuts?.transcript?.data?.download_url,
  };
}

/** Live bot status for the test-join tracker (joining → waiting room → recording → done/fatal). */
export async function getBotStatus(botId: string): Promise<{ code: string; sub_code: string | null; updated_at?: string }> {
  const response = await recallFetch(`/api/v1/bot/${botId}/`);
  if (!response.ok) throw new Error(`Recall get bot failed (${response.status}).`);
  const data = (await response.json()) as { status?: { code?: string; sub_code?: string | null; updated_at?: string } };
  return { code: String(data.status?.code ?? "unknown"), sub_code: data.status?.sub_code ?? null, updated_at: data.status?.updated_at };
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
