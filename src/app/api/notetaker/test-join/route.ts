import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { createNotetakerBot } from "@/lib/recall";

/**
 * POST { meetingUrl, eventId? }: fire a test bot at any Meet URL right now.
 * No event needed for a pure connectivity test. Pass eventId to attach the
 * bot to that event's note — then the full pipeline runs (record → transcript
 * → summary) and everything lands on the note like a normal event.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  let body: { meetingUrl?: string; eventId?: string };
  try {
    body = (await req.json()) as { meetingUrl?: string; eventId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const meetingUrl = body.meetingUrl?.trim() ?? "";
  if (!/^https:\/\/.+\..+/.test(meetingUrl)) {
    return NextResponse.json({ error: "Paste a full meeting URL starting with https://" }, { status: 400 });
  }
  try {
    let noteId: string | null = null;
    let metaEventId = "manual-test";
    if (body.eventId) {
      const event = await db.event.findUnique({ where: { id: body.eventId } });
      if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
      const existing = await db.meetingNote.findUnique({ where: { eventId: event.id } });
      if (existing?.recallBotId) {
        return NextResponse.json(
          { error: "This event already has a bot note — open it instead.", noteId: existing.id },
          { status: 409 }
        );
      }
      metaEventId = event.id;
      const note =
        existing ??
        (await db.meetingNote.create({ data: { eventId: event.id, source: "RECALL_BOT", status: "JOINING" } }));
      noteId = note.id;
    }
    const bot = await createNotetakerBot({
      meetingUrl,
      joinAt: new Date().toISOString(),
      eventId: metaEventId,
    });
    if (noteId) {
      await db.meetingNote.update({ where: { id: noteId }, data: { recallBotId: String(bot.id) } });
    }
    return NextResponse.json({ bot, noteId }, { status: 201 });
  } catch (err) {
    console.error("[notetaker:test-join]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Test join failed" }, { status: 500 });
  }
}
