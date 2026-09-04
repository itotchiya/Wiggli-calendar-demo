"use client";
import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronDown, MoreHorizontal, Video, MapPin, Building2, Link2, ExternalLink, Copy, Check, Target, BriefcaseBusiness, Search, ListFilter, Columns3, Download, CalendarPlus } from "lucide-react";
import { EventPreviewDialog } from "./event-preview";
import type { CalendarEventItem } from "@/lib/calendar-types";
import { normalizeEventType } from "@/lib/event-types";

type LinkedOrg = { id: string; name: string; initials: string; color: string; parent?: { name: string; initials: string; color: string } };
export type MeetingRow = {
  ref: string;
  title: string;
  date: string;
  status: "Draft" | "Scheduled" | "Overdue" | "Completed" | "Canceled";
  meetingType: string;
  organizer: { name: string; avatar: string; color: string };
  linkedCandidate?: { id: string; name: string; avatar: string };
  linkedContact?: { id: string; name: string; avatar: string };
  linkedJob?: { id: string; title: string };
  linkedOpportunity?: { id: string; title: string };
  linkedOrganization?: LinkedOrg;
  attendees: { name: string; avatar?: string; color?: string }[];
  locationType: "Online" | "Another location" | "Company address" | string;
  meetingPlace: string;
  meetingPlaceHref?: string;
  meetingPlaceProvider?: "zoom" | "google" | "wiggli" | "custom" | "company" | "teams" | "manual";
  createdOn: string;
  createdBy: { name: string; avatar: string };
  updatedOn: string;
  updatedBy: { name: string; avatar: string };
};

