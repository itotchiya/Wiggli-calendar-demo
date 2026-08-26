import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncAllEvents, syncEventById } from "@/lib/sync-service";
import { syncInboundGmailReplies } from "@/lib/google/gmail-replies";

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
    return NextResponse.json({ error: "Sign in required", code: "AUTH_REQUIRED" }, { status: 401 });
  }
  if (!session.accessToken) {
    return NextResponse.json(
      { error: "Your Google session expired. Reconnect Google and try again.", code: "AUTH_EXPIRED" },
      { status: 401 }
    );
  }

  const eventId = new URL(req.url).searchParams.get("id");

  try {
    let inboundReplies;
    try {
      inboundReplies = await syncInboundGmailReplies(
        session.accessToken,
        session.user.email.toLowerCase(),
        eventId
      );
    } catch (error) {
      // Existing sessions may need to sign in again to grant gmail.readonly.
      inboundReplies = {
        scannedMessages: 0,
        processedReplies: 0,
        updatedAttendees: 0,
        errors: [(error as Error).message],
      };
    }
    const result = eventId
      ? (await syncEventById(session.accessToken, eventId)).result
      : await syncAllEvents(session.accessToken);

    return NextResponse.json({
      ok: result.errors.length === 0 && inboundReplies.errors.length === 0,
      ...result,
      inboundReplies,
    });
  } catch (err) {
    console.error("[sync]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
