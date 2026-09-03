import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/prisma";
import { analyzeTranscript, buildContextPacket } from "@/lib/notetaker";
import { saveAiOutput } from "@/lib/notetaker-pipeline";

/** PUT { transcriptText }: save a pasted manual transcript + run the AI analysis. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await ctx.params;
  let body: { transcriptText?: string };
  try {
    body = (await req.json()) as { transcriptText?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.transcriptText?.trim()) return NextResponse.json({ error: "transcriptText required" }, { status: 400 });

  try {
    const note = await db.meetingNote.findUnique({
      where: { id },
      include: { event: { include: { attendees: true } } },
    });
    if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.meetingNote.update({
      where: { id },
      data: { transcriptText: body.transcriptText.trim(), transcriptJson: Prisma.JsonNull, status: "TRANSCRIBED", statusMessage: null },
    });
    const context = buildContextPacket({
      title: note.event.summary,
      eventType: note.event.eventType,
      description: note.event.description,
      start: note.event.start,
      attendees: note.event.attendees.map((a) => ({ email: a.email, name: a.name, type: a.type })),
      previewData: note.event.previewData,
    });
    await db.meetingNote.update({ where: { id }, data: { status: "PROCESSING" } });
    const { output, raw, templateUsed } = await analyzeTranscript(context, body.transcriptText.trim());
    await saveAiOutput(id, output, raw, templateUsed);
    const updated = await db.meetingNote.findUnique({
      where: { id },
      include: { event: { include: { attendees: true } }, insights: true, actions: true },
    });
    return NextResponse.json({ note: updated });
  } catch (err) {
    console.error("[notetaker:transcript]", err);
    const message = err instanceof Error ? err.message : "Analysis failed.";
    await db.meetingNote.update({ where: { id }, data: { status: "FAILED", statusMessage: message } }).catch(() => {});
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
