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
  respondedAt: string | null;
};

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
    .filter((a): a is { email: string; responseStatus?: string } => Boolean(a.email))
    .map((a) => ({
      email: a.email.toLowerCase(),
      rsvp: normalizeRsvp(a.responseStatus),
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
