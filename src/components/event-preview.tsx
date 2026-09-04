"use client";

import {
  AlarmClock,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Check,
  Copy,
  ExternalLink,
  Info,
  Link2,
  Loader2,
  MapPin,
  MessageCircleMore,
  MessageSquareText,
  Mic,
  PenLine,
  RefreshCw,
  Tag,
  Trash2,
  UserRound,
  UsersRound,
  Clock,
  AlertCircle,
  X,
  Building2,
  BriefcaseBusiness,
  ContactRound,
  Crosshair,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import type { CalendarAttendee, CalendarEventItem } from "@/lib/calendar-types";
import { getCalendarTime } from "@/lib/datetime-proto";
import { NotetakerBadge } from "./ui/notetaker-badge";

function PreviewAttendeeAvatar({ attendee, defaultAvatar = false }: { attendee: CalendarAttendee; defaultAvatar?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (defaultAvatar) {
    return <span className="preview-attendee-avatar preview-attendee-avatar--default" aria-hidden="true"><UserRound size={16} strokeWidth={1.8} /></span>;
  }
  const initials = attendee.name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
  const palette = ["#667eea", "#0f9b8e", "#c06c84", "#4f7c8d", "#8b6fc0", "#d97757"];
  const hash = attendee.name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  if (attendee.avatar && !failed) {
    return <Image src={attendee.avatar} alt={attendee.name} width={28} height={28} className="preview-attendee-avatar" onError={() => setFailed(true)} />;
  }
  return <span className="preview-attendee-avatar" style={{ display: "grid", placeItems: "center", background: palette[hash % palette.length], color: "#fff", fontSize: 10, fontWeight: 700 }}>{initials}</span>;
}

function PreviewOrganizerAvatar({ name, initials, avatar }: { name: string; initials: string; avatar?: string }) {
  const [failed, setFailed] = useState(false);
  if (avatar && !failed) return <Image src={avatar} alt={name} width={32} height={32} className="preview-organizer-photo" onError={() => setFailed(true)} />;
  return <span className="preview-organizer-avatar">{initials}</span>;
}

function PreviewSection({ icon, title, trailing, children }: { icon: ReactNode; title: string; trailing?: ReactNode; children: ReactNode }) {
  return <section className="preview-section"><span className="preview-meta-label">{icon} {title}{trailing}</span>{children}</section>;
}

function LinkedRecordMark({ record, kind }: { record: { type: string; label: string; avatar?: string }; kind: string }) {
  const [failed, setFailed] = useState(false);
  if (kind.includes("opportunity")) return <span className="preview-linked-icon" aria-hidden="true"><Crosshair size={18} strokeWidth={2} /></span>;
  if (kind.includes("job")) return <span className="preview-linked-icon" aria-hidden="true"><BriefcaseBusiness size={18} strokeWidth={2} /></span>;
  if (kind.includes("organization") || kind.includes("company")) {
    if (record.avatar && !failed) return <Image src={record.avatar} alt="" width={24} height={24} className="preview-linked-photo" onError={() => setFailed(true)} />;
    const initials = record.label.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "OR";
    const colors = ["#e6322a", "#0ea5a0", "#2563eb", "#7c3aed", "#c2416c"];
    const color = colors[record.label.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length];
    return <span className="preview-linked-organization-avatar" style={{ background: color }}>{initials}</span>;
  }
  const Icon = kind.includes("contact") ? ContactRound : kind.includes("candidate") ? UserRound : Building2;
  if (record.avatar && !failed) return <Image src={record.avatar} alt="" width={24} height={24} className="preview-linked-photo" onError={() => setFailed(true)} />;
  return <span className="preview-linked-avatar"><Icon size={14} /></span>;
}

function LinkedRecordRow({ record }: { record: { type: string; label: string; avatar?: string } }) {
  const kind = record.type.toLowerCase();
  const isOrganization = kind.includes("organization") || kind.includes("company");
  const isOpportunity = kind.includes("opportunity");
  const isJob = kind.includes("job");
  const showStandardType = !isOrganization && !isOpportunity && !isJob;
  return <div className="preview-linked-pill"><LinkedRecordMark record={record} kind={kind} /><span className="preview-linked-label">{record.label}</span>{showStandardType && <><span className="preview-linked-dot">•</span><span className="preview-linked-type">{record.type}</span></>}<button type="button" className="preview-external-action preview-row-external" aria-label={`Open ${record.label}`}><ExternalLink size={16} /></button></div>;
}

function AttendeeRow({ attendee, showStatus, readOnly = false }: { attendee: CalendarAttendee; showStatus: boolean; readOnly?: boolean }) {
  const comment = attendee.comment?.trim();
  return <div className="preview-attendee-row">
    <PreviewAttendeeAvatar attendee={attendee} defaultAvatar={readOnly} />
    <span className="preview-attendee-name">{attendee.name}</span>
    <span className="preview-attendee-dot">•</span>
    <span className="preview-attendee-role">{attendee.role}</span>
    {comment && <span className="preview-attendee-comment" tabIndex={0} aria-label={`Response note from ${attendee.name}`}>
      <MessageCircleMore size={22} strokeWidth={1.9} aria-hidden="true" />
      <span className="preview-attendee-comment-tooltip" role="tooltip">{comment}</span>
    </span>}
    {!readOnly && <button type="button" className="preview-external-action preview-row-external" aria-label={`Open ${attendee.name}`}><ExternalLink size={16} /></button>}
    {showStatus && <span className={statusClass[attendee.status]}>{attendee.status}</span>}
  </div>;
}

function MeetingLinkRow({ link }: { link: { provider: string; url: string } }) {
  const [copied, setCopied] = useState(false);
  const provider = link.provider.toLowerCase();
  const providerAsset = provider.includes("google") ? "/google-meet.png" : provider.includes("zoom") ? "/Zoom-logo.png" : provider.includes("teams") || provider.includes("microsoft") ? "/microsoft-teams.png" : provider.includes("wiggli") ? "/wiggli-meet.png" : null;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const input = document.createElement("textarea");
      input.value = link.url;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };
  return <div className="preview-url-row">
    <span className={`preview-link-provider ${providerAsset ? "preview-link-provider--brand" : "preview-link-provider--manual"}`} aria-hidden="true">{providerAsset ? <Image src={providerAsset} alt="" width={24} height={24} /> : <Link2 size={18} strokeWidth={1.9} />}</span>
    <span className="preview-url">{link.url}</span>
    <a href={link.url} target="_blank" rel="noreferrer" className="preview-external-action preview-url-external" aria-label={`Open ${link.provider} meeting URL`}><ExternalLink size={16} /></a>
    <button type="button" className={`preview-url-action ${copied ? "copied" : ""}`} aria-label={copied ? "Meeting URL copied" : `Copy ${link.provider} meeting URL`} onClick={() => void copyLink()}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>
  </div>;
}

function LocationRow({ location }: { location: { label: string; type?: string } }) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.label)}`;
  return <div className="preview-location-row"><span className="preview-location-label">{location.label}</span>{location.type && <><span className="preview-location-dot">•</span><span className="preview-location-type">{location.type}</span></>}<a className="preview-external-action preview-location-external" href={mapsUrl} target="_blank" rel="noreferrer" aria-label={`Open ${location.label} in Google Maps`}><ExternalLink size={16} /></a></div>;
}

const statusClass: Record<CalendarAttendee["status"], string> = {
  Pending: "att-status pending",
  Accepted: "att-status accepted",
  Declined: "att-status declined",
  Tentative: "att-status tentative",
};

function formatPreviewDate(date: string, hour: number, minute: number) {
  const parsed = new Date(`${date}T00:00:00Z`);
  const month = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(parsed).toUpperCase();
  return `${String(parsed.getUTCDate()).padStart(2, "0")} ${month} ${parsed.getUTCFullYear()}, ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatPreviewRange(date: string, hour: number, minute: number, endHour: number, endMinute: number) {
  const start = formatPreviewDate(date, hour, minute);
  const end = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
  return `${start} - ${end}`;
}

