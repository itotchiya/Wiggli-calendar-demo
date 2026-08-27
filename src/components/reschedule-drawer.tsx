"use client";

import { useState } from "react";
import { AlertCircle, CalendarDays, Clock, Info, Lock, RefreshCw, UsersRound, X } from "lucide-react";
import type { CalendarEventItem } from "@/lib/calendar-types";

/**
 * Reschedule drawer (declined / proposed-time flow).
 *
 * Locked editing by design: title and attendee list are read-only context.
 * The only editable things are the new date/time (prefilled from the
 * attendee's proposed time when available) and an optional update note.
 * "Update & notify" moves the Google event with sendUpdates:"all" so every
 * attendee receives Google's native updated-invitation email with the note.
 */
export function RescheduleDrawer({
  event,
  proposed,
  onClose,
  onUpdated,
}: {
  event: CalendarEventItem;
  /** Proposed slot string (e.g. "Tue 2 Sep 2026, 14:00 – 14:30") to prefill, when rescheduling from a proposal. */
  proposed?: { attendeeEmail: string; slotLabel: string; note: string | null } | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const defaultStart = proposed ? null : `${event.date}T${pad(event.hour)}:${pad(event.minute)}`;
  const [startValue, setStartValue] = useState<string>(defaultStart ?? "");
  const [endValue, setEndValue] = useState<string>(
    `${event.date}T${pad(event.endHour)}:${pad(event.endMinute)}`
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!startValue || !endValue) {
      setError("Pick the new start and end time.");
      return;
    }
    void (async () => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/events/${encodeURIComponent(event.id)}/reschedule`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            start: startValue.replace("T", " ") === startValue ? startValue : startValue,
            end: endValue,
            timezone: event.timezone,
            note: note.trim() || undefined,
          }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
        onUpdated();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reschedule");
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <div className="drawer-overlay" role="dialog" aria-modal="true" aria-label={`Reschedule ${event.title}`}>
      <div className="drawer event-drawer drawer-open reschedule-drawer">
        <div className="drawer-header">
          <div>
            <span className="drawer-kicker"><RefreshCw size={13} /> Reschedule</span>
            <h2 className="drawer-title">{event.title}</h2>
          </div>
          <button type="button" className="preview-icon-btn preview-close" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="drawer-body">
          {proposed && (
            <div className="reschedule-proposal-note">
              <Clock size={14} />
              <span>
                Rescheduling to <strong>{proposed.slotLabel}</strong> — proposed by {proposed.attendeeEmail}.
                {proposed.note ? <> Note: “{proposed.note}”</> : null}
              </span>
            </div>
          )}

          {/* Title — locked */}
          <div className="drawer-field-group">
            <label className="drawer-field-label">Event title</label>
            <div className="reschedule-locked-field"><Lock size={13} /> {event.title}</div>
          </div>

          {/* Date & time — the only editable schedule fields */}
          <div className="drawer-field-group">
            <label className="drawer-field-label">New date &amp; time <span className="required">*</span></label>
            <div className="reschedule-time-grid">
              <div className="reschedule-time-field">
                <span className="reschedule-time-label"><CalendarDays size={13} /> Start</span>
                <input
                  type="datetime-local"
                  value={startValue}
                  onChange={(e) => setStartValue(e.target.value)}
                  className="reschedule-time-input"
                  aria-label="New start time"
                />
              </div>
              <div className="reschedule-time-field">
                <span className="reschedule-time-label"><Clock size={13} /> End</span>
                <input
                  type="datetime-local"
                  value={endValue}
                  onChange={(e) => setEndValue(e.target.value)}
                  className="reschedule-time-input"
                  aria-label="New end time"
                />
              </div>
            </div>
            {proposed?.slotLabel && (
              <p className="reschedule-proposed-hint">Proposed slot from the attendee: {proposed.slotLabel}</p>
            )}
          </div>

          {/* Attendees — locked list */}
          <div className="drawer-field-group">
            <label className="drawer-field-label"><UsersRound size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} /> Attendees</label>
            <div className="reschedule-attendees">
              {event.previewAttendees.map((attendee) => (
                <div className="reschedule-attendee-row" key={attendee.id}>
                  <span className="reschedule-attendee-name">{attendee.name}</span>
                  <span className="reschedule-attendee-dot">•</span>
                  <span className="reschedule-attendee-role">{attendee.role}</span>
                  <span className={`att-status ${attendee.status.toLowerCase()}`}>{attendee.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Optional note */}
          <div className="drawer-field-group">
            <label className="drawer-field-label">Update note <span className="reschedule-optional">(optional)</span></label>
            <textarea
              className="reschedule-note-input"
              rows={3}
              placeholder="e.g. Moving the call 30 minutes later due to a conflict…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label="Update note"
            />
            <p className="reschedule-note-hint"><Info size={12} /> This note is sent with the update so attendees know why the time changed.</p>
          </div>

          {error && <div className="field-error" role="alert"><AlertCircle size={13} /> {error}</div>}
        </div>

        <div className="drawer-footer">
          <button className="text-button" type="button" onClick={onClose}>Cancel</button>
          <button className="create-event-button" type="button" disabled={saving} onClick={submit}>
            {saving ? "Updating…" : <>Update &amp; notify <RefreshCw size={17} strokeWidth={1.9} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
