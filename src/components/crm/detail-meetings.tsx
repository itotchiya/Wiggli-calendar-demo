"use client";

import { CalendarClock, CalendarPlus, ChevronDown, ExternalLink, MoreHorizontal, Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { CalendarEventItem as EventItem } from "@/lib/calendar-types";
import type { TimedDate } from "@/components/event-drawer";
import { EventPreviewDialog } from "@/components/event-preview";
import type { PreviewAttendee } from "./attendee-pill";
import { OrganizationChain } from "./organization-chain";
import styles from "./detail-meetings.module.css";

const attendeeNameFallback = (name: string) => `${name.toLowerCase().replace(/\s+/g, ".")}@demo.local`;

type MeetingMeta = {
  description?: string;
  attendees?: { name: string; type?: string; avatar?: string }[];
  reminderLabel?: string;
  organization?: { name: string } | null;
  linkedContext?: { title: string; organization?: string } | null;
  location?: {
    open: boolean;
    type: "company" | "custom" | "online";
    office: string;
    provider?: string;
    custom: { street: string; number: string; city: string; zip: string; country: string; query: string };
    manualUrl?: string;
  } | null;
  eventType?: string;
};

export type MeetingTableAttendee = { name: string; type?: string; avatar?: string };

export type DetailMeeting = {
  id: string;
  title: string;
  eventType: string;
  date: string;
  start: string;
  end: string;
  linkedContext: string;
  organization: string;
  attendees: (MeetingTableAttendee | string)[];
  description: string;
  reminder: string;
  locationType: string;
  location: string;
  meetingLink: string;
  createdAt: number;
};

const providerLabels: Record<string, string> = {
  wiggli: "Wiggli Meet",
  google: "Google Meet",
  teams: "Microsoft Teams",
  zoom: "Zoom",
  manual: "Online meeting",
};

const providerLinks: Record<string, string> = {
  wiggli: "https://meet.wiggli.com/event/axelle-bastin-71574286025",
  google: "https://meet.google.com/wig-gli-demo",
  teams: "https://teams.microsoft.com/l/meetup-join/wiggli-demo",
  zoom: "https://zoom.us/j/71574286025",
};

const meetingColumns = ["Meeting", "Type", "Status", "Job / opportunity", "Organization", "Organizer", "Attendee(s)", "Date", "Start time", "End time", "Duration", "Location type", "Location", "Meeting link", "Reminder", "Description", "Created on"];

const attendeeTypeLabels: Record<string, string> = {
  candidate: "Candidate",
  freelancer: "Freelancer",
  contact: "Contact",
  internal: "Internal attendee",
};

export function MeetingAttendeeChip({ attendee }: { attendee: MeetingTableAttendee | string }) {
  const person = typeof attendee === "string" ? { name: attendee, type: "Attendee", avatar: "" } : attendee;
  const initials = person.name.split(" ").map((part) => part[0]).slice(0, 2).join("");
  const palette = ["#667eea", "#0f9b8e", "#c06c84", "#4f7c8d", "#8b6fc0", "#d97757"];
  const color = palette[person.name.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0) % palette.length];
  return (
    <span className="attendee-chip meeting-table-attendee-chip">
      <span className="attendee-avatar" style={{ background: color }}>{person.avatar ? <img src={person.avatar} alt="" /> : initials}</span>
      <span className="attendee-chip-copy"><strong>{person.name}</strong><small>{attendeeTypeLabels[person.type ?? ""] ?? person.type ?? "Attendee"}</small></span>
    </span>
  );
}

function formatLocation(location: MeetingMeta["location"]) {
  if (!location?.open) return "Not specified";
  if (location.type === "online") return providerLabels[location.provider ?? ""] ?? "Online meeting";
  if (location.type === "company") return location.office || "Company address";
  return location.custom.query || [location.custom.street, location.custom.number, location.custom.city, location.custom.country].filter(Boolean).join(" ") || "Custom location";
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatCreatedAt(value: number) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value);
}

