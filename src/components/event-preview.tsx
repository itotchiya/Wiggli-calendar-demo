"use client";

import {
  AlarmClock,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Info,
  Link2,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Tag,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import Image from "next/image";
import type { CalendarAttendee, CalendarEventItem } from "@/lib/calendar-types";

function PreviewAttendeeAvatar({ attendee }: { attendee: CalendarAttendee }) {
  const [failed, setFailed] = useState(false);
  const initials = attendee.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "?";
  const palette = ["#667eea", "#0f9b8e", "#c06c84", "#4f7c8d", "#8b6fc0", "#d97757"];
  const hash = attendee.name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  if (attendee.avatar && !failed) {
    return <Image src={attendee.avatar} alt={attendee.name} width={28} height={28} className="preview-attendee-avatar" onError={() => setFailed(true)} />;
  }
  return <span className="preview-attendee-avatar" style={{ display: "grid", placeItems: "center", background: palette[hash % palette.length], color: "#fff", fontSize: 10, fontWeight: 700 }}>{initials}</span>;
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

export function EventPreviewDialog({
  event: initialEvent,
  onClose,
  onRefresh,
  onDeleted,
  refreshing = false,
}: {
  event: CalendarEventItem | null;
  onClose: () => void;
  onRefresh?: (event: CalendarEventItem) => void;
  /** Called after the event is cancelled & deleted so lists can refresh. */
  onDeleted?: () => void;
  refreshing?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Local view of the event so a just-cancelled state renders instantly.
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!initialEvent) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [initialEvent, onClose]);

  if (!initialEvent) return null;

  const isCancelled =
    initialEvent.statusLabel === "Cancelled" ||
    cancelledIds.has(initialEvent.id) ||
    initialEvent.id.startsWith("preview") === false && (initialEvent as { status?: string }).status === "CANCELLED";

  const event = isCancelled
    ? { ...initialEvent, statusLabel: "Cancelled" }
    : initialEvent;

  const visibleAttendees = event.previewAttendees.slice(0, 3);
  const hiddenAttendees = event.previewAttendees.slice(3);

  const handleDelete = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(initialEvent.id)}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setCancelledIds((prev) => new Set(prev).add(initialEvent.id));
      setConfirming(false);
      onDeleted?.();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to cancel event");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="preview-scrim" onClick={() => { setExpanded(false); onClose(); }} role="presentation">
      <div className="preview-dialog" role="dialog" aria-modal="true" aria-label={event.title} onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <div className="preview-header-actions">
            {onRefresh && (
              <button className="preview-icon-btn" aria-label="Sync RSVP statuses" title="Sync RSVP statuses" disabled={refreshing} onClick={() => onRefresh(event)}>
                {refreshing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
              </button>
            )}
            {!isCancelled && onDeleted && (
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
            <button className="preview-icon-btn preview-close" aria-label="Close" onClick={() => { setExpanded(false); setConfirming(false); onClose(); }}><X size={18} /></button>
          </div>
        </div>

        {deleteError && (
          <div className="field-error" role="alert">{deleteError}</div>
        )}

        <h2 className="preview-title">
          {event.title}
          {event.eventUrl && <a href={event.eventUrl} target="_blank" rel="noreferrer" aria-label="Open meeting link"><ExternalLink size={16} /></a>}
        </h2>

        <div className="preview-event-type-row">
          <span className="preview-meta-label"><Tag size={16} /> Event type</span>
          <span className="preview-event-type-pill">{event.eventType ?? "Meeting"}</span>
        </div>

        <div className="preview-meta-grid">
          <div className="preview-meta">
            <span className="preview-meta-label"><UserRound size={16} /> Organizer</span>
            <span className="preview-organizer"><span className="preview-organizer-avatar">{event.organizerInitials}</span>{event.organizerName}</span>
          </div>
          <div className="preview-meta">
            <span className="preview-meta-label"><CalendarDays size={16} /> Status <span className="preview-info-icon" title="Live event status"><Info size={12} /></span></span>
            <span className={`preview-status-pill ${isCancelled ? "cancelled" : ""}`}>{event.statusLabel ?? "Scheduled"}</span>
          </div>
        </div>

        <div className="preview-meta-grid">
          <div className="preview-meta">
            <span className="preview-meta-label"><CalendarDays size={16} /> Date &amp; Time {event.timezone}</span>
            <span className="preview-date">{formatPreviewDate(event.date, event.hour, event.minute)}<br />{formatPreviewDate(event.date, event.endHour, event.endMinute)}</span>
          </div>
          <div className="preview-meta">
            <span className="preview-meta-label"><AlarmClock size={16} /> Reminder</span>
            <span className="preview-reminder">{event.reminderLabel ?? "Calendar default"}</span>
          </div>
        </div>

        <div className="preview-section">
          <span className="preview-meta-label"><UsersRound size={16} /> Attendees</span>
          <div className="preview-attendees">
            {(expanded ? event.previewAttendees : visibleAttendees).map((attendee) => (
              <div className="preview-attendee-row" key={attendee.id}>
                <PreviewAttendeeAvatar attendee={attendee} />
                <span className="preview-attendee-name">{attendee.name}</span>
                <span className="preview-attendee-dot">•</span>
                <span className="preview-attendee-role">{attendee.role}</span>
                <span className={statusClass[attendee.status]}>{attendee.status}</span>
              </div>
            ))}
            {hiddenAttendees.length > 0 && (
              <button type="button" className="preview-show-toggle" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
                {!expanded && <span className="preview-group-avatars">{hiddenAttendees.slice(0, 5).map((attendee) => <span key={attendee.id}>{attendee.name[0]}</span>)}</span>}
                {expanded ? "Show less" : "Show all"}
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>
        </div>

        {event.eventUrl && (
          <div className="preview-section">
            <span className="preview-meta-label"><Link2 size={16} /> Meeting URL</span>
            <div className="preview-url-row">
              <span className="preview-url">{event.eventUrl}</span>
              <a href={event.eventUrl} target="_blank" rel="noreferrer" className="preview-url-action" aria-label="Open meeting URL"><ExternalLink size={16} /></a>
              <button type="button" className="preview-url-action" aria-label="Copy meeting URL" onClick={() => void navigator.clipboard?.writeText(event.eventUrl!)}><Copy size={16} /></button>
            </div>
          </div>
        )}

        <div className="preview-section">
          <span className="preview-meta-label"><MessageSquareText size={16} /> Description</span>
          <div className="preview-description">{event.description || "No description was added."}</div>
        </div>

        {event.previewAttendees.some((attendee) => attendee.status === "Declined") && (
          <div className="preview-declined-bar">
            <span className="preview-declined-label">{event.previewAttendees.find((attendee) => attendee.status === "Declined")?.name} declined</span>
            <button type="button" className="preview-reschedule-btn" onClick={() => onRefresh?.(event)}><RefreshCw size={16} /> Sync again</button>
          </div>
        )}

        {isCancelled && (
          <div className="preview-cancelled-banner">
            <span>This event was cancelled — attendees were notified and the invitation was removed from their calendars.</span>
          </div>
        )}
        {deleteError && (
          <div className="field-error" role="alert">{deleteError}</div>
        )}
      </div>
    </div>
  );
}
