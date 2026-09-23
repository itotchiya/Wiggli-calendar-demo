import { google, type gmail_v1 } from "googleapis";
import { IcalReplyParseError, parseIcalReply } from "../ical-reply-parser";
import { db } from "../prisma";

export type InboundReplySyncResult = {
  scannedMessages: number;
  processedReplies: number;
  updatedAttendees: number;
  errors: string[];
};

const STATUS_TO_ACTION = {
  ACCEPTED: "yes",
  TENTATIVE: "maybe",
  DECLINED: "no",
} as const;

// Gmail messages already inspected that carry no reply for a Wiggli event
// (other organizers, deleted events, non-REPLY parts). Remembering them keeps
// each 15s poll from re-downloading the same messages and attachments.
const irrelevantMessageIds = new Set<string>();

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
  );
}

function decodeBody(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

async function calendarParts(
  gmail: gmail_v1.Gmail,
  messageId: string,
  part?: gmail_v1.Schema$MessagePart
): Promise<string[]> {
  if (!part) return [];
  const nested = await Promise.all((part.parts ?? []).map((child) => calendarParts(gmail, messageId, child)));
  const values = nested.flat();
  const mime = part.mimeType?.toLowerCase();
  const calendarAttachment = part.filename?.toLowerCase().endsWith(".ics");
  if (mime !== "text/calendar" && mime !== "application/ics" && !calendarAttachment) return values;

  if (part.body?.data) values.push(decodeBody(part.body.data));
  else if (part.body?.attachmentId) {
    const attachment = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId,
      id: part.body.attachmentId,
    });
    if (attachment.data.data) values.push(decodeBody(attachment.data.data));
  }
  return values;
}

/**
 * Inspect recent organizer Gmail messages for Outlook/Apple METHOD:REPLY parts.
 * Google replies are still pulled from Calendar directly by sync-service.
 */
export async function syncInboundGmailReplies(
  accessToken: string,
  organizerEmail: string,
  onlyEventId?: string | null
): Promise<InboundReplySyncResult> {
  const result: InboundReplySyncResult = {
    scannedMessages: 0,
    processedReplies: 0,
    updatedAttendees: 0,
    errors: [],
  };
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth });
  const calendar = google.calendar({ version: "v3", auth });
  const list = await gmail.users.messages.list({
    userId: "me",
    q: 'newer_than:30d {filename:ics "BEGIN:VCALENDAR" "METHOD:REPLY"}',
    maxResults: 100,
  });

  const messages = (list.data.messages ?? []).filter(
    (message): message is gmail_v1.Schema$Message & { id: string } =>
      Boolean(message.id) && !irrelevantMessageIds.has(message.id!)
  );
  const processed = new Set(
    (
      await db.rsvpTokenLog.findMany({
        where: { token: { in: messages.map((message) => `gmail:${message.id}`) } },
        select: { token: true },
      })
    ).map((log) => log.token)
  );

  for (const message of messages) {
    result.scannedMessages += 1;
    const token = `gmail:${message.id}`;
    if (processed.has(token)) continue;

    let relevant = false;
    try {
      const full = await gmail.users.messages.get({ userId: "me", id: message.id, format: "full" });
      const parts = await calendarParts(gmail, message.id, full.data.payload ?? undefined);
      for (const ics of parts) {
        let reply;
        try {
          reply = parseIcalReply(ics);
        } catch (error) {
          if (error instanceof IcalReplyParseError) continue;
          throw error;
        }
        if (reply.organizerEmail !== organizerEmail.toLowerCase()) continue;
        const event = await db.event.findUnique({
          where: { iCalUID: reply.uid },
          include: { attendees: true },
        });
        if (!event) continue;
        const attendee = event.attendees.find((item) => item.email.toLowerCase() === reply.attendeeEmail);
        if (!attendee) continue;
        relevant = true;
        if (onlyEventId && event.id !== onlyEventId) continue;

        if (event.googleEventId) {
          const remoteEvent = await calendar.events.get({
            calendarId: "primary",
            eventId: event.googleEventId,
          });
          const remoteAttendees = (remoteEvent.data.attendees ?? []).map((item) =>
            item.email?.toLowerCase() === reply.attendeeEmail
              ? { ...item, responseStatus: reply.status.toLowerCase() }
              : item
          );
          await calendar.events.patch({
            calendarId: "primary",
            eventId: event.googleEventId,
            sendUpdates: "none",
            requestBody: {
              attendees: remoteAttendees,
            },
          });
        }

        const respondedAt = new Date();
        try {
          await db.$transaction([
            db.attendee.update({
              where: { id: attendee.id },
              data: { rsvp: reply.status, respondedAt },
            }),
            db.rsvpTokenLog.create({
              data: {
                token,
                dedupeKey: token,
                eventId: event.id,
                attendeeEmail: reply.attendeeEmail,
                action: STATUS_TO_ACTION[reply.status],
                receivedAt: respondedAt,
              },
            }),
          ]);
        } catch (error) {
          // Multiple dashboard tabs can poll /api/sync at the same time. The
          // unique source key makes the second worker an idempotent no-op.
          if (isUniqueConstraintError(error)) break;
          throw error;
        }
        result.processedReplies += 1;
        if (attendee.rsvp !== reply.status) result.updatedAttendees += 1;
        break;
      }
      if (!relevant) irrelevantMessageIds.add(message.id);
    } catch (error) {
      result.errors.push(`Gmail message ${message.id}: ${(error as Error).message}`);
    }
  }
  return result;
}
