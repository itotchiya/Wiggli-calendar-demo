export type PreviewStatus = "Pending" | "Accepted" | "Declined" | "Tentative";

export type CalendarAttendee = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  status: PreviewStatus;
  /** Optional response comment from the calendar provider. */
  comment?: string | null;
};

export type CalendarEventItem = {
  id: string;
  googleEventId: string | null;
  source: "WIGGLI" | "GOOGLE";
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
  organizerAvatar?: string;
  eventType?: string;
  statusLabel?: "Draft" | "Logged" | "Scheduled" | "Synced" | "Completed" | "Cancelled" | string;
  /** Optional preview-only integration state used by the event dialog. */
  syncState?: "google-reconnect" | "outlook-reconnect" | "google-updated" | "google-failed";
  reminderLabel?: string;
  reminderMinutes?: number | null;
  eventUrl?: string;
  meetingLinks?: { provider: string; url: string }[];
  locations?: { label: string; type?: string }[];
  linkedTo?: { type: string; label: string; avatar?: string }[];
  /** AI Notetaker enabled — the Wiggli bot joins to record this meeting. */
  aiNotetaker?: boolean;
  previewAttendees: CalendarAttendee[];
  /** Pending "Propose a new time" counter-proposals (from Gmail notifications). */
  proposals?: { id: string; attendeeEmail: string; slotLabel: string; note: string | null; createdAt: string }[];
};
