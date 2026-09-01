import { db } from "./prisma";
import {
  fetchEventRsvp,
  getGoogleCalendarEventWithClient,
  listGoogleCalendarEventsWithClient,
  type GoogleCalendarEventRecord,
} from "./google/calendar";
import { withFreshGoogleClient } from "./google-auth";
import { zonedWallClockToUtc } from "./datetime";

/**
 * Pull authoritative RSVP statuses from Google Calendar into SQLite.
 * Attendees respond NATIVELY on the calendar invite (Gmail/Outlook/Apple) —
 * Google's event holds the live statuses; we mirror them here.
 */

export type SyncResult = {
  syncedEvents: number;
  updatedAttendees: number;
  importedEvents: number;
  updatedEvents: number;
  errors: string[];
};

export type CalendarImportResult = {
  importedEvents: number;
  updatedEvents: number;
  cancelledEvents: number;
  errors: string[];
};

// Multiple open dashboard views can tick the same endpoint at once. Reuse a
// recent full-calendar result and coalesce concurrent requests so every tab
// does not issue a duplicate Google events.list call.
let recentCalendarSync: { at: number; result: CalendarImportResult } | null = null;
let calendarSyncInFlight: Promise<CalendarImportResult> | null = null;

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
  attendees: { id: string; email: string; rsvp: string; comment: string | null }[]
): Promise<SyncResult> {
  const remote = await fetchEventRsvp(accessToken, googleEventId);
  const remoteByEmail = new Map(remote.map((r) => [r.email, r]));

  let updated = 0;
  for (const attendee of attendees) {
    const next = remoteByEmail.get(attendee.email.toLowerCase());
    if (next && (next.rsvp !== attendee.rsvp || next.comment !== (attendee.comment ?? null))) {
      await db.attendee.update({
        where: { id: attendee.id },
        data: {
          rsvp: next.rsvp,
          comment: next.comment,
          respondedAt: next.rsvp !== attendee.rsvp ? new Date() : undefined,
        },
      });
      updated++;
    }
  }

  return { syncedEvents: 1, updatedAttendees: updated, importedEvents: 0, updatedEvents: 0, errors: [] };
}

function emptySync(): SyncResult {
  return { syncedEvents: 0, updatedAttendees: 0, importedEvents: 0, updatedEvents: 0, errors: [] };
}

/**
 * Import the primary Google Calendar into the same event table used by Wiggli.
 * Existing Wiggli-created rows are refreshed in place; events found only in
 * Google are marked source=GOOGLE so the calendar can render them differently.
 */
export async function syncGoogleCalendar(
  accessToken: string,
  organizerEmail: string,
  localEventId?: string
): Promise<CalendarImportResult> {
  if (!localEventId && recentCalendarSync && Date.now() - recentCalendarSync.at < 12_000) {
    return recentCalendarSync.result;
  }
  if (!localEventId && calendarSyncInFlight) return calendarSyncInFlight;

  const operation = withFreshGoogleClient(accessToken, organizerEmail, async (client) => {
    let remoteEvents: GoogleCalendarEventRecord[];
    if (localEventId) {
      const local = await db.event.findUnique({ where: { id: localEventId } });
      if (!local?.googleEventId) return emptyCalendarImport();
      remoteEvents = [await getGoogleCalendarEventWithClient(client, local.googleEventId)];
    } else {
      remoteEvents = await listGoogleCalendarEventsWithClient(client);
    }

    const result = emptyCalendarImport();
    for (const remote of remoteEvents) {
      try {
        const outcome = await upsertGoogleCalendarEvent(remote, organizerEmail);
        if (outcome === "imported") result.importedEvents++;
        if (outcome === "updated") result.updatedEvents++;
        if (outcome === "cancelled") result.cancelledEvents++;
      } catch (error) {
        result.errors.push(`${remote.summary || remote.id}: ${(error as Error).message}`);
      }
    }
    return result;
  });
  if (localEventId) return operation;
  calendarSyncInFlight = operation.then((result) => {
    recentCalendarSync = { at: Date.now(), result };
    calendarSyncInFlight = null;
    return result;
  }).catch((error) => {
    calendarSyncInFlight = null;
    throw error;
  });
  return calendarSyncInFlight;
}

