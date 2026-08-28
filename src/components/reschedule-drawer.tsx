"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Clock3,
  Info,
  Link2,
  Lock,
  Mail,
  RefreshCw,
  Send,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import type { CalendarEventItem } from "@/lib/calendar-types";
import { showToast } from "@/components/toaster";
import {
  addDays,
  dateKey,
  formatCompactTime,
  getNextQuarterSlot,
  getTodayUtcPlusTwo,
  formatMonthYear,
  formatPickerLabel,
  parseDateKey,
} from "@/lib/datetime-proto";
import type { TimedDate } from "@/components/event-drawer";

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function minutesToTime(value: number) {
  const normalized = Math.max(0, Math.min(Math.ceil(value / 15) * 15, 23 * 60 + 45));
  return formatCompactTime(Math.floor(normalized / 60), normalized % 60);
}

function dateTimeStamp(date: string, time: string) {
  return parseDateKey(date).getTime() + timeToMinutes(time) * 60_000;
}

function minimumTimeForDate(date: string) {
  const next = getNextQuarterSlot();
  return date === next.date ? formatCompactTime(next.hour, next.minute) : "00:00";
}

function DrawerTimeField({
  value,
  label,
  min = "00:00",
  max = "23:45",
  onChange,
}: {
  value: string;
  label: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  const choices = Array.from({ length: 96 }, (_, index) => minutesToTime(index * 15)).filter(
    (time) => time >= min && time <= max
  );
  return (
    <span className="drawer-time-select">
      <select
        className="drawer-time-field"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {choices.map((time) => (
          <option value={time} key={time}>
            {time}
          </option>
        ))}
      </select>
      <ChevronDown size={14} aria-hidden="true" />
    </span>
  );
}

function RescheduleDatePicker({
  value,
  minDate,
  onChange,
}: {
  value: TimedDate[];
  minDate: string;
  onChange: (value: TimedDate[]) => void;
}) {
  const [visibleMonth, setVisibleMonth] = useState(() => parseDateKey(value[0]?.date || minDate));
  const [activeDate, setActiveDate] = useState(value[0]?.date || minDate);
  const days = useMemo(() => {
    const first = new Date(Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth(), 1));
    const mondayOffset = (first.getUTCDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) => addDays(first, index - mondayOffset));
  }, [visibleMonth]);

  const sortedSlots = useMemo(
    () => [...value].sort((a, b) => dateTimeStamp(a.date, a.start) - dateTimeStamp(b.date, b.start)),
    [value]
  );
  const selectedDates = useMemo(() => new Set(sortedSlots.map((slot) => slot.date)), [sortedSlots]);
  const groupedSlots = useMemo(() => {
    const groups = new globalThis.Map<string, TimedDate[]>();
    for (const slot of sortedSlots) groups.set(slot.date, [...(groups.get(slot.date) ?? []), slot]);
    return [...groups.entries()];
  }, [sortedSlots]);

  const endAfter = (start: string, end: string) => {
    const minimum = Math.min(timeToMinutes(start) + 15, 23 * 60 + 45);
    return end > start && timeToMinutes(end) >= minimum ? end : minutesToTime(minimum);
  };

  const updateSlot = (index: number, patch: Partial<TimedDate>) => {
    onChange(
      sortedSlots.map((slot, slotIndex) => {
        if (slotIndex !== index) return slot;
        const next = { ...slot, ...patch };
        return patch.start ? { ...next, end: endAfter(next.start, next.end) } : next;
      })
    );
  };

  const selectDate = (date: string) => {
    if (date < minDate) return;
    setActiveDate(date);
    const template = sortedSlots[0];
    const start =
      date === minDate
        ? template?.start && template.start >= minimumTimeForDate(date)
          ? template.start
          : minimumTimeForDate(date)
        : template?.start ?? "09:00";
    const end = endAfter(start, template?.end ?? minutesToTime(timeToMinutes(start) + 15));
    onChange([{ date, start, end }]);
  };

  const moveMonth = (amount: number) => {
    setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + amount, 1)));
  };

  return (
    <div className="date-picker-wrap">
      <div className="date-picker-shell">
        <div className="date-picker-left">
          <div className="date-picker-header">
            <strong>{formatMonthYear(visibleMonth)}</strong>
            <div>
              <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}>
                <ChevronLeft size={16} />
              </button>
              <button type="button" aria-label="Next month" onClick={() => moveMonth(1)}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="date-grid-weekdays">
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
            <span>Su</span>
          </div>
          <div className="date-grid-days">
            {days.map((day) => {
              const key = dateKey(day);
              const isSelected = selectedDates.has(key);
              const isCurrentMonth = day.getUTCMonth() === visibleMonth.getUTCMonth();
              const isPast = key < minDate;
              return (
                <button
                  type="button"
                  key={key}
                  disabled={isPast}
                  onClick={() => selectDate(key)}
                  className={`date-cell ${isSelected ? "selected" : ""} ${!isCurrentMonth ? "other-month" : ""} ${
                    isPast ? "past-day" : ""
                  }`}
                >
                  {day.getUTCDate()}
                </button>
              );
            })}
          </div>
        </div>

        <div className="date-picker-right">
          <h4>{formatPickerLabel(parseDateKey(activeDate))}</h4>
          <div className="slots-editor">
            {groupedSlots.map(([date, dateSlots]) => (
              <div key={date} className="slot-day-group">
                {dateSlots.map((slot) => {
                  const absoluteIndex = sortedSlots.indexOf(slot);
                  return (
                    <div className="slot-row" key={`${slot.date}-${slot.start}-${slot.end}`}>
                      <DrawerTimeField
                        value={slot.start}
                        label="Start time"
                        min={slot.date === minDate ? minimumTimeForDate(slot.date) : "00:00"}
                        onChange={(start) => updateSlot(absoluteIndex, { start })}
                      />
                      <span>to</span>
                      <DrawerTimeField
                        value={slot.end}
                        label="End time"
                        min={minutesToTime(timeToMinutes(slot.start) + 15)}
                        onChange={(end) => updateSlot(absoluteIndex, { end })}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 2-Step Reschedule & Edit Drawer.
 * Exact visual fidelity to EventDrawer.
 */
export function RescheduleDrawer({
  event,
  proposed,
  onClose,
  onUpdated,
}: {
  event: CalendarEventItem;
  proposed?: { attendeeEmail: string; slotLabel: string; note: string | null } | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayKey = dateKey(getTodayUtcPlusTwo());

  // Parse proposal slot or fall back to event slot
  const initialOccurrence: TimedDate = useMemo(() => {
    return {
      date: event.date,
      start: `${pad(event.hour)}:${pad(event.minute)}`,
      end: `${pad(event.endHour)}:${pad(event.endMinute)}`,
    };
  }, [event, pad]);

  const [drawerStep, setDrawerStep] = useState<1 | 2>(1);
  const [occurrences, setOccurrences] = useState<TimedDate[]>([initialOccurrence]);
  const [description, setDescription] = useState(event.description || "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSlot = occurrences[0] || initialOccurrence;

  const formatDisplayTime = (slot: TimedDate) => {
    try {
      const d = parseDateKey(slot.date);
      return `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })} at ${slot.start} – ${slot.end}`;
    } catch {
      return `${slot.date} ${slot.start} – ${slot.end}`;
    }
  };

  const handleNext = () => {
    if (!selectedSlot.date || !selectedSlot.start || !selectedSlot.end) {
      setError("Please choose a valid date and time slot.");
      return;
    }
    setError(null);
    setDrawerStep(2);
  };

  const submit = () => {
    if (!selectedSlot.date || !selectedSlot.start || !selectedSlot.end) {
      setError("Please choose a valid date and time slot.");
      return;
    }

    void (async () => {
      setSaving(true);
      setError(null);
      try {
        const startIso = `${selectedSlot.date}T${selectedSlot.start}`;
        const endIso = `${selectedSlot.date}T${selectedSlot.end}`;

        const res = await fetch(`/api/events/${encodeURIComponent(event.id)}/reschedule`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            start: startIso,
            end: endIso,
            timezone: event.timezone,
            description: description.trim(),
            note: note.trim() || undefined,
          }),
        });

        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);

        showToast("Event rescheduled and update sent to attendees");
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
      <button className="drawer-scrim visible" onClick={onClose} aria-label="Close reschedule drawer" />
      <aside className="event-drawer open" aria-hidden={false} role="dialog" aria-label={`Reschedule ${event.title}`}>
        {drawerStep === 1 ? (
          /* STEP 1: Reschedule Event Details (Exact EventDrawer UI with locked fields) */
          <>
            <div className="drawer-heading">
              <h2>Edit event — {event.title}</h2>
              <button onClick={onClose} aria-label="Close"><X size={17} /></button>
            </div>

            <div className="drawer-body">
              <section className="drawer-form-column">
                {proposed && (
                  <div className="reschedule-proposal-banner">
                    <div className="reschedule-proposal-badge">
                      <Clock size={14} /> Counter-Proposal Received
                    </div>
                    <div className="reschedule-proposal-body">
                      <strong>{proposed.attendeeEmail}</strong> proposed: <span className="reschedule-slot-pill">{proposed.slotLabel}</span>
                      {proposed.note && <div className="reschedule-proposal-quote">“{proposed.note}”</div>}
                    </div>
                  </div>
                )}

                {/* Title */}
                <label className="field-label">
                  <span>Title<span className="required-star">*</span></span>
                </label>
                <input
                  className="drawer-title-input"
                  value={event.title}
                  disabled
                  readOnly
                  style={{ background: "#f8fafc", color: "#475569", cursor: "not-allowed" }}
                />

                {/* Event Type */}
                <div className="field-label field-space event-type-label-row">
                  <span className="event-type-label-copy">Event type<span className="required-star">*</span></span>
                </div>
                <div className="event-type-dropdown-wrap" style={{ position: "relative" }}>
                  <button
                    className="location-select"
                    type="button"
                    disabled
                    style={{ width: "100%", fontSize: 13, height: 39, background: "#f8fafc", color: "#475569", cursor: "not-allowed" }}
                  >
                    <span style={{ fontSize: 13 }}>{event.eventType ?? "Interview"}</span>
                    <Lock size={13} style={{ color: "#94a3b8" }} />
                  </button>
                </div>

                {/* Date & Time Picker */}
                <label className="field-label field-space">
                  <span>Date &amp; Time<span className="required-star">*</span></span>
                </label>
                <RescheduleDatePicker
                  value={occurrences}
                  minDate={todayKey}
                  onChange={setOccurrences}
                />
                {proposed?.slotLabel && (
                  <div className="date-time-support" style={{ marginTop: 6, color: "#1d4ed8" }}>
                    <Sparkles size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />
                    Attendee suggested: <strong>{proposed.slotLabel}</strong>
                  </div>
                )}

                {/* Attendees */}
                <label className="field-label field-space attendee-field-label">
                  <span>Attendees<span className="required-star">*</span></span>
                  <span className="attendee-count">{event.previewAttendees.length} / 10</span>
                </label>
                <div className="attendee-picker">
                  <div className="attendee-tags" style={{ width: "100%" }}>
                    {event.previewAttendees.map((attendee) => (
                      <div className="attendee-chip" key={attendee.id} style={{ background: "#f1f5f9" }}>
                        <span className="attendee-avatar">{attendee.name.slice(0, 2).toUpperCase()}</span>
                        <span className="attendee-name">{attendee.name}</span>
                        <span className={`preview-status-pill preview-status-${attendee.status.toLowerCase()}`} style={{ marginLeft: 4, transform: "scale(0.85)" }}>
                          {attendee.status}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="helper" style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5, color: "#94a3b8" }}>
                    <Lock size={12} /> Attendee list cannot be changed during reschedule.
                  </p>
                </div>

                {/* Location */}
                {event.eventUrl && (
                  <div className="event-location-section" style={{ marginTop: 14 }}>
                    <div className="field-label field-space location-heading">
                      <span>Location</span>
                    </div>
                    <div className="location-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
                      <span style={{ fontSize: 13, color: "#334155", display: "flex", alignItems: "center", gap: 7 }}>
                        <Link2 size={15} style={{ color: "#078c80" }} /> {event.eventUrl}
                      </span>
                      <Lock size={13} style={{ color: "#94a3b8" }} />
                    </div>
                  </div>
                )}

                {/* Description (Editable in Step 1) */}
                <label className="field-label field-space">Description</label>
                <div className="description-field">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
                    placeholder="Description here"
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                  <span style={{ color: description.length >= 2000 ? "#e5484d" : "#8da0b9", fontSize: 11 }}>
                    {description.length}/2000
                  </span>
                </div>

                {error && <p className="field-error" style={{ marginTop: 8 }}><AlertCircle size={13} /> {error}</p>}
              </section>

              {/* Right Column: Info & Attendee Panel (Exact EventDrawer Right Side) */}
              <aside className="drawer-info-column">
                <section>
                  <h3><Clock3 size={16} /> Attendee Live Status</h3>
                  <div className="attendee-schedule-list">
                    {event.previewAttendees.map((person) => (
                      <div className={`attendee-schedule-card status-${person.status.toLowerCase()}`} key={person.id}>
                        <div>
                          <strong>{person.name}</strong>
                          <span>{person.status}</span>
                        </div>
                        <div>
                          <span><Mail size={13} /> {person.email}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="history-section" style={{ marginTop: 16 }}>
                  <h3><Info size={16} /> Reschedule &amp; Delivery</h3>
                  <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                    Advancing to the next step allows you to review the update and write an optional note explaining the schedule change to all attendees.
                  </p>
                </section>
              </aside>
            </div>

            <div className="drawer-footer">
              <button className="text-button" onClick={onClose}>Cancel</button>
              <button className="create-event-button" onClick={handleNext}>
                Reschedule <ArrowRight size={18} strokeWidth={1.9} />
              </button>
            </div>
          </>
        ) : (
          /* STEP 2: Review & Notify (Google Calendar Settings + Distinct Update Reason Note) */
          <>
            <div className="drawer-heading">
              <div className="drawer-heading-left">
                <button className="drawer-back-btn" onClick={() => setDrawerStep(1)} aria-label="Back to edit event">
                  <ChevronLeft size={18} />
                </button>
                <h2>Review &amp; Notify Attendees</h2>
              </div>
              <button onClick={onClose} aria-label="Close"><X size={17} /></button>
            </div>

            <div className="drawer-body review-invite-body">
              <div className="invite-customize-header">
                <h3><Mail size={16} /> Google Calendar Update &amp; Notification</h3>
                <div className="invite-notice-banner">
                  <Info size={16} />
                  <span>
                    Google Calendar API will send native updated invitations (<code>sendUpdates: &quot;all&quot;</code>) to all attendees with the updated time and your note.
                  </span>
                </div>
              </div>

              {/* Schedule Comparison Box */}
              <div className="reschedule-diff-card">
                <div className="reschedule-diff-column">
                  <span className="reschedule-diff-label">Previous Schedule</span>
                  <div className="reschedule-diff-time old-time">
                    <CalendarDays size={14} />
                    <span>{event.date} at {pad(event.hour)}:{pad(event.minute)} – {pad(event.endHour)}:{pad(event.endMinute)}</span>
                  </div>
                </div>
                <div className="reschedule-diff-arrow">
                  <ArrowRight size={18} />
                </div>
                <div className="reschedule-diff-column">
                  <span className="reschedule-diff-label">New Rescheduled Schedule</span>
                  <div className="reschedule-diff-time new-time">
                    <CalendarDays size={14} />
                    <span>{formatDisplayTime(selectedSlot)}</span>
                  </div>
                </div>
              </div>

              {/* Recipients to notify */}
              <div className="reschedule-review-section">
                <label className="field-label"><span>Recipients to notify ({event.previewAttendees.length})</span></label>
                <div className="reschedule-recipients-pills">
                  {event.previewAttendees.map((att) => (
                    <span className="reschedule-recipient-pill" key={att.id}>
                      <span className="recip-dot" />
                      <strong>{att.name}</strong> ({att.email})
                    </span>
                  ))}
                </div>
              </div>

              {/* Update Note (Separate Reschedule Reason) */}
              <div className="reschedule-review-section">
                <label className="field-label">
                  <span>Update note to attendees <span className="reschedule-optional">(optional)</span></span>
                </label>
                <textarea
                  className="reschedule-note-input"
                  rows={4}
                  placeholder="e.g. Moving the call to Tuesday at 14:00 as requested by Sarah..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  aria-label="Update note"
                />
                <p className="reschedule-note-hint">
                  <Info size={13} /> This note will be sent with the update for others to know why it was updated.
                </p>
              </div>

              {/* Notification Preview Card */}
              <div className="reschedule-review-section">
                <label className="field-label"><span>Calendar Invitation Preview</span></label>
                <div className="reschedule-preview-card">
                  <div className="preview-card-header">
                    <h4>{event.title}</h4>
                    <span className="preview-status-pill preview-status-tentative">Updated Invitation</span>
                  </div>
                  <div className="preview-card-details">
                    <div><CalendarDays size={14} /> <strong>When:</strong> {formatDisplayTime(selectedSlot)}</div>
                    {event.eventUrl && <div><Link2 size={14} /> <strong>Where:</strong> {event.eventUrl}</div>}
                    <div><UsersRound size={14} /> <strong>Who:</strong> {event.previewAttendees.map((a) => a.name).join(", ")}</div>
                    {description.trim() && (
                      <div style={{ marginTop: 4 }}>
                        <strong>Agenda:</strong> {description.trim()}
                      </div>
                    )}
                  </div>
                  {note.trim() && (
                    <div className="preview-card-note">
                      <strong>Update reason:</strong>
                      <p>“{note.trim()}”</p>
                    </div>
                  )}
                </div>
              </div>

              {error && <div className="field-error" role="alert" style={{ marginTop: 12 }}><AlertCircle size={13} /> {error}</div>}
            </div>

            <div className="drawer-footer">
              <button className="back-step-button" type="button" onClick={() => setDrawerStep(1)}>
                <ChevronLeft size={16} /> Back
              </button>
              <button className="create-event-button" disabled={saving} onClick={submit}>
                {saving ? "Updating…" : <>Update &amp; notify <Send size={16} strokeWidth={1.9} /></>}
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
