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
  comment: string | null;
};

export type ProposalDto = {
  id: string;
  attendeeEmail: string;
  slotLabel: string;
  note: string | null;
  status: "PENDING" | "ACCEPTED" | "DISMISSED";
  createdAt: string;
};

export type EventPreviewData = {
  organizerName?: string;
  organizerAvatar?: string;
  attendeeAvatars?: Record<string, string>;
  linkedTo?: { type: string; label: string; avatar?: string }[];
  locations?: { label: string; type?: string }[];
  meetingLinks?: { provider: string; url: string }[];
  /** AI Notetaker enabled — the Wiggli bot joins to record and take notes. */
  aiNotetaker?: boolean;
};

export type EventDto = {
  id: string;
  googleEventId: string | null;
  source: "WIGGLI" | "GOOGLE";
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
  previewData: EventPreviewData | null;
  status: "SCHEDULED" | "CANCELLED";
  createdAt: string;
  attendees: AttendeeDto[];
  proposals: ProposalDto[];
};