async function upsertGoogleCalendarEvent(
  remote: GoogleCalendarEventRecord,
  fallbackOrganizerEmail: string
): Promise<"imported" | "updated" | "cancelled" | "ignored"> {
  if (!remote.id) return "ignored";
  const existing = await db.event.findFirst({
    where: { googleEventId: remote.id },
    include: { attendees: true },
  });
  const cancelled = remote.status === "cancelled";
  if (cancelled && !existing) return "ignored";

  const timezone = remote.start?.timeZone || remote.end?.timeZone || "Africa/Casablanca";
  const start = parseGoogleBoundary(remote.start, timezone);
  const end = parseGoogleBoundary(remote.end, timezone);
  if (!start || !end || end <= start) {
    if (existing && cancelled) {
      await db.event.update({ where: { id: existing.id }, data: { status: "CANCELLED" } });
      return "cancelled";
    }
    return "ignored";
  }

  const organizerEmail = normalizeEmail(remote.organizer?.email) || fallbackOrganizerEmail.toLowerCase();
  const organizerName = remote.organizer?.displayName?.trim() || organizerEmail.split("@")[0] || "Organizer";
  const hangoutLink = remote.hangoutLink || remote.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri || null;
  const attendees = (remote.attendees ?? [])
    .map((attendee) => ({
      email: normalizeEmail(attendee.email),
      name: attendee.displayName?.trim() || null,
      rsvp: normalizeRemoteRsvp(attendee.responseStatus),
      comment: attendee.comment?.trim() || null,
    }))
    .filter((attendee): attendee is { email: string; name: string | null; rsvp: "NEEDS_ACTION" | "ACCEPTED" | "TENTATIVE" | "DECLINED"; comment: string | null } => Boolean(attendee.email))
    .filter((attendee, index, list) => list.findIndex((candidate) => candidate.email === attendee.email) === index);
  const previewData = {
    organizerName,
    locations: remote.location && !remote.location.startsWith("http") ? [{ label: remote.location }] : [],
    meetingLinks: hangoutLink ? [{ provider: "Google Meet", url: hangoutLink }] : [],
  };
  const reminderMinutes = remote.reminders?.overrides?.find((override) => typeof override.minutes === "number")?.minutes ?? null;
  const summary = remote.summary?.trim() || "Untitled event";
  const status = cancelled ? "CANCELLED" : "SCHEDULED";

  if (existing) {
    const existingPreview = existing.previewData && typeof existing.previewData === "object" && !Array.isArray(existing.previewData)
      ? existing.previewData as Record<string, unknown>
      : {};
    await db.event.update({
      where: { id: existing.id },
      data: {
        summary,
        description: remote.description ?? existing.description,
        location: remote.location ?? existing.location,
        start,
        end,
        timezone,
        status,
        hangoutLink: hangoutLink ?? existing.hangoutLink,
        reminderMinutes: reminderMinutes ?? existing.reminderMinutes,
        previewData: existing.source === "WIGGLI" ? { ...existingPreview, meetingLinks: previewData.meetingLinks } : previewData,
      },
    });
    await syncRemoteAttendees(existing.id, existing.attendees, attendees);
    return cancelled ? "cancelled" : "updated";
  }

  await db.event.create({
    data: {
      googleEventId: remote.id,
      // Imported recurring instances share iCalUID values, so the Google id is
      // used as the local unique key while googleEventId remains the authority.
      iCalUID: `google:${remote.id}`,
      source: "GOOGLE",
      summary,
      description: remote.description ?? null,
      location: remote.location ?? null,
      start,
      end,
      timezone,
      organizerEmail,
      status,
      hangoutLink,
      reminderMinutes,
      previewData,
      attendees: {
        create: attendees.map((attendee) => ({
          email: attendee.email,
          name: attendee.name,
          rsvp: attendee.rsvp,
          comment: attendee.comment,
        })),
      },
    },
  });
  return "imported";
}

async function syncRemoteAttendees(
  eventId: string,
  existing: { id: string; email: string; name: string | null; type: string | null; rsvp: string; comment: string | null }[],
  remote: { email: string; name: string | null; rsvp: "NEEDS_ACTION" | "ACCEPTED" | "TENTATIVE" | "DECLINED"; comment: string | null }[]
) {
  const remoteEmails = new Set(remote.map((attendee) => attendee.email));
  if (remoteEmails.size > 0) {
    await db.attendee.deleteMany({ where: { eventId, email: { notIn: [...remoteEmails] } } });
  } else {
    await db.attendee.deleteMany({ where: { eventId } });
  }

  const existingByEmail = new Map(existing.map((attendee) => [attendee.email.toLowerCase(), attendee]));
  for (const attendee of remote) {
    const current = existingByEmail.get(attendee.email);
    if (current) {
      await db.attendee.update({
        where: { id: current.id },
        data: {
          name: attendee.name ?? current.name,
          rsvp: attendee.rsvp,
          comment: attendee.comment,
          respondedAt: attendee.rsvp !== current.rsvp ? new Date() : undefined,
        },
      });
    } else {
      await db.attendee.create({ data: { eventId, email: attendee.email, name: attendee.name, rsvp: attendee.rsvp, comment: attendee.comment } });
    }
  }
}

function parseGoogleBoundary(
  value: GoogleCalendarEventRecord["start"] | GoogleCalendarEventRecord["end"],
  timezone: string
): Date | null {
  if (!value) return null;
  if (value.dateTime) {
    const parsed = new Date(value.dateTime);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value.date) {
    try {
      return zonedWallClockToUtc(`${value.date}T00:00`, timezone);
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null;
}

function normalizeRemoteRsvp(status?: string | null): "NEEDS_ACTION" | "ACCEPTED" | "TENTATIVE" | "DECLINED" {
  if (status === "accepted") return "ACCEPTED";
  if (status === "tentative") return "TENTATIVE";
  if (status === "declined") return "DECLINED";
  return "NEEDS_ACTION";
}

function emptyCalendarImport(): CalendarImportResult {
  return { importedEvents: 0, updatedEvents: 0, cancelledEvents: 0, errors: [] };
}
