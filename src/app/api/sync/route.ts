import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncAllEvents, syncEventById } from "@/lib/sync-service";

/**
 * Mirror native calendar RSVP responses into SQLite.
 * Attendees answer with Gmail/Outlook/Apple's built-in Yes/Maybe/No;
 * Google's event is the source of truth and this endpoint pulls it in.
 *
 * The /dashboard/events page calls this automatically on an interval,
 * so statuses stay fresh without anyone pressing anything.
 *
 * POST /api/sync            → all events
 * POST /api/sync?id=<evtId> → single event
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!session.accessToken) {
    return NextResponse.json(
      { error: "Missing Google access token — please sign in again." },
      { status: 401 }
    );
  }

  const eventId = new URL(req.url).searchParams.get("id");

  try {
    const result = eventId
      ? (await syncEventById(session.accessToken, eventId)).result
      : await syncAllEvents(session.accessToken);

    return NextResponse.json({ ok: result.errors.length === 0, ...result });
  } catch (err) {
    console.error("[sync]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
