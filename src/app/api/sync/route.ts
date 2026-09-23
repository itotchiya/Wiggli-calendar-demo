import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncEventById, syncGoogleCalendar } from "@/lib/sync-service";
import { syncInboundGmailReplies } from "@/lib/google/gmail-replies";
import { syncInboundProposals } from "@/lib/google/proposal-sync";
import { AuthExpiredError, withFreshGoogleClient } from "@/lib/google-auth";
import { resolveAcceptedSlotGroups, type SlotGroupResult } from "@/lib/slot-groups";
import { ensureCalendarWatch } from "@/lib/google/calendar-watch";

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
    // The full Calendar API response already contains each attendee's current
    // RSVP state, so a second events.get request per stored event is redundant
    // (and quickly exhausts Google's per-user query quota). Keep the targeted
    // per-event path for the preview refresh button only.
    // Proposals live only in Gmail and are independent of the Calendar pull,
    // so both run concurrently once Gmail replies are applied to Google.
    const proposalsPromise = syncInboundProposals(
      session.accessToken,
      session.user.email.toLowerCase(),
      eventId
    ).catch((error: Error) => ({ scannedMessages: 0, newProposals: 0, errors: [error.message] }));

    // The full Calendar API response already contains each attendee's current
    // RSVP state, so a second events.get request per stored event is redundant
    // (and quickly exhausts Google's per-user query quota). Keep the targeted
    // per-event path for the preview refresh button only.
    const attendeeResult = eventId
      ? (await syncEventById(session.accessToken, eventId)).result
      : { syncedEvents: 0, updatedAttendees: 0, importedEvents: 0, updatedEvents: 0, errors: [] as string[] };

    // Pull the organizer's primary calendar into the same event list. This is
    // intentionally part of the existing sync request so the dashboard's
    // 15-second poll keeps both Wiggli and external Google events current.
    const calendarSync = await syncGoogleCalendar(
      session.accessToken,
      session.user.email.toLowerCase(),
      eventId ?? undefined
    );
    const result = {
      ...attendeeResult,
      importedEvents: calendarSync.importedEvents,
      updatedEvents: calendarSync.updatedEvents,
      errors: [...attendeeResult.errors, ...calendarSync.errors],
    };

    // "Propose a new time" notifications live only in Gmail (the Calendar API
    // never exposes counter-proposals).
    const proposals = await proposalsPromise;

    // Accepted multi-slot invites → cancel the sibling slots. The Calendar
    // webhook does the same instantly; this poll is the fallback (and the
    // only path on localhost, which Google cannot reach). It also keeps the
    // 7-day push channel renewed.
    const organizerEmail = session.user.email.toLowerCase();
    let slotGroups: SlotGroupResult;
    try {
      slotGroups = await withFreshGoogleClient(session.accessToken, organizerEmail, async (client) => {
        await ensureCalendarWatch(client, organizerEmail).catch((error: Error) =>
          console.warn("[sync] calendar watch not registered:", error.message)
        );
        return resolveAcceptedSlotGroups(client, organizerEmail);
      });
    } catch (error) {
      slotGroups = { resolvedGroups: 0, cancelledSlots: 0, errors: [(error as Error).message] };
    }

    return NextResponse.json({
      ok: result.errors.length === 0 && inboundReplies.errors.length === 0 && proposals.errors.length === 0 && slotGroups.errors.length === 0,
      ...result,
      calendarSync,
      inboundReplies,
      proposals,
      slotGroups,
    });
  } catch (err) {
    if (err instanceof AuthExpiredError) {
      return NextResponse.json({ error: err.message, code: "AUTH_EXPIRED" }, { status: 401 });
    }
    console.error("[sync]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
