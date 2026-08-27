import { NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { withFreshGoogleClient, AuthExpiredError } from "@/lib/google-auth";
import { db } from "@/lib/prisma";

/**
 * Reschedule ("Update & notify"): moves the event to the new start/end on
 * Google Calendar with sendUpdates:"all" — every attendee receives Google's
 * updated-invitation email (native), including the organizer's note in the
 * event description. Also marks any pending counter-proposals ACCEPTED.
 *
 * PATCH /api/events/[id]/reschedule  { start: "YYYY-MM-DDTHH:mm", end, timezone, note? }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    start?: string;
    end?: string;
    timezone?: string;
    note?: string;
  } | null;
  if (!body?.start || !body?.end) {
    return NextResponse.json({ error: "start and end are required" }, { status: 400 });
  }

  const event = await db.event.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (!event.googleEventId) {
    return NextResponse.json({ error: "Event has no Google Calendar counterpart" }, { status: 409 });
  }

  const timezone = body.timezone || event.timezone || "UTC";
  const { zonedWallClockToUtc } = await import("@/lib/datetime");
  let startUtc: Date;
  let endUtc: Date;
  try {
    startUtc = zonedWallClockToUtc(body.start, timezone);
    endUtc = zonedWallClockToUtc(body.end, timezone);
  } catch {
    return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });
  }
  if (endUtc <= startUtc) {
    return NextResponse.json({ error: "End must be after start" }, { status: 400 });
  }

  try {
    await withFreshGoogleClient(session.accessToken!, event.organizerEmail, async (client) => {
      const accessToken = client.credentials.access_token ?? session.accessToken!;
      const authClient = new google.auth.OAuth2();
      authClient.setCredentials({ access_token: accessToken });
      const calendar = google.calendar({ version: "v3", auth: authClient });

      const remote = await calendar.events.get({
        calendarId: "primary",
        eventId: event.googleEventId!,
      });

      await calendar.events.update({
        calendarId: "primary",
        // sendUpdates:"all" → Google emails every attendee the updated invitation.
        sendUpdates: "all",
        eventId: event.googleEventId!,
        requestBody: {
          ...remote.data,
          start: { dateTime: startUtc.toISOString(), timeZone: timezone },
          end: { dateTime: endUtc.toISOString(), timeZone: timezone },
          // The note rides in the description so it appears in every native
          // invitation and calendar card ("updated because …").
          description: body.note?.trim()
            ? [remote.data.description?.replace(/— Updated:[\s\S]*$/, "").trim(), `— Updated: ${body.note.trim()}`].filter(Boolean).join("\n\n")
            : remote.data.description,
        },
      });
    });

    await db.$transaction([
      db.event.update({
        where: { id },
        data: {
          start: startUtc,
          end: endUtc,
          timezone,
          rescheduledAt: new Date(),
          rescheduleNote: body.note?.trim() || null,
          status: "SCHEDULED",
        },
      }),
      // Proposals satisfied by the accepted new time.
      db.eventProposal.updateMany({
        where: { eventId: id, status: "PENDING" },
        data: { status: "ACCEPTED" },
      }),
    ]);

    return NextResponse.json({ ok: true, start: startUtc.toISOString(), end: endUtc.toISOString() });
  } catch (err) {
    if (err instanceof AuthExpiredError) {
      return NextResponse.json({ error: err.message, code: "AUTH_EXPIRED" }, { status: 401 });
    }
    console.error("[events:reschedule]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reschedule" },
      { status: 500 }
    );
  }
}
