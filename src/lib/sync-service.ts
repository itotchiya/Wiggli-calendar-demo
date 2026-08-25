import { db } from "./prisma";
import { fetchEventRsvp } from "./google/calendar";

/**
 * Pull authoritative RSVP statuses from Google Calendar into SQLite.
 * Attendees respond NATIVELY on the calendar invite (Gmail/Outlook/Apple) —
 * Google's event holds the live statuses; we mirror them here.
 */

export type SyncResult = {
  syncedEvents: number;
  updatedAttendees: number;
  errors: string[];
};

/** Sync one event by local id. Returns null if the event has no Google id. */
export async function syncEventById(
  accessToken: string,
  eventId: string
): Promise<{ result: SyncResult; hasGoogleId: boolean }> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    include: { attendees: true },
  });
  if (!event) throw new Error("Event not found");
  if (!event.googleEventId) {
    return { result: emptySync(), hasGoogleId: false };
  }

  const result = await applyRemoteStatuses(accessToken, event.googleEventId, event.attendees);
  return { result, hasGoogleId: true };
}

/** Sync all events that have a Google Calendar counterpart. */
export async function syncAllEvents(accessToken: string): Promise<SyncResult> {
  const events = await db.event.findMany({
    where: { googleEventId: { not: null } },
    include: { attendees: true },
  });

  const total = emptySync();
  for (const event of events) {
    try {
      const r = await applyRemoteStatuses(accessToken, event.googleEventId!, event.attendees);
      total.syncedEvents += r.syncedEvents;
      total.updatedAttendees += r.updatedAttendees;
      total.errors.push(...r.errors);
    } catch (err) {
      total.errors.push(`${event.summary}: ${(err as Error).message}`);
    }
  }
  return total;
}

async function applyRemoteStatuses(
  accessToken: string,
  googleEventId: string,
  attendees: { id: string; email: string; rsvp: string }[]
): Promise<SyncResult> {
  const remote = await fetchEventRsvp(accessToken, googleEventId);
  const remoteByEmail = new Map(remote.map((r) => [r.email, r.rsvp]));

  let updated = 0;
  for (const attendee of attendees) {
    const next = remoteByEmail.get(attendee.email.toLowerCase());
    if (next && next !== attendee.rsvp) {
      await db.attendee.update({
        where: { id: attendee.id },
        data: { rsvp: next, respondedAt: new Date() },
      });
      updated++;
    }
  }

  return { syncedEvents: 1, updatedAttendees: updated, errors: [] };
}

function emptySync(): SyncResult {
  return { syncedEvents: 0, updatedAttendees: 0, errors: [] };
}
