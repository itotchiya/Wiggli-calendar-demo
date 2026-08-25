import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createGoogleEvent } from "@/lib/google/calendar";
import { withFreshGoogleClient, AuthExpiredError } from "@/lib/google-auth";
import { db } from "@/lib/prisma";

/**
 * NATIVE Google Calendar invitation flow (approach B):
 * Creates the event with sendUpdates:"all" so GOOGLE itself emails every
 * attendee its standard calendar invitation — title, time, location/Meet link,
 * organizer, description, reminders. No custom email, no ICS attachment, no
 * second drawer step. Attendees respond with the built-in Yes/Maybe/No and
 * responses sync via /api/sync as usual.
 *
 * POST { title, description?, location?, conference?, meetLink?,
 *        reminderMinutes?, date, start, end, timezone, attendees:[{email,name?}] }
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email || !session.accessToken) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!session.accessToken) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const str = (k: string): string =>
    typeof body[k] === "string" ? (body[k] as string).trim() : "";
  const title = str("title");
  const date = str("date");
  const start = str("start");
  const end = str("end");
  const timezone = str("timezone") || "UTC";
  const rawAttendees = Array.isArray(body.attendees) ? body.attendees : [];

  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (!date || !start || !end)
    return NextResponse.json({ error: "date, start and end are required." }, { status: 400 });

  const attendees = rawAttendees
    .map((a) => a as { email?: unknown; name?: unknown })
    .filter((a) => typeof a.email === "string" && /.+@.+\..+/.test(a.email))
    .map((a) => ({
      email: (a.email as string).toLowerCase(),
      name: typeof a.name === "string" ? a.name : undefined,
    }));
  if (attendees.length === 0)
    return NextResponse.json({ error: "At least one valid attendee email is required." }, { status: 400 });

  // Wall-clock → UTC using the same DST-correct helper as the main flow.
  const { zonedWallClockToUtc } = await import("@/lib/datetime");
  const startUtc = zonedWallClockToUtc(`${date}T${start}`, timezone);
  const endUtc = zonedWallClockToUtc(`${date}T${end}`, timezone);
  if (endUtc <= startUtc)
    return NextResponse.json({ error: "End must be after start." }, { status: 400 });
  if (startUtc.getTime() < Date.now() - 60_000)
    return NextResponse.json({ error: "Start time must be in the future." }, { status: 400 });

  const organizerEmail = session.user.email.toLowerCase();

  try {
    const result = await withFreshGoogleClient(session.accessToken, organizerEmail, (client) =>
      createGoogleEvent(client.credentials.access_token ?? session.accessToken!, {
        summary: title,
        description: str("description") || undefined,
        location:
          typeof body.meetLink === "string" && body.meetLink
            ? undefined
            : str("location") || undefined,
        startIso: startUtc.toISOString(),
        endIso: endUtc.toISOString(),
        timezone,
        attendees,
        conference: Boolean(body.conference),
        reminderMinutes:
          body.reminderMinutes == null ? null : Math.max(0, Number(body.reminderMinutes) || 0),
        sendUpdates: "all", // ← Google emails its own native invitations
      })
    );

    // Persist locally so the events dashboard can track RSVPs for it too.
    const event = await db.event.create({
      data: {
        googleEventId: result.id,
        iCalUID: result.iCalUID,
        summary: title,
        description: str("description") || null,
        location: result.hangoutLink ?? str("location") ?? null,
        hangoutLink: result.hangoutLink,
        reminderMinutes:
          body.reminderMinutes == null ? null : Math.max(0, Number(body.reminderMinutes) || 0),
        start: startUtc,
        end: endUtc,
        timezone,
        organizerEmail,
        sequence: 0,
        attendees: { create: attendees.map((a) => ({ email: a.email, name: a.name })) },
      },
      include: { attendees: true },
    });

    return NextResponse.json(
      {
        id: event.id,
        googleEventId: result.id,
        hangoutLink: result.hangoutLink,
        htmlLink: result.htmlLink,
        note: "Created with sendUpdates:'all' — Google sent native invitations to all attendees.",
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof AuthExpiredError) {
      return NextResponse.json({ error: err.message, code: "AUTH_EXPIRED" }, { status: 401 });
    }
    console.error("[native-events:create]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create native event" },
      { status: 500 }
    );
  }
}
