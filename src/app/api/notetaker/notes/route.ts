import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { createNotetakerBot } from "@/lib/recall";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.email) return null;
  return session;
}

/** GET: all meeting notes with their event (table view). */
export async function GET() {
  if (!(await requireUser())) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const notes = await db.meetingNote.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        event: { include: { attendees: true } },
        _count: { select: { insights: true, actions: true } },
      },
    });
    return NextResponse.json({ notes });
  } catch (err) {
    console.error("[notetaker:list]", err);
    return NextResponse.json({ error: "Failed to list meeting notes" }, { status: 500 });
  }
}

/**
 * POST { eventId, source? }: create a note for an event.
 * source=RECALL_BOT (default): schedules a Recall bot on the event's Meet link now.
 * source=MANUAL_PASTE: creates a CREATED note; caller PUTs the transcript next.
 */
export async function POST(req: Request) {
  if (!(await requireUser())) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  let body: { eventId?: string; source?: string };
  try {
    body = (await req.json()) as { eventId?: string; source?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });
  const source = body.source === "MANUAL_PASTE" ? "MANUAL_PASTE" : "RECALL_BOT";

  try {
    const event = await db.event.findUnique({ where: { id: body.eventId } });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    const existing = await db.meetingNote.findUnique({ where: { eventId: body.eventId } });
    if (existing) return NextResponse.json({ note: existing, reused: true });

    const meetingUrl =
      event.hangoutLink ??
      (event.previewData as { meetingLinks?: { provider?: string; url?: string }[] } | null)?.meetingLinks?.[0]?.url ??
      null;

    if (source === "RECALL_BOT") {
      if (!meetingUrl) {
        return NextResponse.json(
          { error: "This event has no meeting link yet — the bot needs a Google Meet URL." },
          { status: 400 }
        );
      }
      const bot = await createNotetakerBot({
        meetingUrl,
        joinAt: new Date().toISOString(), // join now (test); scheduling by start time comes next
        eventId: event.id,
      });
      const note = await db.meetingNote.create({
        data: { eventId: event.id, source, status: "JOINING", recallBotId: String(bot.id) },
      });
      return NextResponse.json({ note, bot }, { status: 201 });
    }

    const note = await db.meetingNote.create({ data: { eventId: event.id, source } });
    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    console.error("[notetaker:create]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create note" }, { status: 500 });
  }
}
