export type RsvpStatus = "NEEDS_ACTION" | "ACCEPTED" | "TENTATIVE" | "DECLINED";

export type AttendeeInput = {
  name?: string;
  email: string;
  /** Drawer attendee type — selects which AI invite template to send. */
  type?: string;
};

/** Payload posted by /dashboard/create. */
export type CreateEventInput = {
  summary: string;
  description?: string;
  location?: string;
  start: string; // ISO datetime
  end: string; // ISO datetime
  timezone: string; // IANA, e.g. Europe/Paris
  attendees: AttendeeInput[];
  emailSubject?: string;
  emailHtml?: string; // custom branded body (overrides default template)
};
export type AttendeeDto = {
  id: string;
  email: string;
  name: string | null;
  type: string | null;
  rsvp: RsvpStatus;
  respondedAt: string | null;
};

export type EventDto = {
  id: string;
  googleEventId: string | null;
  iCalUID: string;
  summary: string;
  eventType: string | null;
  description: string | null;
  location: string | null;
  hangoutLink: string | null;
  reminderMinutes: number | null;
  start: string;
  end: string;
  timezone: string;
  organizerEmail: string;
  createdAt: string;
  attendees: AttendeeDto[];
};
