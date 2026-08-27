import { google, type gmail_v1 } from "googleapis";
import { db } from "../prisma";

/**
 * Google "Propose a new time" detection.
 *
 * Per Google's Calendar API docs (events resource), a counter-proposal is NOT
 * exposed on the event: the organizer's `events.get` only shows the attendee's
 * responseStatus flip to "tentative". The proposal itself (which time, from
 * whom) arrives solely as a Gmail notification from Google:
 *   Subject: "<Event title> - <Attendee> proposed a new time"
 *   / "… has accepted this invitation and proposed a new time: <slot>"
 *   / "… has declined this invitation and proposed a new time: <slot>"
 * with an update note when the attendee added a message.
 *
 * This scanner mirrors those notifications into the local DB so the Smart
 * Event preview dialog can surface "Proposed time" rows and drive the
 * reschedule flow. Idempotent via the RsvpTokenLog dedupe table.
 */

export type ProposalSyncResult = {
  scannedMessages: number;
  newProposals: number;
  errors: string[];
};

export type DetectedProposal = {
  eventId: string;
  attendeeEmail: string;
  /** Raw slot text from the notification, e.g. "Tue 2 Sep 2026, 14:00 – 14:30". */
  slotLabel: string;
  note: string | null;
};

// Subjects Google uses for proposal notifications (en + common variants kept
// narrow to avoid false positives).
const PROPOSAL_SUBJECT_PATTERNS = [
  /proposed a new time/i,
  /a new time has been proposed/i,
];

function decodeBody(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function textParts(part: gmail_v1.Schema$MessagePart | undefined): string[] {
  if (!part) return [];
  const nested = (part.parts ?? []).flatMap((child) => textParts(child));
  const mime = part.mimeType?.toLowerCase();
  if ((mime === "text/plain" || mime === "text/html") && part.body?.data) {
    return [...nested, decodeBody(part.body.data)];
  }
  return nested;
}

/** Extract the proposed slot sentence from the notification body. */
function extractSlotLabel(body: string): string | null {
  const plain = body
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  const match = plain.match(/proposed a new time:?\s*([^.\n<]{6,120})/i)
    ?? plain.match(/proposed time:?\s*([^.\n<]{6,120})/i);
  return match ? match[1]!.trim().slice(0, 140) : null;
}

/** Extract the optional attendee note ("… and added a note: <text>"). */
function extractNote(body: string): string | null {
  const plain = body.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const match = plain.match(/(?:note|comment):?\s*["“]?([^"”\n<]{3,300})["”]?\s*$/i);
  return match ? match[1]!.trim().slice(0, 300) : null;
}

export async function syncInboundProposals(
  accessToken: string,
  organizerEmail: string,
  onlyEventId?: string | null
): Promise<ProposalSyncResult> {
  const result: ProposalSyncResult = { scannedMessages: 0, newProposals: 0, errors: [] };
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth });

  const list = await gmail.users.messages.list({
    userId: "me",
    q: 'newer_than:30d from:calendar-notification@google.com "proposed a new time"',
    maxResults: 100,
  });

  for (const message of list.data.messages ?? []) {
    if (!message.id) continue;
    result.scannedMessages += 1;
    const token = `proposal:${message.id}`;
    if (await db.rsvpTokenLog.findFirst({ where: { token }, select: { id: true } })) continue;

    try {
      const full = await gmail.users.messages.get({ userId: "me", id: message.id, format: "full" });
      const subject =
        full.data.payload?.headers?.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "";
      if (!PROPOSAL_SUBJECT_PATTERNS.some((pattern) => pattern.test(subject))) continue;

      // Notification threads carry the event title in the subject:
      // "<Title> - <Attendee> proposed a new time" or updated-invitation forms.
      const titleCandidate = subject
        .replace(/^(updated invitation|invitation):?\s*/i, "")
        .replace(/\s*[-–:]\s*[^-–:]*proposed a new time.*$/i, "")
        .trim();

      const candidates = await db.event.findMany({
        where: {
          organizerEmail: organizerEmail.toLowerCase(),
          ...(onlyEventId ? { id: onlyEventId } : {}),
          ...(titleCandidate ? { summary: { contains: titleCandidate } } : {}),
        },
        include: { attendees: true },
        orderBy: { start: "asc" },
        take: 5,
      });
      // Prefer the event whose title matches best; fall back to the only match.
      const event =
        candidates.find((item) => titleCandidate && item.summary.toLowerCase().includes(titleCandidate.toLowerCase()))
        ?? (candidates.length === 1 ? candidates[0] : undefined);
      if (!event) continue;

      const bodies = textParts(full.data.payload ?? undefined);
      const body = bodies.find((item) => !item.toLowerCase().startsWith("<!doctype")) ?? bodies.join("\n");
      const slotLabel = extractSlotLabel(body);
      if (!slotLabel) continue;

      // Who proposed: Google names the attendee in the subject or body.
      const whoMatch =
        subject.match(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+)/) ??
        body.match(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+)\s+proposed/i);
      const attendee =
        (whoMatch && event.attendees.find((item) => item.email.toLowerCase() === whoMatch[1]!.toLowerCase()))
        ?? event.attendees.find((item) => body.includes(item.email));

      const proposal = await db.eventProposal.create({
        data: {
          eventId: event.id,
          attendeeEmail: attendee?.email.toLowerCase() ?? whoMatch?.[1]?.toLowerCase() ?? "unknown",
          slotLabel,
          note: extractNote(body),
          source: "gmail-notification",
        },
      });

      await db.rsvpTokenLog.create({
        data: {
          token,
          dedupeKey: token,
          eventId: event.id,
          attendeeEmail: proposal.attendeeEmail,
          action: "proposal",
          receivedAt: new Date(),
        },
      });

      result.newProposals += 1;
    } catch (error) {
      result.errors.push(`Proposal message ${message.id}: ${(error as Error).message}`);
    }
  }

  return result;
}
