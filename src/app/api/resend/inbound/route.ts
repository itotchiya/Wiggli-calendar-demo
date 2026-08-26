import { NextResponse } from "next/server";
import { Resend, type WebhookEventPayload } from "resend";
import { resendCalendarConfig, resendWebhookSecret } from "@/lib/env";
import { syncRsvpToGoogleBestEffort } from "@/lib/events-service";
import {
  IcalReplyParseError,
  parseIcalReply,
  type IcalReplyStatus,
} from "@/lib/ical-reply-parser";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

const STATUS_TO_ACTION: Record<IcalReplyStatus, "yes" | "maybe" | "no"> = {
  ACCEPTED: "yes",
  TENTATIVE: "maybe",
  DECLINED: "no",
};

function mailboxEmail(value: string): string {
  const angle = value.match(/<([^<>]+)>/);
  return (angle?.[1] ?? value).trim().toLowerCase();
}

function isCalendarAttachment(attachment: { filename: string | null; content_type: string }) {
  const mime = attachment.content_type.toLowerCase().split(";", 1)[0]?.trim();
  return mime === "text/calendar" || mime === "application/ics" || attachment.filename?.toLowerCase().endsWith(".ics");
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
  );
}

async function loadCalendarParts(resend: Resend, emailId: string): Promise<{
  receivedFor: string[];
  parts: string[];
}> {
  const { data: email, error } = await resend.emails.receiving.get(emailId);
  if (error || !email) throw new Error(error?.message ?? "Could not retrieve received email");

  const parts: string[] = [];
  if (email.text?.includes("BEGIN:VCALENDAR")) parts.push(email.text.slice(email.text.indexOf("BEGIN:VCALENDAR")));

  for (const attachment of email.attachments.filter(isCalendarAttachment)) {
    const { data, error: attachmentError } = await resend.emails.receiving.attachments.get({
      emailId,
      id: attachment.id,
    });
    if (attachmentError || !data) {
      throw new Error(attachmentError?.message ?? `Could not retrieve attachment ${attachment.id}`);
    }
    const response = await fetch(data.download_url);
    if (!response.ok) throw new Error(`Calendar attachment download failed (${response.status})`);
    parts.push(await response.text());
  }

  return {
    receivedFor: email.received_for.map((value) => mailboxEmail(value)),
    parts,
  };
}

/**
 * Verified Resend Receiving webhook for Apple/Google/Outlook METHOD:REPLY.
 * The raw request body is mandatory because Resend signs the exact bytes.
 */
export async function POST(req: Request) {
  const payload = await req.text();
  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signature = req.headers.get("svix-signature");
  if (!id || !timestamp || !signature) {
    return NextResponse.json({ error: "Missing webhook signature headers" }, { status: 400 });
  }

  let resend: Resend;
  let event: WebhookEventPayload;
  try {
    const config = resendCalendarConfig();
    resend = new Resend(config.apiKey);
    event = resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret: resendWebhookSecret(),
    });
  } catch (error) {
    console.warn("[resend:inbound] rejected webhook:", error);
    return NextResponse.json({ error: "Invalid Resend webhook signature" }, { status: 400 });
  }

  if (event.type !== "email.received") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const inbound = await loadCalendarParts(resend, event.data.email_id);
    if (inbound.parts.length === 0) {
      return NextResponse.json({ ok: true, ignored: true, reason: "No calendar reply found" });
    }

    for (const ics of inbound.parts) {
      let reply;
      try {
        reply = parseIcalReply(ics);
      } catch (error) {
        if (error instanceof IcalReplyParseError) continue;
        throw error;
      }

      const eventRow = await db.event.findUnique({
        where: { iCalUID: reply.uid },
        select: {
          id: true,
          googleEventId: true,
          organizerEmail: true,
          sequence: true,
        },
      });
      if (!eventRow) continue;
      if (reply.sequence !== undefined && reply.sequence < eventRow.sequence) continue;

      const organizer = await db.organizerAccount.findUnique({
        where: { email: eventRow.organizerEmail },
        select: { calendarAlias: true },
      });
      const expectedAlias = organizer?.calendarAlias?.toLowerCase();
      if (
        !expectedAlias ||
        reply.organizerEmail !== expectedAlias ||
        !inbound.receivedFor.includes(expectedAlias)
      ) {
        continue;
      }
      const attendee = await db.attendee.findUnique({
        where: { eventId_email: { eventId: eventRow.id, email: reply.attendeeEmail } },
        select: { id: true },
      });
      if (!attendee) continue;

      const sourceId = event.data.email_id;
      const dedupeKey = `resend:${sourceId}`;
      const respondedAt = new Date();
      try {
        await db.$transaction([
          db.attendee.update({
            where: { id: attendee.id },
            data: { rsvp: reply.status, respondedAt },
          }),
          db.rsvpTokenLog.create({
            data: {
              token: dedupeKey,
              dedupeKey,
              eventId: eventRow.id,
              attendeeEmail: reply.attendeeEmail,
              action: STATUS_TO_ACTION[reply.status],
              receivedAt: respondedAt,
            },
          }),
        ]);
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return NextResponse.json({ ok: true, duplicate: true });
        }
        throw error;
      }

      const googleSynced = await syncRsvpToGoogleBestEffort(
        eventRow.organizerEmail,
        eventRow.googleEventId,
        reply.attendeeEmail,
        reply.status
      );
      return NextResponse.json({
        ok: true,
        uid: reply.uid,
        attendeeEmail: reply.attendeeEmail,
        status: reply.status,
        googleSynced,
      });
    }

    return NextResponse.json({ ok: true, ignored: true, reason: "No matching calendar reply" });
  } catch (error) {
    console.error("[resend:inbound]", error);
    // A 5xx makes Resend retry transient API, attachment, or database errors.
    return NextResponse.json({ error: "Failed to process Resend calendar reply" }, { status: 500 });
  }
}