export function EventPreviewDialog({
  event: initialEvent,
  onClose,
  onRefresh,
  onDeleted,
  onReschedule,
  onSchedule,
  onEdit,
  onComplete,
  refreshing = false,
}: {
  event: CalendarEventItem | null;
  onClose: () => void;
  onRefresh?: (event: CalendarEventItem) => void;
  /** Called after the event is cancelled & deleted so lists can refresh. */
  onDeleted?: (event?: CalendarEventItem) => void;
  /** Opens the reschedule drawer for this event (declined flow). */
  onReschedule?: (event: CalendarEventItem) => void;
  /** Opens the invitation review drawer for an active draft. */
  onSchedule?: (event: CalendarEventItem) => void;
  /** Opens the reschedule/edit drawer for the event (Google-writable fields). */
  onEdit?: (event: CalendarEventItem) => void;
  /** Marks a passed event complete. The demo keeps this local for now. */
  onComplete?: (event: CalendarEventItem) => void;
  refreshing?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [expandedLinked, setExpandedLinked] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  // Local view of the event so a just-cancelled state renders instantly.
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!initialEvent) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [initialEvent, onClose]);

  useEffect(() => {
    if (!actionNotice) return;
    const timer = window.setTimeout(() => setActionNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [actionNotice]);

  if (!initialEvent) return null;

  const isGoogleEvent = initialEvent.source === "GOOGLE";
  const isCompleted = !isGoogleEvent && (completedIds.has(initialEvent.id) || initialEvent.statusLabel === "Completed");
  const isCancelled =
    initialEvent.statusLabel === "Cancelled" ||
    cancelledIds.has(initialEvent.id) ||
    initialEvent.id.startsWith("preview") === false && (initialEvent as { status?: string }).status === "CANCELLED";
  const eventNow = getCalendarTime(initialEvent.timezone);
  const hasPassed = initialEvent.date < eventNow.date || (initialEvent.date === eventNow.date && initialEvent.endHour * 60 + initialEvent.endMinute <= eventNow.hour * 60 + eventNow.minute);
  const hasEnded = !isCancelled && !isCompleted && initialEvent.statusLabel === "Scheduled" && hasPassed;

  const event = isCancelled
    ? { ...initialEvent, statusLabel: "Cancelled" }
    : isCompleted
      ? { ...initialEvent, statusLabel: "Completed" }
      : initialEvent;

  const visibleAttendees = event.previewAttendees.slice(0, 3);
  const hiddenAttendees = event.previewAttendees.slice(3);
  const respondedCount = event.previewAttendees.filter((attendee) => attendee.status !== "Pending").length;
  const showRsvpState = isGoogleEvent || (event.statusLabel !== "Draft" && !isCancelled);
  const visibleLinked = expandedLinked ? (event.linkedTo ?? []) : (event.linkedTo ?? []).slice(0, 2);
  const hiddenLinkedCount = Math.max(0, (event.linkedTo?.length ?? 0) - 2);
  const meetingLinks = event.meetingLinks?.length
    ? event.meetingLinks
    : event.eventUrl
      ? [{ provider: "Meeting", url: event.eventUrl }]
      : [];
  const locations = event.locations?.length
    ? event.locations
    : event.location && !event.location.startsWith("http")
      ? [{ label: event.location }]
      : [];
  const declinedAttendee = event.previewAttendees.find((attendee) => attendee.status === "Declined");
  const declinedCount = event.previewAttendees.filter((attendee) => attendee.status === "Declined").length;
  const allDeclined = event.previewAttendees.length > 0 && declinedCount === event.previewAttendees.length;
  const statusClassName = String(event.statusLabel ?? "Scheduled").toLowerCase();

  const handleComplete = async () => {
    setCompleting(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setCompletedIds((prev) => new Set(prev).add(initialEvent.id));
    onComplete?.(initialEvent);
    setCompleting(false);
  };

  const handleSchedule = async () => {
    if (onSchedule) {
      onSchedule(initialEvent);
      return;
    }
    setScheduling(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setScheduling(false);
    setActionNotice("Scheduling is a preview action and is not connected yet.");
  };

  const handleDelete = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    if (initialEvent.id.startsWith("draft-") || initialEvent.statusLabel === "Draft" || initialEvent.statusLabel === "Logged") {
      setCancelledIds((prev) => new Set(prev).add(initialEvent.id));
      setConfirming(false);
      setDeleting(false);
      onDeleted?.(initialEvent);
      return;
    }
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(initialEvent.id)}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setCancelledIds((prev) => new Set(prev).add(initialEvent.id));
      setConfirming(false);
      onDeleted?.(initialEvent);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to cancel event");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="preview-scrim" onClick={() => { if (confirming) setConfirming(false); else { setExpanded(false); onClose(); } }} role="presentation">
      <AnimatePresence mode="wait" initial={false}>
      {confirming ? (
        <motion.div key="cancel-dialog" className="preview-cancel-dialog" role="dialog" aria-modal="true" aria-labelledby="cancel-event-title" initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }} transition={{ duration: 0.2 }} onClick={(e) => e.stopPropagation()}>
          <h2 id="cancel-event-title">Cancel Event?</h2>
          <p>Are you sure you want to cancel <strong>{initialEvent.title}</strong>? Attendees will be notified that this event was canceled.</p>
          {deleteError && <p className="preview-supporting-error" role="alert">{deleteError}</p>}
          <div className="preview-confirm-actions"><button type="button" onClick={() => setConfirming(false)}>Keep event</button><button type="button" className="danger" disabled={deleting} onClick={() => void handleDelete()}>{deleting ? "Canceling…" : "Cancel event"}</button></div>
        </motion.div>
      ) : (
      <motion.div key="event-preview" className="preview-dialog" role="dialog" aria-modal="true" aria-label={event.title} initial={{ opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 8 }} transition={{ duration: 0.2 }} onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <div className="preview-header-actions">
            {!isGoogleEvent && !isCancelled && onRefresh && (
              <button className="preview-icon-btn" aria-label="Sync RSVP statuses" title="Sync RSVP statuses" disabled={refreshing} onClick={() => onRefresh(event)}>
                {refreshing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
              </button>
            )}
            {!isGoogleEvent && !isCancelled && onDeleted && (
              <button
                className={`preview-icon-btn preview-delete-btn ${confirming ? "confirming" : ""}`}
                aria-label={confirming ? "Confirm: cancel & delete event" : "Cancel and delete event"}
                title={confirming ? "Click again to confirm cancellation" : "Cancel & delete this event"}
                disabled={deleting}
                onClick={() => void handleDelete()}
              >
                {deleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
              </button>
            )}
            {!isGoogleEvent && !isCancelled && <button className="preview-icon-btn" aria-label="Edit event" title="Edit event" onClick={() => onEdit?.(event)}><PenLine size={18} /></button>}
            <button className="preview-icon-btn preview-close" aria-label="Close" onClick={() => { setExpanded(false); setConfirming(false); onClose(); }}><X size={18} /></button>
          </div>
        </div>

        <h2 className="preview-title">
          {event.title}
          {event.eventUrl && <a href={event.eventUrl} target="_blank" rel="noreferrer" aria-label="Open meeting link"><ExternalLink size={16} /></a>}
        </h2>

        {!isGoogleEvent && <div className="preview-event-type-row">
          <span className="preview-meta-label"><Tag size={16} /> Event type</span>
          <span className="preview-event-type-pill">{event.eventType ?? "Meeting"}</span>
        </div>}

        <div className="preview-meta-grid">
          <div className="preview-meta">
            <span className="preview-meta-label"><UserRound size={16} /> Organizer</span>
            <span className="preview-organizer"><PreviewOrganizerAvatar name={event.organizerName} initials={event.organizerInitials} avatar={event.organizerAvatar} />{event.organizerName}</span>
          </div>
          <div className="preview-meta">
            <span className="preview-meta-label"><CalendarDays size={16} /> Status <span className="preview-info-icon" title="Live event status"><Info size={12} /></span></span>
            <span className={`preview-status-pill ${isCancelled ? "cancelled" : statusClassName}`}>{event.statusLabel ?? "Scheduled"}</span>
          </div>
        </div>

        <div className="preview-meta-grid">
          <div className="preview-meta">
            <span className="preview-meta-label"><CalendarDays size={16} /> Date &amp; Time {event.timezone}</span>
            <span className="preview-date">{formatPreviewRange(event.date, event.hour, event.minute, event.endHour, event.endMinute)}</span>
          </div>
          <div className="preview-meta">
            <span className="preview-meta-label"><AlarmClock size={16} /> Reminder</span>
            <span className="preview-reminder">{event.reminderLabel ?? "Calendar default"}</span>
          </div>
        </div>

        {!isGoogleEvent && event.linkedTo && event.linkedTo.length > 0 && (
          <PreviewSection icon={<Link2 size={16} />} title="Linked to">
            <div className="preview-linked-list">
              {visibleLinked.map((record) => <LinkedRecordRow record={record} key={`${record.type}-${record.label}`} />)}
              {hiddenLinkedCount > 0 && <button type="button" className="preview-show-toggle" onClick={() => setExpandedLinked((value) => !value)} aria-expanded={expandedLinked}>{expandedLinked ? "Show less" : `Show ${hiddenLinkedCount} more`}{expandedLinked ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>}
            </div>
          </PreviewSection>
        )}

        {event.previewAttendees.length > 0 && <PreviewSection icon={<UsersRound size={16} />} title="Attendees" trailing={showRsvpState ? <span className="preview-response-count">{respondedCount} of {event.previewAttendees.length} responded</span> : undefined}>
          <div className="preview-attendees">
            {(expanded ? event.previewAttendees : visibleAttendees).map((attendee) => <AttendeeRow key={attendee.id} attendee={attendee} showStatus={showRsvpState} readOnly={isGoogleEvent} />)}
            {hiddenAttendees.length > 0 && <button type="button" className="preview-show-toggle" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>{!expanded && <span className="preview-group-avatars" aria-label={`${hiddenAttendees.length} more attendees`}>{hiddenAttendees.slice(0, 5).map((attendee) => <PreviewAttendeeAvatar key={attendee.id} attendee={attendee} defaultAvatar={isGoogleEvent} />)}{hiddenAttendees.length > 5 && <span className="preview-group-count">+{hiddenAttendees.length - 5}</span>}</span>}{expanded ? "Show less" : `Show ${hiddenAttendees.length} more`}{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>}
          </div>
        </PreviewSection>}

        {locations.length > 0 && <PreviewSection icon={<MapPin size={16} />} title="Location"><div className="preview-locations">{locations.map((location) => <LocationRow key={`${location.type ?? "location"}-${location.label}`} location={location} />)}</div></PreviewSection>}

        {meetingLinks.length > 0 && <PreviewSection icon={<Link2 size={16} />} title="Meeting link"><div className="preview-meeting-links">{meetingLinks.map((link) => <MeetingLinkRow key={`${link.provider}-${link.url}`} link={link} />)}</div></PreviewSection>}

        {event.aiNotetaker === true && (
          <div className="preview-section">
            <span className="preview-meta-label"><Mic size={16} /> AI Notetaker</span>
            <div className="preview-notetaker-card">
              <NotetakerBadge label="Wiggli Notetaker" />
              <p className="preview-notetaker-note">The bot joins this meeting to record, transcribe and draft AI notes. Admit "Wiggli Notetaker" from the lobby when it joins.</p>
            </div>
          </div>
        )}

        <div className="preview-section">
          <span className="preview-meta-label"><MessageSquareText size={16} /> Description</span>
          <div className="preview-description">{event.description || "No description was added."}</div>
        </div>

        {!isGoogleEvent && (event.proposals?.length ?? 0) > 0 && (
          <div className="preview-section">
            <span className="preview-meta-label"><Clock size={16} /> Proposed time</span>
            <div className="preview-proposals">
              {event.proposals!.map((proposal) => {
                const who = event.previewAttendees.find((a) => a.email.toLowerCase() === proposal.attendeeEmail);
                return (
                  <div className="preview-proposal-row" key={proposal.id}>
                    <div className="preview-proposal-main">
                      <span className="preview-proposal-who">{who?.name ?? proposal.attendeeEmail}</span>
                      <span className="preview-proposal-dot">•</span>
                      <span className="preview-proposal-label">Proposed time</span>
                      <span className="preview-proposal-slot">{proposal.slotLabel}</span>
                      {proposal.note && <span className="preview-proposal-note">“{proposal.note}”</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!isGoogleEvent && actionNotice && <div className="preview-supporting-notice" role="status">{actionNotice}</div>}

        {!isGoogleEvent && declinedAttendee && !isCancelled && event.statusLabel === "Scheduled" && !hasEnded && (
          <div className="preview-declined-bar">
            <span className="preview-declined-error"><AlertCircle size={14} /> {allDeclined ? "All attendees declined." : declinedCount > 1 ? `${declinedCount} attendees declined.` : `${declinedAttendee.name} declined this invitation.`}</span>
            {onReschedule && (
              <button type="button" className="preview-reschedule-btn" onClick={() => onReschedule(event)}><RefreshCw size={15} /> Reschedule</button>
            )}
          </div>
        )}

        {!isGoogleEvent && event.syncState && !isCancelled && (
          <div className="preview-sync-error">
            <span><AlertCircle size={14} />
              {event.syncState === "google-reconnect" && "Google Calendar needs to be reconnected to keep this event synced."}
              {event.syncState === "outlook-reconnect" && "Outlook Calendar needs to be reconnected to keep this event synced."}
              {event.syncState === "google-updated" && "This event was updated in Google Calendar."}
              {event.syncState === "google-failed" && "Couldn't sync with Google Calendar. Try again."}
            </span>
            <button type="button" className="preview-reschedule-btn" onClick={() => setActionNotice("This integration action is a preview and is not connected yet.")}>{event.syncState.includes("reconnect") ? "Reconnect" : event.syncState === "google-updated" ? "Refresh" : "Retry"}</button>
            {event.syncState === "google-failed" && <button type="button" className="preview-sync-edit-btn" onClick={() => setActionNotice("Edit is a preview action and is not connected yet.")}>Edit</button>}
          </div>
        )}

        {!isGoogleEvent && hasEnded && (
          <div className="preview-ended-bar">
            <span>This event has ended.</span>
            <button type="button" className="preview-complete-btn" disabled={completing} onClick={() => void handleComplete()}>
              {completing ? <Loader2 size={14} className="animate-spin" /> : null}
              {completing ? "Completing…" : "Mark complete"}
            </button>
          </div>
        )}


        {!isGoogleEvent && isCancelled && (
          <div className="preview-supporting-footer"><span className="preview-supporting-error">This event was cancelled — attendees were notified and the invitation was removed from their calendars.</span></div>
        )}
        {!isGoogleEvent && event.statusLabel === "Draft" && !hasPassed && (
          <div className="preview-ended-bar preview-draft-footer">
            <span>Ready to schedule.</span>
            <button type="button" className="preview-complete-btn" disabled={scheduling} onClick={() => void handleSchedule()}>{scheduling ? <><Loader2 size={14} className="animate-spin" /> Scheduling…</> : "Schedule & send"}</button>
          </div>
        )}
        {!isGoogleEvent && event.statusLabel === "Draft" && hasPassed && (
          <div className="preview-ended-bar preview-draft-footer">
            <span>This date has passed.</span>
            <button type="button" className="preview-complete-btn" onClick={() => onReschedule?.(event)}>Reschedule</button>
          </div>
        )}
        {!isGoogleEvent && isCompleted && (
          <div className="preview-ended-bar preview-completed-footer">
            <span>This event is complete.</span>
            <button type="button" className="preview-complete-btn" onClick={() => setActionNotice("View notes is a preview action and is not connected yet.")}>View notes</button>
          </div>
        )}
        {!isGoogleEvent && deleteError && (
          <div className="preview-supporting-footer"><span className="preview-supporting-error" role="alert">{deleteError}</span></div>
        )}
      </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