function getDuration(start: string, end: string) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  if (minutes <= 0) return "—";
  if (minutes < 60) return `${minutes} min`;
  const remaining = minutes % 60;
  return remaining ? `${Math.floor(minutes / 60)}h ${remaining} min` : `${minutes / 60}h`;
}

function formatLocationType(location: MeetingMeta["location"]) {
  if (!location?.open) return "Not specified";
  if (location.type === "online") return "Online";
  if (location.type === "company") return "Company address";
  return "Custom location";
}

function getMeetingLink(location: MeetingMeta["location"]) {
  if (!location?.open || location.type !== "online") return "";
  if (location.provider === "manual") return location.manualUrl ?? "";
  return providerLinks[location.provider ?? ""] ?? "";
}

function buildMeetingPreview(meeting: DetailMeeting): EventItem {
  const [hour, minute] = meeting.start.split(":").map(Number);
  const [endHour, endMinute] = meeting.end.split(":").map(Number);
  return {
    id: String(meeting.id),
    googleEventId: null,
    timezone: "UTC+2",
    date: meeting.date,
    hour,
    minute,
    endHour,
    endMinute,
    title: meeting.title,
    eventType: meeting.eventType,
    description: meeting.description === "—" ? undefined : meeting.description,
    reminderLabel: meeting.reminder,
    statusLabel: "Scheduled",
    organizerName: "Axelle Bastin",
    organizerInitials: "AB",
    eventUrl: meeting.meetingLink || `https://app.wiggli.io/meetings/${meeting.id}`,
    previewAttendees: meeting.attendees.map((attendee, index) => {
      const person = typeof attendee === "string" ? { name: attendee, type: "Attendee", avatar: "" } : attendee;
      const statusPool: PreviewAttendee["status"][] = ["Pending", "Accepted", "Declined", "Tentative", "Accepted", "Accepted"];
      return {
        id: `${meeting.id}-${index}`,
        email: (typeof attendee === "string" ? attendeeNameFallback(attendee) : attendeeNameFallback(person.name)).toLowerCase(),
        name: person.name,
        role: attendeeTypeLabels[person.type ?? ""] ?? person.type ?? "Attendee",
        avatar: person.avatar || `/avatars/avatar-${((index + 5) % 24) + 1}.webp`,
        status: statusPool[index % statusPool.length],
      };
    }),
  };
}

