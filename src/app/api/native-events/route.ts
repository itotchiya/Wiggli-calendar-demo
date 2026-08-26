import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createGoogleEvent } from "@/lib/google/calendar";
import { withFreshGoogleClient, AuthExpiredError } from "@/lib/google-auth";
import { db } from "@/lib/prisma";
import { slotNoticeText } from "@/lib/smart-email-template";
import { eventTitleForSlot, type SmartEventSlot } from "@/lib/smart-event-schema";

/**
 * NATIVE Google Calendar invitation flow (approach B):
 * Creates the event with sendUpdates:"all" so GOOGLE itself emails every
 * attendee its standard calendar invitation — title, time, location/Meet link,
 * organizer, description, reminders. No custom email, no ICS attachment, no
 * second drawer step. Attendees respond with the built-in Yes/Maybe/No and
 * responses sync via /api/sync as usual.
 *
 * POST { title, description?, location?, conference?, meetLink?,
 *        reminderMinutes?, date, start, end, slots?, timezone,
 *        attendees:[{email,name?}] }
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
  const rawSlots = Array.isArray(body.slots) && body.slots.length > 0
    ? body.slots
    : [{ date, start, end }];
  const slots = rawSlots.map((value) => {
    if (!value || typeof value !== "object") return { date: "", start: "", end: "" };
    const slot = value as { date?: unknown; start?: unknown; end?: unknown };
    return {
      date: typeof slot.date === "string" ? slot.date.trim() : "",
      start: typeof slot.start === "string" ? slot.start.trim() : "",
      end: typeof slot.end === "string" ? slot.end.trim() : "",
    };
  });

  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (slots.some((slot) => !/^\d{4}-\d{2}-\d{2}$/.test(slot.date) || !/^\d{2}:\d{2}$/.test(slot.start) || !/^\d{2}:\d{2}$/.test(slot.end) || slot.end <= slot.start))
    return NextResponse.json({ error: "Each slot must have a valid date, start time, and end time." }, { status: 400 });

  const attendees = rawAttendees
    .map((a) => a as { email?: unknown; name?: unknown; type?: unknown })
    .filter((a) => typeof a.email === "string" && /.+@.+\..+/.test(a.email))
    .map((a) => ({
      email: (a.email as string).toLowerCase(),
      name: typeof a.name === "string" ? a.name : undefined,
      type: typeof a.type === "string" ? a.type : undefined,
    }));
  if (attendees.length === 0)
    return NextResponse.json({ error: "At least one valid attendee email is required." }, { status: 400 });

  const organizerEmail = session.user.email.toLowerCase();

  try {
    const { zonedWallClockToUtc } = await import("@/lib/datetime");
    const smartSlots: SmartEventSlot[] = slots.map((slot) => ({ date: slot.date, startTime: slot.start, endTime: slot.end }));
    const created = await withFreshGoogleClient(session.accessToken, organizerEmail, async (client) => {
      const results: {
        id: string;
        googleEventId: string;
        hangoutLink: string | null;
        htmlLink: string | null;
      }[] = [];
      for (const [index, slot] of slots.entries()) {
        const calendarTitle = eventTitleForSlot(title, index, slots.length);
        const startUtc = zonedWallClockToUtc(`${slot.date}T${slot.start}`, timezone);
        const endUtc = zonedWallClockToUtc(`${slot.date}T${slot.end}`, timezone);
        if (endUtc <= startUtc) throw new Error("End must be after start.");
        if (startUtc.getTime() < Date.now() - 60_000) throw new Error("Start time must be in the future.");
        const notice = slotNoticeText(smartSlots, index);
        const result = await createGoogleEvent(client.credentials.access_token ?? session.accessToken!, {
          summary: calendarTitle,
          description: [str("description"), notice].filter(Boolean).join("\n\n") || undefined,
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
          sendUpdates: "all", // Google emails its own native invitations
        });

        const event = await db.event.create({
          data: {
            googleEventId: result.id,
            iCalUID: result.iCalUID,
            summary: calendarTitle,
            eventType: str("eventType") || null,
            description: [str("description"), notice].filter(Boolean).join("\n\n") || null,
            location: result.hangoutLink ?? str("location") ?? null,
            hangoutLink: result.hangoutLink,
            reminderMinutes:
              body.reminderMinutes == null ? null : Math.max(0, Number(body.reminderMinutes) || 0),
            start: startUtc,
            end: endUtc,
            timezone,
            organizerEmail,
            sequence: 0,
            attendees: { create: attendees.map((a) => ({ email: a.email, name: a.name, type: a.type })) },
          },
          include: { attendees: true },
        });
        results.push({ id: event.id, googleEventId: result.id, hangoutLink: result.hangoutLink, htmlLink: result.htmlLink });
      }
      return results;
    });

    return NextResponse.json(
      {
        ...created[0],
        events: created,
        count: created.length,
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
