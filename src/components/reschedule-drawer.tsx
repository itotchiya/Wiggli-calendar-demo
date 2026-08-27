"use client";

import { useState } from "react";
import { AlertCircle, CalendarDays, Clock, Info, Lock, RefreshCw, UsersRound, X } from "lucide-react";
import type { CalendarEventItem } from "@/lib/calendar-types";

/**
 * Reschedule drawer (declined / proposed-time flow).
 *
 * Uses the SAME shell and UI classes as the main EventDrawer
 * (drawer-scrim / event-drawer open / drawer-heading / drawer-body /
 * drawer-footer) so it feels like the identical drawer, just scoped:
 * title + attendees are locked, date/time prefilled from the proposal,
 * optional note, and "Update & notify" moves the Google event with
 * sendUpdates:"all" (native updated invitations to every attendee).
 */
export function RescheduleDrawer({
  event,
  proposed,
  onClose,
  onUpdated,
}: {
  event: CalendarEventItem;
  /** Proposed slot (from the Gmail notification) to show as prefill context. */
  proposed?: { attendeeEmail: string; slotLabel: string; note: string | null } | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const datePart = event.date;
  const [startValue, setStartValue] = useState<string>(`${datePart}T${pad(event.hour)}:${pad(event.minute)}`);
  const [endValue, setEndValue] = useState<string>(`${datePart}T${pad(event.endHour)}:${pad(event.endMinute)}`);
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
            start: startValue,
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
    <>
      <button className={`drawer-scrim visible`} onClick={onClose} aria-label="Close reschedule drawer" />
      <aside className="event-drawer open reschedule-drawer" aria-hidden={false} role="dialog" aria-label={`Reschedule ${event.title}`}>
        <div className="drawer-heading">
          <h2>Reschedule — {event.title}</h2>
          <button onClick={onClose} aria-label="Close"><X size={17} /></button>
        </div>

        <div className="drawer-body reschedule-body">
          <section className="drawer-form-column">
            {proposed && (
              <div className="reschedule-proposal-note">
                <Clock size={14} />
                <span>
                  Proposed by attendee: <strong>{proposed.slotLabel}</strong>
                  {proposed.note ? <> — “{proposed.note}”</> : null}
                </span>
              </div>
            )}

            <label className="field-label"><span>Title</span></label>
            <div className="reschedule-locked-field"><Lock size={13} /> {event.title}</div>

            <label className="field-label" style={{ marginTop: 14 }}><span>New date &amp; time<span className="required-star">*</span></span></label>
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
              <p className="reschedule-proposed-hint">Attendee proposed: {proposed.slotLabel}</p>
            )}

            <label className="field-label" style={{ marginTop: 14 }}><span><UsersRound size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />Attendees</span></label>
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

            <label className="field-label" style={{ marginTop: 14 }}><span>Update note <span className="reschedule-optional">(optional)</span></span></label>
            <textarea
              className="reschedule-note-input"
              rows={3}
              placeholder="e.g. Moving the call 30 minutes later due to a conflict…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label="Update note"
            />
            <p className="reschedule-note-hint"><Info size={12} /> This note is sent with the update so attendees know why the time changed.</p>

            {error && <div className="field-error" role="alert"><AlertCircle size={13} /> {error}</div>}
          </section>
        </div>

        <div className="drawer-footer">
          <button className="text-button" onClick={onClose}>Cancel</button>
          <button className="create-event-button" disabled={saving} onClick={submit}>
            {saving ? "Updating…" : <>Update &amp; notify <RefreshCw size={17} strokeWidth={1.9} /></>}
          </button>
        </div>
      </aside>
    </>
  );
}
