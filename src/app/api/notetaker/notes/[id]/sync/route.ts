import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import {
  downloadTranscriptJson,
  getRecordingTranscriptSource,
  getTranscriptDownloadUrl,
  readableToText,
  toReadableTranscript,
} from "@/lib/recall";
import { runAnalysis } from "@/lib/notetaker-pipeline";

/**
 * POST: re-sync a note's transcript straight from Recall (recording → transcript
 * download → save → analyze). Recovery path when the webhook pipeline failed.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const note = await db.meetingNote.findUnique({ where: { id } });
    if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });
    if (!note.recallRecordingId) {
      return NextResponse.json({ error: "No Recall recording linked to this note yet." }, { status: 400 });
    }
    const source = await getRecordingTranscriptSource(note.recallRecordingId);
    const downloadUrl = source.downloadUrl ?? (source.transcriptId ? await getTranscriptDownloadUrl(source.transcriptId) : undefined);
    if (!downloadUrl) {
      return NextResponse.json({ error: "Recall has no transcript for this recording yet." }, { status: 400 });
    }
    const doc = await downloadTranscriptJson(downloadUrl);
    const lines = toReadableTranscript(doc);
    if (lines.length === 0) {
      return NextResponse.json({ error: "Recall returned a transcript with no usable lines." }, { status: 400 });
    }
    const updated = await db.meetingNote.update({
      where: { id },
      data: {
        transcriptText: readableToText(lines),
        transcriptJson: JSON.parse(JSON.stringify(lines)),
        status: "TRANSCRIBED",
        statusMessage: null,
      },
    });
    await runAnalysis(id);
    const fresh = await db.meetingNote.findUnique({
      where: { id },
      include: {
        event: { include: { attendees: true } },
        insights: true,
        actions: true,
      },
    });
    return NextResponse.json({ note: fresh ?? updated });
  } catch (err) {
    console.error("[notetaker:sync]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 500 });
  }
}