const mockMeetings: MeetingRow[] = [
  {
    ref: "MT-179702", title: "Random Candidate Interview", date: "14 Apr 2026, 09:15 - 09:45", status: "Draft", meetingType: "Meeting",
    organizer: { name: "Maya Thornton", avatar: "/avatars/avatar-1.webp", color: "#667eea" },
    linkedCandidate: { id: "89949590", name: "Ethan Patel", avatar: "/avatars/avatar-2.webp" },
    linkedJob: { id: "1597", title: "Frontend Developer 4" },
    linkedOpportunity: { id: "2401", title: "2401 - VP of Global Equity" },
    linkedOrganization: { id: "gm", name: "Cheverolet", initials: "CH", color: "#38bdf8", parent: { name: "General Motors", initials: "GM", color: "#dc2626" } },
    attendees: [{ name: "Ethan Patel", avatar: "/avatars/avatar-2.webp" }, { name: "Maya Thornton", avatar: "/avatars/avatar-1.webp" }],
    locationType: "Online", meetingPlace: "https://zoom.us/j/123456789", meetingPlaceHref: "https://zoom.us/j/123456789", meetingPlaceProvider: "zoom",
    createdOn: "Oct 22, 2027", createdBy: { name: "Maya Thornton", avatar: "/avatars/avatar-1.webp" }, updatedOn: "Oct 22, 2027", updatedBy: { name: "Maya Thornton", avatar: "/avatars/avatar-1.webp" }
  },
  {
    ref: "MT-179703", title: "ICT Meeting", date: "03 Nov 2024, 14:00 - 14:30", status: "Scheduled", meetingType: "Call",
    organizer: { name: "Isla Montgomery", avatar: "/avatars/avatar-3.webp", color: "#4f7c8d" },
    linkedCandidate: { id: "89949589", name: "robert D", avatar: "/avatars/avatar-2.webp" },
    linkedContact: { id: "james-whitaker", name: "James Whitaker", avatar: "/avatars/avatar-4.webp" },
    linkedJob: { id: "1597", title: "Frontend Developer 4" },
    linkedOrganization: { id: "gm", name: "General Motors", initials: "GM", color: "#dc2626" },
    attendees: [{ name: "Isla Montgomery", avatar: "/avatars/avatar-3.webp" }, { name: "James Whitaker" }],
    locationType: "Another location", meetingPlace: "Antwerp Branch — 78 Meirstraat, 2000 Antwerp", meetingPlaceProvider: "company",
    createdOn: "Jul 19, 2028", createdBy: { name: "Isla Montgomery", avatar: "/avatars/avatar-3.webp" }, updatedOn: "Jul 19, 2028", updatedBy: { name: "Isla Montgomery", avatar: "/avatars/avatar-3.webp" }
  },
  {
    ref: "MT-179704", title: "McLaren Interview", date: "22 Aug 2025, 16:45 - 17:15", status: "Overdue", meetingType: "Meeting",
    organizer: { name: "Liam Harper", avatar: "/avatars/avatar-5.webp", color: "#c06c84" },
    linkedContact: { id: "james-whitaker", name: "James Whitaker", avatar: "/avatars/avatar-4.webp" },
    linkedJob: { id: "1597", title: "Frontend Developer 4" },
    attendees: [{ name: "Liam Harper", avatar: "/avatars/avatar-5.webp" }, { name: "James Whitaker" }, { name: "Ava Thompson", avatar: "/avatars/avatar-4.webp" }],
    locationType: "Online", meetingPlace: "https://meet.google.com/abc-defg-hij", meetingPlaceHref: "https://meet.google.com/abc-defg-hij", meetingPlaceProvider: "google",
    createdOn: "Feb 6, 2029", createdBy: { name: "Liam Harper", avatar: "/avatars/avatar-5.webp" }, updatedOn: "Feb 6, 2029", updatedBy: { name: "Liam Harper", avatar: "/avatars/avatar-5.webp" }
  },
  {
    ref: "MT-179705", title: "Marketing Discussion", date: "09 Jan 2026, 11:30 - 12:00", status: "Completed", meetingType: "Meeting",
    organizer: { name: "Maya Thornton", avatar: "/avatars/avatar-1.webp", color: "#667eea" },
    linkedCandidate: { id: "89949590", name: "serena El Amrani", avatar: "/avatars/avatar-2.webp" },
    linkedContact: { id: "james-whitaker", name: "James Whitaker", avatar: "/avatars/avatar-4.webp" },
    linkedJob: { id: "1628", title: "r&d chimistry" },
    linkedOrganization: { id: "gm", name: "General Motors", initials: "GM", color: "#dc2626" },
    attendees: [{ name: "Maya Thornton", avatar: "/avatars/avatar-1.webp" }, { name: "serena El Amrani", avatar: "/avatars/avatar-2.webp" }, { name: "James Whitaker" }, { name: "Liam Harper", avatar: "/avatars/avatar-5.webp" }, { name: "Sofia Morales", avatar: "/avatars/avatar-6.webp" }],
    locationType: "Company address", meetingPlace: "Brussels Office — 45 Avenue Louise, 1050 Brussels", meetingPlaceProvider: "company",
    createdOn: "Dec 11, 2024", createdBy: { name: "Maya Thornton", avatar: "/avatars/avatar-1.webp" }, updatedOn: "Dec 11, 2024", updatedBy: { name: "Maya Thornton", avatar: "/avatars/avatar-1.webp" }
  },
  {
    ref: "MT-179706", title: "Marketing Interview", date: "18 Jul 2024, 08:00 - 08:30", status: "Canceled", meetingType: "Job intake",
    organizer: { name: "Noah Sterling", avatar: "/avatars/avatar-6.webp", color: "#d97757" },
    linkedJob: { id: "1628", title: "r&d chimistry" },
    attendees: [{ name: "Sofia Morales", avatar: "/avatars/avatar-6.webp" }, { name: "Noah Sterling", avatar: "/avatars/avatar-7.webp" }, { name: "Ava Thompson", avatar: "/avatars/avatar-4.webp" }],
    locationType: "Online", meetingPlace: "https://app.wiggli.io/events/xyz123abc", meetingPlaceHref: "https://app.wiggli.io/events/xyz123abc", meetingPlaceProvider: "wiggli",
    createdOn: "Nov 30, 2023", createdBy: { name: "Noah Sterling", avatar: "/avatars/avatar-6.webp" }, updatedOn: "Nov 30, 2023", updatedBy: { name: "Noah Sterling", avatar: "/avatars/avatar-6.webp" }
  },
  {
    ref: "MT-179707", title: "Marketing Meeting", date: "05 Dec 2025, 13:20 - 13:50", status: "Canceled", meetingType: "Interview",
    organizer: { name: "Maya Thornton", avatar: "/avatars/avatar-1.webp", color: "#667eea" },
    linkedContact: { id: "james-whitaker", name: "James Whitaker", avatar: "/avatars/avatar-4.webp" },
    linkedOpportunity: { id: "2401", title: "2401 - VP of Global Equity" },
    linkedOrganization: { id: "gm", name: "Cheverolet", initials: "CH", color: "#38bdf8", parent: { name: "General Motors", initials: "GM", color: "#dc2626" } },
    attendees: [{ name: "Ethan Patel", avatar: "/avatars/avatar-2.webp" }, { name: "James Whitaker" }],
    locationType: "Online", meetingPlace: "https://teams.microsoft.com/l/meetup-join/demo123", meetingPlaceHref: "https://teams.microsoft.com/l/meetup-join/demo123", meetingPlaceProvider: "teams",
    createdOn: "Mar 3, 2025", createdBy: { name: "Maya Thornton", avatar: "/avatars/avatar-1.webp" }, updatedOn: "Mar 3, 2025", updatedBy: { name: "Maya Thornton", avatar: "/avatars/avatar-1.webp" }
  },
  {
    ref: "MT-179708", title: "GTM engineer goal", date: "19 Jul 2024, 08:00 - 08:30", status: "Scheduled", meetingType: "Job intake",
    organizer: { name: "Noah Sterling", avatar: "/avatars/avatar-6.webp", color: "#d97757" },
    linkedOpportunity: { id: "gtm", title: "GTM Engineer opportunity" },
    attendees: [{ name: "Noah Sterling", avatar: "/avatars/avatar-7.webp" }],
    locationType: "", meetingPlace: "", meetingPlaceProvider: undefined,
    createdOn: "Nov 30, 2023", createdBy: { name: "Noah Sterling", avatar: "/avatars/avatar-6.webp" }, updatedOn: "Nov 30, 2023", updatedBy: { name: "Noah Sterling", avatar: "/avatars/avatar-6.webp" }
  },
];