export function useDetailMeetings(recordType: "candidate" | "contact", recordId: string) {
  const storageKey = `wiggli-meetings:${recordType}:${recordId}`;
  const [meetings, setMeetings] = useState<DetailMeeting[]>([]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      setMeetings(stored ? JSON.parse(stored) : []);
    } catch {
      setMeetings([]);
    }
  }, [storageKey]);

  const addMeetings = (title: string, occurrences: TimedDate[], meta?: MeetingMeta) => {
    const createdAt = Date.now();
    const nextMeetings = occurrences.map((occurrence, index): DetailMeeting => ({
      id: `${createdAt}-${index}`,
      title,
      eventType: meta?.eventType || "Meeting",
      date: occurrence.date,
      start: occurrence.start,
      end: occurrence.end,
      linkedContext: meta?.linkedContext?.title || "—",
      organization: meta?.organization?.name || meta?.linkedContext?.organization || "—",
      attendees: meta?.attendees?.map((attendee) => ({ name: attendee.name, type: attendee.type, avatar: attendee.avatar })) ?? [],
      description: meta?.description || "—",
      reminder: meta?.reminderLabel || "None",
      locationType: formatLocationType(meta?.location),
      location: formatLocation(meta?.location),
      meetingLink: getMeetingLink(meta?.location),
      createdAt,
    }));

    setMeetings((current) => {
      const updated = [...nextMeetings, ...current];
      window.localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  };

  return [meetings, addMeetings] as const;
}

export function DetailMeetingsPanel({ meetings, onSchedule }: { meetings: DetailMeeting[]; onSchedule: () => void }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [previewEvent, setPreviewEvent] = useState<EventItem | null>(null);
  const meetingTypes = Array.from(new Set(meetings.map((meeting) => meeting.eventType))).sort();
  const filteredMeetings = meetings.filter((meeting) => {
    const attendeeNames = meeting.attendees.map((attendee) => typeof attendee === "string" ? attendee : attendee.name).join(" ");
    const matchesSearch = `${meeting.title} ${meeting.eventType} ${meeting.linkedContext} ${meeting.organization} ${attendeeNames}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || statusFilter === "scheduled";
    const matchesType = typeFilter === "all" || meeting.eventType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  if (meetings.length === 0) {
    return (
      <section className="detail-meetings-panel detail-meetings-empty">
        <span className="detail-meetings-empty-icon"><CalendarClock size={30} strokeWidth={1.6} /></span>
        <h2>No meetings scheduled</h2>
        <p>Scheduled meetings and invitations for this record will appear here.</p>
        <button type="button" onClick={onSchedule}><CalendarPlus size={17} /> Schedule a meeting</button>
      </section>
    );
  }

  return (
    <>
    <section className="detail-meetings-panel">
      <header className="detail-meetings-header">
        <div className={styles.filters}>
          <label className={styles.search}>
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search meetings" />
          </label>
          <label className={styles.select}>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by meeting status">
              <option value="all">All statuses</option>
              <option value="scheduled">Scheduled</option>
            </select>
            <ChevronDown size={14} />
          </label>
          <label className={`${styles.select} ${styles.typeSelect}`}>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filter by meeting type">
              <option value="all">All meeting types</option>
              {meetingTypes.map((type) => <option value={type} key={type}>{type}</option>)}
            </select>
            <ChevronDown size={14} />
          </label>
        </div>
        <button type="button" onClick={onSchedule}><CalendarPlus size={17} /> Schedule a meeting</button>
      </header>
      <div className="detail-meetings-table-wrap">
        <table className="detail-meetings-table">
          <thead><tr><th className="detail-meetings-actions-col" />{meetingColumns.map((column) => <th key={column}><span>{column}</span><ChevronDown size={13} /></th>)}</tr></thead>
          <tbody>
            {filteredMeetings.map((meeting) => (
              <tr key={meeting.id} tabIndex={0} onClick={(event) => { if (!(event.target as HTMLElement).closest("button, a, input, select")) setPreviewEvent(buildMeetingPreview(meeting)); }} onKeyDown={(event) => { if (event.key === "Enter") setPreviewEvent(buildMeetingPreview(meeting)); }}>
                <td className="detail-meetings-actions-col"><button type="button" aria-label={`Actions for ${meeting.title}`}><MoreHorizontal size={16} /></button></td>
                <td><strong>{meeting.title}</strong></td>
                <td>{meeting.eventType}</td>
                <td><span className="detail-meeting-status">Scheduled</span></td>
                <td>{meeting.linkedContext}</td>
                <td className="organization-chain-cell"><OrganizationChain organization={meeting.organization} /></td>
                <td>Axelle Bastin</td>
                <td>{meeting.attendees.length > 0 ? <span className="meeting-attendee-list">{meeting.attendees.map((attendee, index) => <MeetingAttendeeChip attendee={attendee} key={`${typeof attendee === "string" ? attendee : attendee.name}-${index}`} />)}</span> : "—"}</td>
                <td>{formatDate(meeting.date)}</td>
                <td>{meeting.start}</td>
                <td>{meeting.end}</td>
                <td>{getDuration(meeting.start, meeting.end)}</td>
                <td>{meeting.locationType || "Not specified"}</td>
                <td>{meeting.location}</td>
                <td>{meeting.meetingLink ? <a className="meeting-table-link" href={meeting.meetingLink} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Open link <ExternalLink size={13} /></a> : "—"}</td>
                <td>{meeting.reminder || "None"}</td>
                <td title={meeting.description}>{meeting.description || "—"}</td>
                <td>{formatCreatedAt(meeting.createdAt)}</td>
              </tr>
            ))}
            {filteredMeetings.length === 0 && <tr><td className="detail-meetings-no-results" colSpan={18}>No meetings match your search or filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
    <EventPreviewDialog event={previewEvent} onClose={() => setPreviewEvent(null)} />
    </>
  );
}
