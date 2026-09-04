import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { createNotetakerBot, getBotStatus } from "@/lib/recall";

/** GET ?id=: live bot status for the test-join tracker. */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const botId = new URL(req.url).searchParams.get("id");
  if (!botId) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    const status = await getBotStatus(botId);
    return NextResponse.json({ status });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Status check failed" }, { status: 500 });
  }
}

/**
 * POST { meetingUrl, eventId? }: fire a test bot at any Meet URL right now.
 * No eventId → a lightweight "Test meeting" event + note are auto-created, so
 * a fresh recording still ends with transcript + summary on its own note.
 * Pass eventId to attach the bot to an existing event's note instead.
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
    } else {
      // Fresh test meeting: auto-create a minimal event + note so the recording
      // gets the full pipeline (transcript → summary) with no calendar setup.
      const now = new Date();
      const stamp = now.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      const autoEvent = await db.event.create({
        data: {
          iCalUID: `test-${Date.now()}@wiggli.local`,
          summary: `Test meeting — ${stamp}`,
          eventType: "Meeting",
          start: now,
          end: new Date(now.getTime() + 30 * 60 * 1000),
          timezone: "UTC",
          organizerEmail: session.user.email!.toLowerCase(),
          hangoutLink: meetingUrl,
          status: "SCHEDULED",
        },
      });
      metaEventId = autoEvent.id;
      const note = await db.meetingNote.create({
        data: { eventId: autoEvent.id, source: "RECALL_BOT", status: "JOINING" },
      });
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