export function StatusPill({ status }: { status: MeetingRow["status"] | string }) {
  const styles: Record<string, React.CSSProperties> = {
    Draft: { border: "1px solid #94a3b8", color: "#475569", background: "#fff" },
    Scheduled: { border: "1px solid #2563eb", color: "#2563eb", background: "#fff" },
    Overdue: { border: "1px solid #dc2626", color: "#dc2626", background: "#fff" },
    Completed: { border: "1px solid #15803d", color: "#15803d", background: "#fff" },
    Canceled: { border: "1px solid #dc2626", color: "#dc2626", background: "#fff" },
  };
  return <span style={{ ...styles[status], padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", display: "inline-flex" }}>{status}</span>;
}

function Avatar({ name, avatar, size = 32 }: { name: string; avatar?: string; size?: number }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const color = ["#667eea", "#0f766e", "#c06c84", "#4f7c8d", "#8b6fc0", "#d97757"][name.charCodeAt(0) % 6];
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", background: color, color: "#fff", display: "grid", placeItems: "center", fontSize: size * 0.38, fontWeight: 400, flex: "none", overflow: "hidden", border: "1px solid #e2e8f0" }}>
      {avatar ? <img src={avatar} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
    </span>
  );
}

export function MeetingPlaceIcon({ provider }: { provider?: string }) {
  const logos: Record<string, string> = {
    wiggli: "/wiggli-meet.png",
    google: "/google-meet.png",
    teams: "/microsoft-teams.png",
    zoom: "/Zoom-logo.png",
  };
  if (provider && logos[provider]) {
    return <span style={{ width: 32, height: 32, borderRadius: 6, background: "#fff", display: "grid", placeItems: "center", flex: "none", overflow: "hidden" }}><img src={logos[provider]} alt={provider} style={{ width: 22, height: 22, objectFit: "contain" }} /></span>;
  }
  if (provider === "custom" || provider === "manual") return <span style={{ width: 32, height: 32, borderRadius: 6, background: "#f1f5f9", display: "grid", placeItems: "center", color: "#64748b", flex: "none" }}><Link2 size={14} /></span>;
  return null;
}

function buildMeetingPreview(row: MeetingRow): CalendarEventItem {
  // parse "14 Apr 2026, 09:15 - 09:45"
  let year = "2026", month = "04", day = "14", hour = 9, minute = 15, endHour = 9, endMinute = 45;
  try {
    const parts = row.date.split(", ");
    if (parts.length === 2) {
      const dTokens = parts[0].trim().split(" ");
      if (dTokens.length === 3) {
        day = dTokens[0].padStart(2, "0");
        const monMap: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
        month = monMap[dTokens[1]] ?? "01";
        year = dTokens[2];
      }
      const times = parts[1].trim().split(" - ");
      if (times.length === 2) {
        const [sh, sm] = times[0].split(":").map(Number);
        const [eh, em] = times[1].split(":").map(Number);
        if (!Number.isNaN(sh)) hour = sh;
        if (!Number.isNaN(sm)) minute = sm;
        if (!Number.isNaN(eh)) endHour = eh;
        if (!Number.isNaN(em)) endMinute = em;
      }
    }
  } catch { /* keep defaults */ }
  const dateKey = `${year}-${month}-${day}`;
  const statusToAttendee: Record<string, "Pending" | "Accepted" | "Declined" | "Tentative"> = { Draft: "Pending", Scheduled: "Pending", Overdue: "Pending", Completed: "Accepted", Canceled: "Declined" };
  const statusPool: ("Pending" | "Accepted" | "Declined" | "Tentative")[] = ["Pending", "Accepted", "Declined", "Tentative", "Accepted", "Accepted"];
  const statusFor = (index: number) => statusPool[index % statusPool.length];
  const firstStatus = statusToAttendee[row.status] ?? "Pending";
  const avatarFor = (name: string, existing?: string) => {
    if (existing) return existing;
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    const n = (h % 24) + 1;
    return `/avatars/avatar-${n}.webp`;
  };
  const attendeesForPreview = (row.attendees || []).map((a, attIdx) => ({
    id: `${row.ref}-${attIdx}`,
    name: a.name,
    email: "",
    role: a.name === row.organizer?.name ? "Organizer" : "Attendee",
    avatar: avatarFor(a.name, a.avatar),
    status: statusFor(attIdx),
  }));
  if (row.organizer && !attendeesForPreview.some((a) => a.name === row.organizer.name)) {
    attendeesForPreview.unshift({ id: `${row.ref}-org`, name: row.organizer.name, email: "", role: "Organizer", avatar: avatarFor(row.organizer.name, row.organizer.avatar), status: firstStatus });
  }
  const descParts = [];
  if (row.meetingType) descParts.push(row.meetingType);
  if (row.linkedJob?.title) descParts.push(`for ${row.linkedJob.title}`);
  if (row.linkedOrganization?.name) descParts.push(`at ${row.linkedOrganization.name}`);
  if (row.meetingPlace) descParts.push(`Location: ${row.meetingPlace}`);
  const linkedTo: { type: string; label: string; avatar?: string }[] = [];
  if (row.linkedCandidate) linkedTo.push({ type: "Candidate", label: row.linkedCandidate.name, avatar: row.linkedCandidate.avatar });
  if (row.linkedContact) linkedTo.push({ type: "Contact", label: row.linkedContact.name, avatar: row.linkedContact.avatar });
  if (row.linkedOrganization) linkedTo.push({ type: "Organization", label: row.linkedOrganization.name });
  if (row.linkedJob) linkedTo.push({ type: "Job", label: row.linkedJob.title });
  if (row.linkedOpportunity) linkedTo.push({ type: "Opportunity", label: row.linkedOpportunity.title });
  return {
    id: `preview-${row.ref}`,
    googleEventId: null,
    source: "WIGGLI",
    date: dateKey,
    hour,
    minute,
    endHour,
    endMinute,
    title: row.title,
    eventType: normalizeEventType(row.meetingType),
    description: descParts.join(" ") || `${normalizeEventType(row.meetingType)} meeting`,
    reminderLabel: "15 minutes",
    statusLabel: row.status,
    organizerName: row.organizer?.name ?? "Axelle Bastin",
    organizerInitials: (row.organizer?.name ?? "AB").split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase(),
    eventUrl: row.meetingPlaceHref || row.meetingPlace || undefined,
    linkedTo,
    previewAttendees: attendeesForPreview,
    timezone: "Europe/Brussels",
  };
}

export function LocationTypeCell({ type }: { type: string }) {
  if (!type || type === "—") return <span style={{ color: "#cbd5e1" }}>—</span>;
  const icon = type === "Online" ? <Video size={14} style={{ color: "#475569" }} /> : type === "Another location" ? <MapPin size={14} style={{ color: "#475569" }} /> : <Building2 size={14} style={{ color: "#475569" }} />;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>{icon} {type}</span>;
}

export function MeetingsTable({ filterEntity, filterId, filterName, extraMeetings = [], onScheduleMeeting, rows: providedRows }: { filterEntity?: "candidate" | "contact" | "job" | "organization" | "opportunity"; filterId?: string; filterName?: string; extraMeetings?: any[]; onScheduleMeeting?: () => void; rows?: MeetingRow[] }) {
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const [hoverAttendee, setHoverAttendee] = useState<string | null>(null);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const [query, setQuery] = useState("");
  const [previewEvent, setPreviewEvent] = useState<CalendarEventItem | null>(null);
  const openPreview = (row: MeetingRow) => setPreviewEvent(buildMeetingPreview(row));

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  };

  const rows = useMemo(() => {
    if (providedRows) return providedRows;
    return mockMeetings.map((m) => {
      if (!filterEntity || !filterId) return m;
      const clone = { ...m };
      if (filterEntity === "candidate" && filterName) clone.linkedCandidate = { id: filterId, name: filterName, avatar: "" };
      if (filterEntity === "contact" && filterName) clone.linkedContact = { id: filterId, name: filterName, avatar: "" };
      if (filterEntity === "job" && filterName) clone.linkedJob = { id: filterId, title: filterName };
      if (filterEntity === "opportunity" && filterName) clone.linkedOpportunity = { id: filterId, title: filterName };
      if (filterEntity === "organization" && filterName) clone.linkedOrganization = { id: filterId, name: filterName, initials: filterName.slice(0, 2).toUpperCase(), color: "#0f766e" };
      return clone;
    });
  }, [filterEntity, filterId, filterName, providedRows]);

  const allRows = useMemo(() => [...extraMeetings.map((e: any, i: number) => ({
    ref: `MT-${String(900000 + i).slice(-6)}`,
    title: e.title || "New Meeting",
    date: e.date || `${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}, ${e.start ?? ""} - ${e.end ?? ""}`,
    status: "Scheduled" as const,
    meetingType: normalizeEventType(e.eventType),
    organizer: { name: e.organizerName || "Axelle Bastin", avatar: "", color: "#0f766e" },
    linkedCandidate: e.linkedCandidate,
    linkedContact: e.linkedContact,
    linkedJob: e.linkedJob,
    linkedOpportunity: e.linkedOpportunity,
    linkedOrganization: e.linkedOrganization,
    attendees: e.attendees || [{ name: "Axelle Bastin" }],
    locationType: e.locationType || "Online",
    meetingPlace: e.meetingPlace || e.meetingLink || "",
    meetingPlaceHref: e.meetingLink,
    meetingPlaceProvider: e.provider || "wiggli",
    createdOn: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    createdBy: { name: "Axelle Bastin", avatar: "" },
    updatedOn: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    updatedBy: { name: "Axelle Bastin", avatar: "" },
  })), ...rows], [extraMeetings, rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((row) => {
      const hay = [
        row.ref, row.title, row.date, row.status, normalizeEventType(row.meetingType),
        row.organizer?.name, row.linkedCandidate?.name, row.linkedContact?.name,
        row.linkedJob?.title, row.linkedOpportunity?.title, row.linkedOrganization?.name,
        row.linkedOrganization?.parent?.name, row.attendees?.map((a: any) => a.name).join(" "),
        row.locationType, row.meetingPlace, row.createdOn, row.createdBy?.name, row.updatedOn, row.updatedBy?.name,
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [allRows, query]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16, width: "100%", minWidth: 0, overflow: "hidden" }}>
      <div className="jobs-toolbar" style={{ marginTop: 0, padding: "0 2px", width: "100%", minWidth: 0, flexShrink: 0 }}>
        <label className="jobs-search">
          <input type="text" placeholder="Search in (Ref, Title, Meeting type, Organizer...)" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Search size={16} />
        </label>
        <button className="jobs-filters-button" type="button"><ListFilter size={16} /> Filter</button>
        <div className="jobs-toolbar-right">
          <button className="icon-button" aria-label="Download" type="button"><Download size={16} /></button>
          <button className="jobs-columns-button" type="button"><Columns3 size={16} /> Columns <ChevronDown size={14} /></button>
          {onScheduleMeeting && <button type="button" onClick={() => onScheduleMeeting?.()} style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", background: "#fff", color: "#0f766e", border: "1px solid #0f766e", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}><CalendarPlus size={16} style={{ color: "#0f766e" }} /> Schedule meeting</button>}
        </div>
      </div>
      <div className="jobs-table-wrap" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "auto", width: "100%", minWidth: 0, maxWidth: "100%" }}>
        <style>{`.jobs-table.meetings-table td { max-width: none !important; white-space: nowrap; } .jobs-table.meetings-table th { white-space: nowrap; }`}</style>
        <table className="jobs-table meetings-table" style={{ minWidth: "max-content" }}>
          <thead>
            <tr>
              <th className="jobs-table-menu-col" style={{ width: 80, minWidth: 80, maxWidth: 80 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><input type="checkbox" aria-label="Select all" style={{ width: 16, height: 16, accentColor: "#0f766e" }} /></div></th>
              <th><span>Ref</span><ChevronDown size={13} /></th>
              <th><span>Title</span><ChevronDown size={13} /></th>
              <th><span>Meeting date & time</span><ChevronDown size={13} /></th>
              <th><span>Status</span><ChevronDown size={13} /></th>
              <th><span>Meeting type</span><ChevronDown size={13} /></th>
              <th><span>Organizer</span><ChevronDown size={13} /></th>
              <th><span>Linked to candidate</span><ChevronDown size={13} /></th>
              <th><span>Linked to contact</span><ChevronDown size={13} /></th>
              <th><span>Linked to job</span><ChevronDown size={13} /></th>
              <th><span>Linked to opportunity</span><ChevronDown size={13} /></th>
              <th><span>Linked to organization</span><ChevronDown size={13} /></th>
              <th><span>Attendees</span><ChevronDown size={13} /></th>
              <th><span>Location type</span><ChevronDown size={13} /></th>
              <th><span>Meeting place</span><ChevronDown size={13} /></th>
              <th><span>Created on</span><ChevronDown size={13} /></th>
              <th><span>Created by</span><ChevronDown size={13} /></th>
              <th><span>Updated on</span><ChevronDown size={13} /></th>
              <th><span>Updated by</span><ChevronDown size={13} /></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan={19} style={{ textAlign: "center", padding: "32px 16px", color: "#64748b", fontSize: 13 }}>No meetings found{query ? ` for "${query}"` : ""}</td></tr>
            ) : filteredRows.map((row) => (
              <tr key={row.ref} tabIndex={0} onClick={(e) => { if (!(e.target as HTMLElement).closest("input, button, a")) openPreview(row); }} onKeyDown={(e) => { if (e.key === "Enter") openPreview(row); }} style={{ cursor: "pointer" }}>
                <td className="jobs-table-menu-col" onClick={(e) => e.stopPropagation()} style={{ width: 80, minWidth: 80, maxWidth: 80 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><input type="checkbox" style={{ width: 16, height: 16, accentColor: "#0f766e" }} /><button aria-label="row" style={{ border: 0, background: "transparent", color: "#94a3b8", display: "grid", placeItems: "center", width: 24, height: 24 }}><MoreHorizontal size={16} /></button></div></td>
                <td style={{ fontWeight: 500, color: "#334155" }}>{row.ref}</td>
                <td title={row.title} style={{ maxWidth: "none", whiteSpace: "nowrap" }}>{row.title}</td>
                <td>{row.date}</td>
                <td><StatusPill status={row.status} /></td>
                <td>{normalizeEventType(row.meetingType)}</td>
                <td>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Avatar name={row.organizer.name} avatar={row.organizer.avatar} size={32} /> {row.organizer.name}
                  </span>
                </td>
                <td>
                  {row.linkedCandidate ? (
                    <span onClick={() => router.push(`/dashboard/candidates/${row.linkedCandidate!.id}`)} style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", color: "#1e293b", textDecoration: "none" }} onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")} title={row.linkedCandidate.name}>
                      <Avatar name={row.linkedCandidate.name} avatar={row.linkedCandidate.avatar} size={28} /> {row.linkedCandidate.name}
                    </span>
                  ) : <span style={{ color: "#cbd5e1" }}>—</span>}
                </td>
                <td>
                  {row.linkedContact ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }} title={row.linkedContact.name}>
                      <Avatar name={row.linkedContact.name} avatar={row.linkedContact.avatar} size={28} /> {row.linkedContact.name}
                    </span>
                  ) : <span style={{ color: "#cbd5e1" }}>—</span>}
                </td>
                <td>
                  {row.linkedJob ? (
                    <span onClick={() => router.push(`/dashboard/jobs/${row.linkedJob!.id}`)} style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", color: "#1e293b", textDecoration: "none" }} onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>
                      <Target size={14} style={{ color: "#0f766e", flex: "none" }} /> <span style={{ whiteSpace: "nowrap" }}>{row.linkedJob.title}</span>
                    </span>
                  ) : <span style={{ color: "#cbd5e1" }}>—</span>}
                </td>
                <td>
                  {row.linkedOpportunity ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <BriefcaseBusiness size={14} style={{ color: "#0f766e", flex: "none" }} /> <span style={{ whiteSpace: "nowrap" }}>{row.linkedOpportunity.title}</span>
                    </span>
                  ) : <span style={{ color: "#cbd5e1" }}>—</span>}
                </td>
                <td>
                  {row.linkedOrganization ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={row.linkedOrganization.name}>
                      {row.linkedOrganization.parent ? (
                        <>
                          <span style={{ width: 20, height: 20, borderRadius: "50%", background: row.linkedOrganization.parent.color, color: "#fff", display: "grid", placeItems: "center", fontSize: 8, fontWeight: 700, flex: "none" }}>{row.linkedOrganization.parent.initials}</span>
                          <span style={{ color: "#64748b", fontSize: 12 }}>{row.linkedOrganization.parent.name}</span>
                          <ChevronDown size={12} style={{ transform: "rotate(-90deg)", color: "#94a3b8" }} />
                          <span style={{ width: 20, height: 20, borderRadius: "50%", background: row.linkedOrganization.color, color: "#fff", display: "grid", placeItems: "center", fontSize: 8, fontWeight: 700, flex: "none" }}>{row.linkedOrganization.initials}</span>
                          <span style={{ fontSize: 12 }}>{row.linkedOrganization.name}</span>
                        </>
                      ) : (
                        <>
                          <span style={{ width: 20, height: 20, borderRadius: "50%", background: row.linkedOrganization.color, color: "#fff", display: "grid", placeItems: "center", fontSize: 8, fontWeight: 700, flex: "none" }}>{row.linkedOrganization.initials}</span>
                          <span style={{ fontSize: 12 }}>{row.linkedOrganization.name}</span>
                        </>
                      )}
                    </span>
                  ) : <span style={{ color: "#cbd5e1" }}>—</span>}
                </td>
                <td>
                  <span style={{ display: "inline-flex", alignItems: "center" }}>
                    {row.attendees.slice(0, 5).map((a: any, idx: number) => (
                      <span
                        key={a.name + idx}
                        onMouseEnter={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setHoverRect(r); setHoverAttendee(row.ref + a.name); }}
                        onMouseLeave={() => { setHoverRect(null); setHoverAttendee(null); }}
                        style={{ marginLeft: idx === 0 ? 0 : -8, position: "relative", cursor: "pointer" }}
                        data-attendee={a.name}
                      >
                        <Avatar name={a.name} avatar={(a as any).avatar} size={32} />
                        {hoverAttendee === row.ref + a.name && hoverRect && typeof document !== "undefined" && createPortal(
                          <span style={{ position: "fixed", left: hoverRect.left + hoverRect.width / 2, top: hoverRect.top - 36, transform: "translateX(-50%)", background: "#0f172a", color: "#fff", padding: "6px 10px", borderRadius: 8, fontSize: 12, whiteSpace: "nowrap", zIndex: 50, boxShadow: "0 4px 12px rgba(0,0,0,.2)", pointerEvents: "none" }}>
                            {a.name}
                          </span>, document.body)}
                      </span>
                    ))}
                    {row.attendees.length > 5 && <span style={{ marginLeft: 4, fontSize: 12, color: "#64748b" }}>+{row.attendees.length - 5}</span>}
                  </span>
                </td>
                <td><LocationTypeCell type={row.locationType} /></td>
                <td>
                  {row.meetingPlace ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                      <MeetingPlaceIcon provider={row.meetingPlaceProvider} />
                      <a href={row.meetingPlaceHref || "#"} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#334155", textDecoration: "none", whiteSpace: "nowrap" }} title={row.meetingPlace}>
                        {row.meetingPlace}
                      </a>
                      {row.meetingPlaceHref && (
                        <>
                          <a href={row.meetingPlaceHref} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#94a3b8", display: "grid", placeItems: "center" }}><ExternalLink size={14} /></a>
                          <button onClick={(e) => { e.stopPropagation(); handleCopy(row.meetingPlace); }} style={{ border: 0, background: "transparent", color: copied === row.meetingPlace ? "#0f766e" : "#94a3b8", display: "grid", placeItems: "center", cursor: "pointer" }} aria-label="Copy">
                            {copied === row.meetingPlace ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </>
                      )}
                    </span>
                  ) : <span style={{ color: "#cbd5e1" }}>—</span>}
                </td>
                <td>{row.createdOn}</td>
                <td><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Avatar name={row.createdBy.name} avatar={row.createdBy.avatar} size={28} /> {row.createdBy.name}</span></td>
                <td>{row.updatedOn}</td>
                <td><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Avatar name={row.updatedBy.name} avatar={row.updatedBy.avatar} size={28} /> {row.updatedBy.name}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredRows.length > 0 && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px", color: "#64748b", fontSize: 12, fontWeight: 500 }}><span>{filteredRows.length} result{filteredRows.length !== 1 ? "s" : ""} {query ? `for "${query}"` : "in total"}</span></div>}
      <EventPreviewDialog event={previewEvent} onClose={() => setPreviewEvent(null)} />
    </div>
  );
}
