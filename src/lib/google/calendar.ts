import { google } from "googleapis";
import type { AttendeeInput } from "@/types/event";

/**
 * Build an OAuth2 client primed with the organizer's access token.
 * Token refresh (via NextAuth-stored refresh token) is handled upstream.
 */
export function getGoogleClient(accessToken: string) {
  const authClient = new google.auth.OAuth2();
  authClient.setCredentials({ access_token: accessToken });
  return authClient;
}

export type GoogleEventResult = {
  id: string;
  iCalUID: string;
  htmlLink: string | null;
};

/**
 * Insert the event into the organizer's primary Google Calendar.
 *
 * CRITICAL: `sendUpdates: "none"` suppresses Google's default gray invite
 * emails — we deliver our own branded HTML invites with an attached
 * METHOD:REQUEST .ics instead, while keeping native RSVP syncing intact
 * because the attendee list lives on the Google event itself.
 */
export async function createGoogleEvent(
  accessToken: string,
  eventData: {
    summary: string;
    description?: string;
    location?: string;
    /** Full RFC 3339 instants, e.g. 2026-08-25T15:00:00.000Z */
    startIso: string;
    endIso: string;
    timezone: string; // IANA name, kept for display/recurrence semantics
    attendees: AttendeeInput[];
    /** When true, requests a REAL Google Meet conference (hangoutsMeet). */
    conference?: boolean;
    /** Reminder before start, in minutes (Google caps popup/email at 40320/1 week). */
    reminderMinutes?: number | null;
    /** "none" (we send our own invites) or "all" (Google emails its native invites). */
    sendUpdates?: "none" | "all";
  }
): Promise<GoogleEventResult & { hangoutLink: string | null }> {
  const authClient = getGoogleClient(accessToken);
  const calendar = google.calendar({ version: "v3", auth: authClient });
  const sendUpdates = eventData.sendUpdates ?? "none";

  const overrides: { method: "email" | "popup"; minutes: number }[] = [];
  if (eventData.reminderMinutes != null) {
    // Google allows max 5 overrides; email + popup cover Gmail & Calendar UIs.
    overrides.push({ method: "email", minutes: eventData.reminderMinutes });
    overrides.push({ method: "popup", minutes: eventData.reminderMinutes });
  }

  const response = await calendar.events.insert({
    calendarId: "primary",
    sendUpdates,
    // Required so the createRequest below actually provisions a Meet room.
    conferenceDataVersion: eventData.conference ? 1 : 0,
    requestBody: {
      summary: eventData.summary,
      description: eventData.description,
      location: eventData.location,
      start: { dateTime: eventData.startIso, timeZone: eventData.timezone },
      end: { dateTime: eventData.endIso, timeZone: eventData.timezone },
      attendees: eventData.attendees.map((a) => ({
        email: a.email,
        displayName: a.name,
      })),
      reminders:
        overrides.length > 0
          ? { useDefault: false, overrides }
          : { useDefault: true },
      ...(eventData.conference
        ? {
            conferenceData: {
              createRequest: {
                // Arbitrary id echoed back by Google; must be unique per event attempt.
                requestId: `wiggli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                conferenceSolutionKey: { type: "hangoutsMeet" },
              },
            },
          }
        : {}),
    },
  });

  const data = response.data;
  if (!data.id || !data.iCalUID) {
    throw new Error("Google Calendar did not return an event id / iCalUID");
  }

  // The provisioned Meet URL lives in conferenceData.entryPoints[0].uri
  // (and mirrored at data.hangoutLink once available).
  const entryPoints = data.conferenceData?.entryPoints ?? [];
  const videoEntry = entryPoints.find((ep) => ep.entryPointType === "video");
  const hangoutLink = data.hangoutLink ?? videoEntry?.uri ?? null;

  return {
    id: data.id,
    iCalUID: data.iCalUID,
    htmlLink: data.htmlLink ?? null,
    hangoutLink,
  };
}

export type GoogleAttendeeStatus = {
  email: string;
  rsvp: "NEEDS_ACTION" | "ACCEPTED" | "TENTATIVE" | "DECLINED";
  comment: string | null;
  respondedAt: string | null;
};

/** Small, serializable subset of a Google Calendar event used by the sync layer. */
export type GoogleCalendarEventRecord = {
  id: string;
  iCalUID?: string | null;
  status?: string | null;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  hangoutLink?: string | null;
  htmlLink?: string | null;
  start?: { dateTime?: string | null; date?: string | null; timeZone?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null; timeZone?: string | null } | null;
  organizer?: { email?: string | null; displayName?: string | null } | null;
  attendees?: { email?: string | null; displayName?: string | null; responseStatus?: string | null; comment?: string | null }[] | null;
  reminders?: { useDefault?: boolean | null; overrides?: { method?: string | null; minutes?: number | null }[] | null } | null;
  conferenceData?: { entryPoints?: { entryPointType?: string | null; uri?: string | null }[] | null } | null;
};

export type GoogleCalendarListOptions = {
  /** Optional bounds; omitted bounds let Google return the complete primary calendar. */
  timeMin?: Date;
  timeMax?: Date;
  timeZone?: string;
  /** Only events modified after this instant (incremental sync; includes deletions with showDeleted). */
  updatedMin?: Date;
};

/** List the organizer's primary-calendar events, including expanded recurring instances. */
export async function listGoogleCalendarEvents(
  accessToken: string,
  options: GoogleCalendarListOptions = {}
): Promise<GoogleCalendarEventRecord[]> {
  return listGoogleCalendarEventsWithClient(getGoogleClient(accessToken), options);
}

/** Same operation for a client obtained through withFreshGoogleClient (including refresh fallback). */
export async function listGoogleCalendarEventsWithClient(
  authClient: ReturnType<typeof getGoogleClient>,
  options: GoogleCalendarListOptions = {}
): Promise<GoogleCalendarEventRecord[]> {
  const calendar = google.calendar({ version: "v3", auth: authClient });
  const result: GoogleCalendarEventRecord[] = [];
  let pageToken: string | undefined;

  do {
    const response = await calendar.events.list({
      calendarId: "primary",
      maxResults: 2500,
      orderBy: "startTime",
      showDeleted: true,
      singleEvents: true,
      ...(options.timeMin ? { timeMin: options.timeMin.toISOString() } : {}),
      ...(options.timeMax ? { timeMax: options.timeMax.toISOString() } : {}),
      ...(options.timeZone ? { timeZone: options.timeZone } : {}),
      ...(options.updatedMin ? { updatedMin: options.updatedMin.toISOString() } : {}),
      ...(pageToken ? { pageToken } : {}),
    });
    result.push(...((response.data.items ?? []) as GoogleCalendarEventRecord[]).filter((event) => Boolean(event.id)));
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return result;
}

/** Fetch one event by its Google id for a single-event refresh. */
export async function getGoogleCalendarEventWithClient(
  authClient: ReturnType<typeof getGoogleClient>,
  googleEventId: string
): Promise<GoogleCalendarEventRecord> {
  const calendar = google.calendar({ version: "v3", auth: authClient });
  const response = await calendar.events.get({ calendarId: "primary", eventId: googleEventId });
  return response.data as GoogleCalendarEventRecord;
}

/**
 * Cancel (delete) an event on the organizer's primary calendar.
 * Per Google docs, events.delete with sendUpdates:"all" emails every guest a
 * cancellation notice — Google Calendar guests see the event removed/declined
 * as cancelled, external guests receive a METHOD:CANCEL email that removes
 * their copy. On the organizer's calendar the event remains with status
 * "cancelled" (greyed out in the UI).
 */
export async function cancelGoogleEvent(
  accessToken: string,
  googleEventId: string,
  sendUpdates: "all" | "externalOnly" | "none" = "all"
): Promise<void> {
  const authClient = getGoogleClient(accessToken);
  const calendar = google.calendar({ version: "v3", auth: authClient });
  await calendar.events.delete({
    calendarId: "primary",
    eventId: googleEventId,
    sendUpdates,
  });
}

/** Pull authoritative RSVP statuses straight from the Google event. */
export async function fetchEventRsvp(
  accessToken: string,
  googleEventId: string
): Promise<GoogleAttendeeStatus[]> {
  const authClient = getGoogleClient(accessToken);
  const calendar = google.calendar({ version: "v3", auth: authClient });

  const response = await calendar.events.get({
    calendarId: "primary",
    eventId: googleEventId,
  });

  return (response.data.attendees ?? [])
    .filter((a): a is { email: string; responseStatus?: string; comment?: string | null } => Boolean(a.email))
    .map((a) => ({
      email: a.email.toLowerCase(),
      rsvp: normalizeRsvp(a.responseStatus),
      comment: a.comment?.trim() || null,
      respondedAt: null,
    }));
}

function normalizeRsvp(status?: string): GoogleAttendeeStatus["rsvp"] {
  switch (status) {
    case "accepted":
      return "ACCEPTED";
    case "tentative":
      return "TENTATIVE";
    case "declined":
      return "DECLINED";
    default:
      return "NEEDS_ACTION";
  }
}
