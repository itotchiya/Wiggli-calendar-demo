import { google } from "googleapis";
import { db } from "./prisma";
import { buildCancelIcs } from "./ics";
import { sendInviteEmail } from "./google/gmail";
import type { getGoogleClient } from "./google/calendar";

type GoogleClient = ReturnType<typeof getGoogleClient>;

export type SlotGroupResult = {
  resolvedGroups: number;
  cancelledSlots: number;
  errors: string[];
};

/**
 * Multi-slot invites create one event per proposed slot, all sharing a
 * slotGroupId. As soon as the deciding attendee (the candidate, or for
 * internal-only groups whoever answers first) accepts one slot, every other
 * slot in the group is cancelled: removed from Google Calendar and a
 * METHOD:CANCEL email is appended to each attendee's existing invite thread.
 *
 * Runs from both the Calendar push webhook and the dashboard poll; the
 * SCHEDULED → CANCELLED claim below makes concurrent runs idempotent.
 */
export async function resolveAcceptedSlotGroups(
  client: GoogleClient,
  organizerEmail: string
): Promise<SlotGroupResult> {
  const result: SlotGroupResult = { resolvedGroups: 0, cancelledSlots: 0, errors: [] };
  const organizer = organizerEmail.toLowerCase();

  // Only groups that still have more than one live slot need work.
  const acceptedSlots = await db.event.findMany({
    where: {
      organizerEmail: organizer,
      slotGroupId: { not: null },
      status: "SCHEDULED",
      attendees: { some: { rsvp: "ACCEPTED", email: { not: organizer } } },
    },
    select: { slotGroupId: true },
    distinct: ["slotGroupId"],
  });
  if (acceptedSlots.length === 0) return result;

  for (const { slotGroupId } of acceptedSlots) {
    try {
      const slots = await db.event.findMany({
        where: { slotGroupId },
        include: { attendees: true },
        orderBy: { start: "asc" },
      });
      const live = slots.filter((slot) => slot.status === "SCHEDULED");
      if (live.length < 2) continue;

      const guests = slots[0]!.attendees.filter((attendee) => attendee.email.toLowerCase() !== organizer);
      const candidate = guests.find((attendee) => attendee.type === "candidate");
      const deciders = new Set(
        (candidate ? [candidate] : guests).map((attendee) => attendee.email.toLowerCase())
      );

      // Earliest acceptance by a decider wins if they accepted several slots.
      let chosen: { id: string; at: number } | null = null;
      for (const slot of live) {
        for (const attendee of slot.attendees) {
          if (attendee.rsvp !== "ACCEPTED" || !deciders.has(attendee.email.toLowerCase())) continue;
          const at = attendee.respondedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
          if (!chosen || at < chosen.at) chosen = { id: slot.id, at };
        }
      }
      if (!chosen) continue;

      result.resolvedGroups += 1;
      for (const slot of live) {
        if (slot.id === chosen.id) continue;
        try {
          if (await cancelSlot(client, organizer, slot)) result.cancelledSlots += 1;
        } catch (error) {
          result.errors.push(`${slot.summary}: ${(error as Error).message}`);
        }
      }
    } catch (error) {
      result.errors.push(`Slot group ${slotGroupId}: ${(error as Error).message}`);
    }
  }
  return result;
}

type SlotRow = Awaited<ReturnType<typeof db.event.findMany<{ include: { attendees: true } }>>>[number];

async function cancelSlot(client: GoogleClient, organizerEmail: string, slot: SlotRow): Promise<boolean> {
  // Claim the slot first so a concurrent webhook/poll never double-cancels.
  const sequence = slot.sequence + 1;
  const claimed = await db.event.updateMany({
    where: { id: slot.id, status: "SCHEDULED" },
    data: { status: "CANCELLED", sequence },
  });
  if (claimed.count === 0) return false;

  if (slot.googleEventId) {
    const calendar = google.calendar({ version: "v3", auth: client });
    try {
      // Attendees were invited by our own Gmail emails, so Google stays
      // silent and the CANCEL below arrives in the original thread instead.
      await calendar.events.delete({ calendarId: "primary", eventId: slot.googleEventId, sendUpdates: "none" });
    } catch (error) {
      const code = Number((error as { code?: unknown }).code);
      if (code !== 404 && code !== 410) throw error;
    }
  }

  const organizerName = organizerEmail.split("@")[0]!;
  const ics = buildCancelIcs({
    uid: slot.iCalUID,
    sequence,
    organizer: { email: organizerEmail, name: organizerName },
    attendees: slot.attendees.map((attendee) => ({ email: attendee.email, name: attendee.name ?? undefined })),
    title: slot.summary,
    description: slot.description ?? undefined,
    location: slot.location ?? undefined,
    startUtc: slot.start,
    endUtc: slot.end,
  });
  const when = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: slot.timezone,
  }).format(slot.start);

  for (const attendee of slot.attendees) {
    if (attendee.email.toLowerCase() === organizerEmail) continue;
    const subject = slot.emailSubject?.trim() || `Invitation: ${slot.summary}`;
    await sendInviteEmail(client, {
      from: organizerEmail,
      replyTo: organizerEmail,
      to: [attendee.email],
      // Same subject + threadId + In-Reply-To keeps Gmail in one conversation.
      subject,
      text: `The ${when} option is no longer needed because another time slot was confirmed. It has been removed from your calendar.`,
      html: `<p>The <strong>${escapeHtml(when)}</strong> option is no longer needed because another time slot was confirmed. It has been removed from your calendar.</p>`,
      icsContent: ics,
      icsMethod: "CANCEL",
      icsFilename: "cancel.ics",
      ...(attendee.inviteThreadId ? { threadId: attendee.inviteThreadId } : {}),
      ...(attendee.inviteMessageId
        ? { inReplyTo: attendee.inviteMessageId, references: [attendee.inviteMessageId] }
        : {}),
    });
  }
  return true;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
