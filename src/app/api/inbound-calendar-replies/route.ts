import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncRsvpToGoogleBestEffort } from "@/lib/events-service";
import {
  IcalReplyParseError,
  parseIcalReply,
  type IcalReplyStatus,
} from "@/lib/ical-reply-parser";
import { db } from "@/lib/prisma";

const STATUS_TO_ACTION: Record<IcalReplyStatus, "yes" | "maybe" | "no"> = {
  ACCEPTED: "yes",
  TENTATIVE: "maybe",
  DECLINED: "no",
};

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    typeof (body as Record<string, unknown>).ics !== "string"
  ) {
    return NextResponse.json(
      { error: "Request body must contain an ics string" },
      { status: 400 }
    );
  }

  let reply;
  try {
    reply = parseIcalReply((body as { ics: string }).ics);
  } catch (error) {
    if (error instanceof IcalReplyParseError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const signedInEmail = session.user.email.trim().toLowerCase();
  if (reply.organizerEmail !== signedInEmail) {
    return NextResponse.json(
      { error: "Reply organizer does not match the signed-in user" },
      { status: 403 }
    );
  }

  try {
    const event = await db.event.findUnique({
      where: { iCalUID: reply.uid },
      select: {
        id: true,
        googleEventId: true,
        organizerEmail: true,
      },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    if (event.organizerEmail.trim().toLowerCase() !== signedInEmail) {
      return NextResponse.json(
        { error: "Event does not belong to the signed-in organizer" },
        { status: 403 }
      );
    }

    const attendee = await db.attendee.findUnique({
      where: {
        eventId_email: {
          eventId: event.id,
          email: reply.attendeeEmail,
        },
      },
      select: { id: true },
    });
    if (!attendee) {
      return NextResponse.json(
        { error: "Attendee not found for this event" },
        { status: 404 }
      );
    }

    const respondedAt = new Date();
    const action = STATUS_TO_ACTION[reply.status];
    const auditToken = `inbound:${reply.uid}:${reply.attendeeEmail}:${reply.status}`;
    const duplicate = await db.rsvpTokenLog.findFirst({
      where: { token: auditToken },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        uid: reply.uid,
        attendeeEmail: reply.attendeeEmail,
        status: reply.status,
      });
    }
    await db.$transaction([
      db.attendee.update({
        where: { id: attendee.id },
        data: { rsvp: reply.status, respondedAt },
      }),
      db.rsvpTokenLog.create({
        data: {
          token: auditToken,
          eventId: event.id,
          attendeeEmail: reply.attendeeEmail,
          action,
          receivedAt: respondedAt,
        },
      }),
    ]);

    const googleSynced = await syncRsvpToGoogleBestEffort(
      signedInEmail,
      event.googleEventId,
      reply.attendeeEmail,
      reply.status
    );

    return NextResponse.json({
      ok: true,
      uid: reply.uid,
      attendeeEmail: reply.attendeeEmail,
      status: reply.status,
      respondedAt: respondedAt.toISOString(),
      googleSynced,
    });
  } catch (error) {
    console.error("[inbound-calendar-replies]", error);
    return NextResponse.json(
      { error: "Failed to process calendar reply" },
      { status: 500 }
    );
  }
}
