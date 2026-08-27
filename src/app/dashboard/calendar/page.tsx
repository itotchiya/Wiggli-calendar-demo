"use client";

import {
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Header } from "@/components/chrome";
import { CreatorDialog, type CreatorMode } from "@/components/creator-dialog";
import { RescheduleDrawer } from "@/components/reschedule-drawer";
import { EventDrawer } from "@/components/event-drawer";
import { EventPreviewDialog } from "@/components/event-preview";
import type { CalendarEventItem, PreviewStatus } from "@/lib/calendar-types";
import { notifyIfGoogleSessionExpired } from "@/lib/google-session-client";
import type { EventDto } from "@/types/event";
import {
  addDays,
  dateKey,
  formatMonthYear,
  formatPickerLabel,
  formatTime,
  formatWeekRange,
  getNextQuarterSlot,
  getTodayUtcPlusTwo,
  getUtcPlusTwoCalendarTime,
  startOfWeek,
} from "@/lib/datetime-proto";

const weekdayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const hours = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, "0")}:00`);
const quarterHours = [0, 15, 30, 45];
const HOUR_PX = 64;

function eventDateParts(iso: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    date: `${value("year")}-${String(value("month")).padStart(2, "0")}-${String(value("day")).padStart(2, "0")}`,
    hour: value("hour"),
    minute: value("minute"),
  };
}

function mapStatus(status: string): PreviewStatus {
  if (status === "ACCEPTED") return "Accepted";
  if (status === "DECLINED") return "Declined";
  if (status === "TENTATIVE") return "Tentative";
  return "Pending";
}

function roleFor(type: string | null) {
  if (type === "candidate" || type === "freelancer") return "Candidate";
  if (type === "contact") return "Contact";
  if (type === "internal") return "Internal attendee";
  return "Attendee";
}

function initials(value: string) {
  return value.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "OR";
}

function mapEvent(event: EventDto): CalendarEventItem {
  const start = eventDateParts(event.start, event.timezone);
  const end = eventDateParts(event.end, event.timezone);
  return {
    id: event.id,
    googleEventId: event.googleEventId,
    date: start.date,
    hour: start.hour,
    minute: start.minute,
    endHour: end.hour,
    endMinute: end.minute,
    title: event.summary,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    timezone: event.timezone,
    organizerName: event.organizerEmail.split("@")[0],
    organizerInitials: initials(event.organizerEmail),
    eventType: event.eventType ?? (event.summary.toLowerCase().includes("interview") ? "Interview" : "Meeting"),
    statusLabel: (event as { status?: string }).status === "CANCELLED" ? "Cancelled" : "Scheduled",
    proposals: (event.proposals ?? []).filter((p) => p.status === "PENDING").map((p) => ({
      id: p.id,
      attendeeEmail: p.attendeeEmail,
      slotLabel: p.slotLabel,
      note: p.note,
      createdAt: p.createdAt,
    })),
    reminderLabel: event.reminderMinutes == null ? "Calendar default" : `${event.reminderMinutes} minutes before`,
    eventUrl: event.hangoutLink ?? (event.location?.startsWith("http") ? event.location : undefined),
    previewAttendees: event.attendees.map((attendee, index) => ({
      id: attendee.id,
      name: attendee.name ?? attendee.email,
      email: attendee.email,
      role: roleFor(attendee.type),
      avatar: `/avatars/avatar-${(index % 24) + 1}.webp`,
      status: mapStatus(attendee.rsvp),
    })),
  };
}

function MiniCalendar({ selectedDate, onSelectDate }: { selectedDate: Date; onSelectDate: (date: Date) => void }) {
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), 1)));
  const today = getTodayUtcPlusTwo();
  const calendarDays = useMemo(() => {
    const year = visibleMonth.getUTCFullYear();
    const month = visibleMonth.getUTCMonth();
    const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
    const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return [...Array.from({ length: offset }, () => null), ...Array.from({ length: count }, (_, index) => new Date(Date.UTC(year, month, index + 1)))];
  }, [visibleMonth]);
  return (
    <div className="mini-calendar">
      <div className="mini-calendar-heading">
        <button aria-label="Previous month" onClick={() => setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1)))}><ChevronLeft size={16} /></button>
        <span>{formatMonthYear(visibleMonth)}</span>
        <button aria-label="Next month" onClick={() => setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1)))}><ChevronRight size={16} /></button>
      </div>
      <div className="mini-weekdays">{"MTWTFSS".split("").map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
      <div className="mini-days">
        {calendarDays.map((date, index) => date ? (
          <button
            className={`${dateKey(date) === dateKey(selectedDate) ? "selected" : ""} ${dateKey(date) === dateKey(today) ? "today" : ""}`}
            aria-label={`Select ${formatPickerLabel(date)}`}
            onClick={() => onSelectDate(date)}
            key={dateKey(date)}
          >{date.getUTCDate()}</button>
        ) : <span key={`blank-${index}`} />)}
      </div>
    </div>
  );
}

function CalendarPanel({ onSchedule, selectedDate, onSelectDate }: { onSchedule: () => void; selectedDate: Date; onSelectDate: (date: Date) => void }) {
  const [personalOn, setPersonalOn] = useState(true);
  const [groupOn, setGroupOn] = useState(false);
  return (
    <aside className="calendar-panel">
      <div className="calendar-panel-title"><h2>Calendar</h2><button onClick={onSchedule}><CalendarPlus size={16} /> Schedule</button></div>
      <MiniCalendar key={`${selectedDate.getUTCFullYear()}-${selectedDate.getUTCMonth()}`} selectedDate={selectedDate} onSelectDate={onSelectDate} />
      <section className="calendar-list">
        <h3>My Calendar</h3>
        <button className="calendar-owner" onClick={() => setPersonalOn((value) => !value)}><span className={`calendar-check ${personalOn ? "checked" : ""}`}>{personalOn && <Check size={12} />}</span><b>Axelle Bastin</b></button>
      </section>
      <section className="calendar-list collaborative">
        <div><h3>Collaborative Groups</h3><button aria-label="Add group"><Plus size={14} /></button></div>
        <button className="calendar-owner" onClick={() => setGroupOn((value) => !value)}><span className={`calendar-check ${groupOn ? "checked" : ""}`}>{groupOn && <Check size={12} />}</span><span>Hiring team</span><MoreHorizontal size={14} /></button>
        <span className="group-avatar">AB</span>
      </section>
    </aside>
  );
}

function CalendarGrid({ events, onSlot, onEventClick, weekDates, selectedDate }: { events: CalendarEventItem[]; onSlot: (date: string, hour: number, minute: number) => void; onEventClick: (event: CalendarEventItem) => void; weekDates: Date[]; selectedDate: Date }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [calendarNow, setCalendarNow] = useState(getUtcPlusTwoCalendarTime);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR_PX - 36;
    const timer = window.setInterval(() => setCalendarNow(getUtcPlusTwoCalendarTime()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="week-scroll" ref={scrollRef}>
      <div className="week-grid">
        <div className="week-head corner">UTC<br />+2</div>
        {weekDates.map((date) => <div className={`week-head ${dateKey(date) === dateKey(selectedDate) ? "selected" : ""}`} key={dateKey(date)}>{date.getUTCDate()} {weekdayNames[date.getUTCDay()]}</div>)}
        <div className="all-day-label" />
        {weekDates.map((date) => <div className={`all-day-cell ${dateKey(date) === dateKey(selectedDate) ? "selected-column" : ""}`} key={dateKey(date)} />)}
        {hours.map((time, hourIndex) => (
          <div className="calendar-row" key={time}>
            <div className="time-label">{time}</div>
            {weekDates.map((date) => {
              const currentDate = dateKey(date);
              const matching = events.filter((event) => event.date === currentDate && event.hour === hourIndex);
              return (
                <div className="time-cell" key={`${time}-${currentDate}`}>
                  {quarterHours.map((minute) => {
                    const isPast = currentDate < calendarNow.date || (currentDate === calendarNow.date && hourIndex * 60 + minute < calendarNow.hour * 60 + calendarNow.minute);
                    return (
                      <button
                        className={`quarter-slot ${isPast ? "past" : "available"}`}
                        disabled={isPast}
                        aria-label={isPast ? "Past time" : `Schedule ${formatPickerLabel(date)} at ${formatTime(hourIndex, minute)}`}
                        onClick={() => onSlot(currentDate, hourIndex, minute)}
                        key={minute}
                      >{!isPast && <span className="schedule-hint">Schedule event</span>}</button>
                    );
                  })}
                  {matching.map((event, index) => {
                    const duration = Math.max(15, event.endHour * 60 + event.endMinute - (event.hour * 60 + event.minute));
                    // Slot colour reflects the live event state so the user can
                    // scan the week: cancelled (red strikethrough), any attendee
                    // declined (red), pending proposal (blue dashed), all
                    // accepted (green), otherwise default mint.
                    const stateClass =
                      event.statusLabel === "Cancelled" ? "event-pill--cancelled"
                      : event.previewAttendees.some((a) => a.status === "Declined") ? "event-pill--declined"
                      : (event.proposals?.length ?? 0) > 0 ? "event-pill--proposed"
                      : event.previewAttendees.length > 0 && event.previewAttendees.every((a) => a.status === "Accepted") ? "event-pill--accepted"
                      : "";
                    return (
                      <button
                        type="button"
                        className={`event-pill quarter-event event-pill--clickable ${stateClass}`}
                        style={{ top: `${(event.minute / 60) * HOUR_PX + 1}px`, height: `${Math.max(22, (duration / 60) * HOUR_PX - 2)}px`, zIndex: 10 + index }}
                        key={event.id}
                        onClick={(click) => { click.stopPropagation(); onEventClick(event); }}
                      >{event.title}</button>
                    );
                  })}
                  {currentDate === calendarNow.date && hourIndex === calendarNow.hour && <span className="current-time-line" style={{ top: `${(calendarNow.minute / 60) * HOUR_PX}px` }} />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function MainCalendar({ events, selectedDate, onSelectDate, onSlot, onEventClick }: { events: CalendarEventItem[]; selectedDate: Date; onSelectDate: (date: Date) => void; onSlot: (date: string, hour: number, minute: number) => void; onEventClick: (event: CalendarEventItem) => void }) {
  const weekStart = startOfWeek(selectedDate);
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  return (
    <main className="calendar-main">
      <div className="calendar-toolbar">
        <h1>{formatWeekRange(weekStart)}</h1>
        <div className="calendar-controls">
          <button className="today-button" onClick={() => onSelectDate(getTodayUtcPlusTwo())}>Today</button>
          <div className="view-toggle"><button>Day</button><button className="selected">Week</button><button>Month</button></div>
          <button className="icon-button" aria-label="Calendar filters"><SlidersHorizontal size={16} /></button>
          <div className="previous-next"><button aria-label="Previous week" onClick={() => onSelectDate(addDays(selectedDate, -7))}><ChevronLeft size={16} /></button><button aria-label="Next week" onClick={() => onSelectDate(addDays(selectedDate, 7))}><ChevronRight size={16} /></button></div>
        </div>
      </div>
      <CalendarGrid events={events} onSlot={onSlot} onEventClick={onEventClick} weekDates={weekDates} selectedDate={selectedDate} />
    </main>
  );
}

export default function CalendarPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(getTodayUtcPlusTwo);
  const [slot, setSlot] = useState(getNextQuarterSlot);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [creatorMode, setCreatorMode] = useState<CreatorMode>("smart");
  const [rescheduleTarget, setRescheduleTarget] = useState<{ event: CalendarEventItem; proposed: { attendeeEmail: string; slotLabel: string; note: string | null } | null } | null>(null);
  const [previewEvent, setPreviewEvent] = useState<CalendarEventItem | null>(null);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadEvents = useCallback(async () => {
    const response = await fetch("/api/events", { cache: "no-store" });
    if (!response.ok) return [];
    const mapped = ((await response.json()) as EventDto[]).map(mapEvent);
    setEvents(mapped);
    return mapped;
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadEvents(), 0);
    return () => window.clearTimeout(timer);
  }, [loadEvents]);
  useEffect(() => {
    if (!session?.accessToken) return;
    const timer = window.setInterval(async () => {
      const response = await fetch("/api/sync", { method: "POST" }).catch(() => null);
      if (response && !response.ok) {
        notifyIfGoogleSessionExpired(response, await response.json().catch(() => null));
      }
      await loadEvents();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [session?.accessToken, loadEvents]);

  const openCreator = (date?: string, hour?: number, minute?: number) => {
    setSlot(date !== undefined && hour !== undefined && minute !== undefined ? { date, hour, minute } : getNextQuarterSlot());
    setChooserOpen(true);
  };
  const chooseCreator = (mode: CreatorMode) => {
    setChooserOpen(false);
    setCreatorMode(mode);
    setDrawerOpen(true);
  };
  const syncEvent = async (event: CalendarEventItem) => {
    setSyncing(true);
    try {
      const response = await fetch(`/api/sync?id=${encodeURIComponent(event.id)}`, { method: "POST" });
      if (!response.ok) {
        notifyIfGoogleSessionExpired(response, await response.json().catch(() => null));
        return;
      }
      const fresh = await loadEvents();
      setPreviewEvent(fresh.find((item) => item.id === event.id) ?? event);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <Header kicker="Calendar" onQuickAdd={() => openCreator()} />
      {bannerVisible && (
        <div className="sync-banner">
          <div><RefreshCw size={14} /><span>Google Calendar and Gmail are connected — attendee replies are synchronized here.</span><button onClick={() => previewEvent ? void syncEvent(previewEvent) : void loadEvents()}>Sync My Calendar</button></div>
          <button onClick={() => setBannerVisible(false)} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}
      <div className="calendar-workspace">
        <CalendarPanel onSchedule={() => openCreator()} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        <MainCalendar events={events} selectedDate={selectedDate} onSelectDate={setSelectedDate} onSlot={openCreator} onEventClick={setPreviewEvent} />
      </div>
      <CreatorDialog open={chooserOpen} onClose={() => setChooserOpen(false)} onSelect={chooseCreator} />
      {rescheduleTarget && (
        <RescheduleDrawer
          event={rescheduleTarget.event}
          proposed={rescheduleTarget.proposed}
          onClose={() => setRescheduleTarget(null)}
          onUpdated={() => {
            setRescheduleTarget(null);
            void loadEvents();
            window.setTimeout(() => void loadEvents(), 1800);
          }}
        />
      )}
      <EventDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slot={slot}
        mode={creatorMode}
        onCreate={() => {
          setDrawerOpen(false);
          void loadEvents();
          window.setTimeout(() => void loadEvents(), 1800);
        }}
      />
      <EventPreviewDialog
        event={previewEvent}
        onClose={() => setPreviewEvent(null)}
        onRefresh={(event) => void syncEvent(event)}
        refreshing={syncing}
        onReschedule={(event) => {
          const pending = event.proposals?.[0] ?? null;
          setRescheduleTarget(pending ? { event, proposed: pending } : { event, proposed: null });
        }}
        onDeleted={() => {
          void loadEvents();
          // Keep the dialog open showing the cancelled state, but refresh the
          // underlying list a beat later to pick up the CANCELLED status.
          window.setTimeout(() => void loadEvents(), 600);
        }}
      />
    </>
  );
}
