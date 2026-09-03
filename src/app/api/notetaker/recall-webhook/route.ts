import { after, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import {
  createAsyncTranscript,
  downloadTranscriptJson,
  getTranscriptDownloadUrl,
  readableToText,
  toReadableTranscript,
  verifyRecallRequest,
} from "@/lib/recall";
import { runAnalysis } from "@/lib/notetaker-pipeline";

export const dynamic = "force-dynamic";

type RecallEvent = {
  event: string;
  data?: {
    bot?: { id?: string; metadata?: { wiggli_event_id?: string } };
    recording?: { id?: string };
    transcript?: { id?: string };
    data?: { code?: string; sub_code?: string | null };
  };
};

async function findNoteId(botId: string | undefined, eventId: string | undefined): Promise<string | null> {
  if (eventId) {
    const byEvent = await db.meetingNote.findUnique({ where: { eventId } });
    if (byEvent) return byEvent.id;
  }
  if (botId) {
    const byBot = await db.meetingNote.findFirst({ where: { recallBotId: botId } });
    if (byBot) return byBot.id;
  }
  return null;
}

/** recall.ai dashboard webhook → verify → ack fast → process in background (no await). */
export async function POST(req: Request) {
  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Unreadable body" }, { status: 400 });
  }
  try {
    verifyRecallRequest({
      secret: process.env.RECALL_VERIFICATION_SECRET ?? "",
      headers: req.headers,
      rawBody,
    });
  } catch (err) {
    console.error("[notetaker:webhook] rejected:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Request not verified" }, { status: 400 });
  }

  let payload: RecallEvent;
  try {
    payload = JSON.parse(rawBody) as RecallEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Ack immediately per Recall guide; heavy work runs after the response
  // via `after()` so serverless doesn't freeze it mid-flight.
  after(() => {
    processRecallEvent(payload).catch((err) => console.error("[notetaker:webhook] background error:", err));
  });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "recall-webhook" });
}

async function processRecallEvent(payload: RecallEvent): Promise<void> {
  const botId = payload.data?.bot?.id;
  const eventId = payload.data?.bot?.metadata?.wiggli_event_id;
  const noteId = await findNoteId(botId, eventId);
  if (!noteId) {
    console.warn("[notetaker:webhook] no matching note for event", payload.event, { botId, eventId });
    return;
  }

  switch (payload.event) {
    case "bot.in_waiting_room":
      await db.meetingNote.update({
        where: { id: noteId },
        data: { status: "JOINING", statusMessage: "Bot is in the Meet waiting room — admit “Wiggli Notetaker” to start recording." },
      });
      break;

    case "bot.in_call_not_recording":
      await db.meetingNote.update({ where: { id: noteId }, data: { status: "JOINING", statusMessage: "Bot joined, recording not started yet." } });
      break;

    case "bot.in_call_recording":
      await db.meetingNote.update({ where: { id: noteId }, data: { status: "RECORDING", statusMessage: null } });
      break;

    case "bot.fatal":
    case "bot.failed": {
      const code = payload.data?.data;
      await db.meetingNote.update({
        where: { id: noteId },
        data: { status: "FAILED", statusMessage: `Bot failed${code?.sub_code ? `: ${code.sub_code}` : ""}. Check the Recall dashboard logs.` },
      });
      break;
    }

    case "bot.done":
      // Recording upload follows; recording.done drives the next step.
      await db.meetingNote.update({ where: { id: noteId }, data: { statusMessage: "Call ended — waiting for recording." } });
      break;

    case "recording.done": {
      const recordingId = payload.data?.recording?.id;
      if (!recordingId) break;
      await db.meetingNote.update({ where: { id: noteId }, data: { recallRecordingId: recordingId, statusMessage: "Recording ready — transcribing." } });
      try {
        await createAsyncTranscript(recordingId);
      } catch (err) {
        await db.meetingNote.update({
          where: { id: noteId },
          data: { status: "FAILED", statusMessage: err instanceof Error ? err.message : "Transcription start failed." },
        });
      }
      break;
    }

    case "transcript.done": {
      const transcriptId = payload.data?.transcript?.id;
      if (!transcriptId) break;
      try {
        const url = await getTranscriptDownloadUrl(transcriptId);
        const doc = await downloadTranscriptJson(url);
        const lines = toReadableTranscript(doc);
        await db.meetingNote.update({
          where: { id: noteId },
          data: { transcriptText: readableToText(lines), transcriptJson: JSON.parse(JSON.stringify(lines)), status: "TRANSCRIBED", statusMessage: null },
        });
        await runAnalysis(noteId);
      } catch (err) {
        await db.meetingNote.update({
          where: { id: noteId },
          data: { status: "FAILED", statusMessage: err instanceof Error ? err.message : "Transcript processing failed." },
        });
      }
      break;
    }

    case "transcript.failed":
      await db.meetingNote.update({ where: { id: noteId }, data: { status: "FAILED", statusMessage: "Recall transcription failed." } });
      break;

    default:
      console.log("[notetaker:webhook] ignored event:", payload.event);
  }
}
