export type PreviewStatus = "Pending" | "Accepted" | "Declined" | "Tentative";

export type CalendarAttendee = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  status: PreviewStatus;
};

export type CalendarEventItem = {
  id: string;
  googleEventId: string | null;
  date: string;
  hour: number;
  minute: number;
  endHour: number;
  endMinute: number;
  title: string;
  description?: string;
  location?: string;
  timezone: string;
  organizerName: string;
  organizerInitials: string;
  eventType?: string;
  statusLabel?: string;
  reminderLabel?: string;
  eventUrl?: string;
  previewAttendees: CalendarAttendee[];
  /** Pending "Propose a new time" counter-proposals (from Gmail notifications). */
  proposals?: { id: string; attendeeEmail: string; slotLabel: string; note: string | null; createdAt: string }[];
};
