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
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { Header } from "@/components/chrome";
import { EventDrawer, type EventMeta, type TimedDate } from "@/components/event-drawer";
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
  getCalendarOffsetLabel,
  getNextQuarterSlot,
  getTodayUtcPlusTwo,
  getUtcPlusTwoCalendarTime,
  startOfWeek,
} from "@/lib/datetime-proto";

const weekdayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const hours = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, "0")}:00`);
const quarterHours = [0, 15, 30, 45];
const HOUR_PX = 120;

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
  if (type === "candidate") return "Candidate";
  if (type === "contact") return "Contact";
  if (type === "internal") return "Internal attendee";
  return "Attendee";
}

function initials(value: string) {
  return value.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "OR";
}

function mapEvent(event: EventDto, completedIds?: Set<string>, currentOrganizer?: { email?: string | null; name?: string | null; avatar?: string | null }): CalendarEventItem {
  const source = event.source === "GOOGLE" ? "GOOGLE" : "WIGGLI";
  const start = eventDateParts(event.start, event.timezone);
  const end = eventDateParts(event.end, event.timezone);
  const organizerMatchesSession = currentOrganizer?.email?.toLowerCase() === event.organizerEmail.toLowerCase();
  const organizerName = event.previewData?.organizerName || (organizerMatchesSession ? currentOrganizer?.name : null) || event.organizerEmail.split("@")[0];
  return {
    id: event.id,
    googleEventId: event.googleEventId,
    source,
    date: start.date,
    hour: start.hour,
    minute: start.minute,
    endHour: end.hour,
    endMinute: end.minute,
    title: event.summary,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    timezone: event.timezone,
    organizerName,
    organizerInitials: initials(organizerName),
    organizerAvatar: source === "GOOGLE" ? undefined : event.previewData?.organizerAvatar || (organizerMatchesSession ? currentOrganizer?.avatar || undefined : undefined),
    eventType: event.eventType ?? (event.summary.toLowerCase().includes("interview") ? "Interview" : "Meeting"),
    statusLabel: (event as { status?: string }).status === "CANCELLED"
      ? "Cancelled"
      : source === "GOOGLE" ? "Synced"
      : completedIds?.has(event.id) ? "Completed" : "Scheduled",
    syncState: (event as { syncState?: CalendarEventItem["syncState"] }).syncState,
    proposals: (event.proposals ?? []).filter((p) => p.status === "PENDING").map((p) => ({
      id: p.id,
      attendeeEmail: p.attendeeEmail,
      slotLabel: p.slotLabel,
      note: p.note,
      createdAt: p.createdAt,
    })),
    reminderLabel: event.reminderMinutes == null ? "Calendar default" : `${event.reminderMinutes} minutes before`,
    reminderMinutes: event.reminderMinutes,
    eventUrl: event.hangoutLink ?? (event.location?.startsWith("http") ? event.location : undefined),
    meetingLinks: event.previewData?.meetingLinks?.length ? event.previewData.meetingLinks : event.hangoutLink ? [{ provider: "Google Meet", url: event.hangoutLink }] : event.location?.startsWith("http") ? [{ provider: "Meeting", url: event.location }] : [],
    locations: event.previewData?.locations?.length ? event.previewData.locations : event.location && !event.location.startsWith("http") ? [{ label: event.location }] : [],
    linkedTo: event.previewData?.linkedTo ?? [],
    aiNotetaker: event.previewData?.aiNotetaker === true,
    previewAttendees: event.attendees.map((attendee, index) => ({
      id: attendee.id,
      name: attendee.name ?? attendee.email,
      email: attendee.email,
      role: roleFor(attendee.type),
      avatar: source === "GOOGLE" ? "" : event.previewData?.attendeeAvatars?.[attendee.email.toLowerCase()] ?? `/avatars/avatar-${(index % 24) + 1}.webp`,
      status: mapStatus(attendee.rsvp),
      comment: attendee.comment,
    })),
  };
}

function buildDraftEvents(title: string, occurrences: TimedDate[], meta?: EventMeta, statusLabel: "Draft" | "Logged" | "Scheduled" = "Draft", organizer?: { name?: string | null; avatar?: string | null }): CalendarEventItem[] {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris";
  return occurrences.map((occurrence, index) => {
    const [hour, minute] = occurrence.start.split(":").map(Number);
    const [endHour, endMinute] = occurrence.end.split(":").map(Number);
    const locationLabel = meta?.location?.type === "company"
      ? meta.location.office
      : meta?.location?.type === "custom"
        ? [meta.location.custom.street, meta.location.custom.number, meta.location.custom.box, meta.location.custom.zip, meta.location.custom.city, meta.location.custom.country].filter(Boolean).join(", ") || meta.location.custom.query
        : undefined;
    const onlineUrl = meta?.location?.type === "online" ? meta.location.meetLink || meta.location.manualUrl : undefined;
    return {
      id: `draft-${Date.now()}-${index}`,
      googleEventId: null,
      source: "WIGGLI",
      date: occurrence.date,
      hour,
      minute,
      endHour,
      endMinute,
      title,
      description: meta?.description || undefined,
      location: locationLabel || undefined,
      timezone,
      organizerName: organizer?.name?.trim() || "Organizer",
      organizerInitials: initials(organizer?.name || "Organizer"),
      organizerAvatar: organizer?.avatar || undefined,
      eventType: meta?.eventType || "Meeting",
      statusLabel,
      reminderLabel: meta?.reminderLabel || "Calendar default",
      eventUrl: onlineUrl || undefined,
      meetingLinks: onlineUrl ? [{ provider: meta?.location?.provider || "Meeting", url: onlineUrl }] : [],
      locations: locationLabel ? [{ label: locationLabel, type: meta?.location?.type === "company" ? "Company office" : "Another location" }] : [],
      previewAttendees: (meta?.attendees ?? []).map((attendee) => ({
        id: attendee.id,
        name: attendee.name,
        email: attendee.email,
        role: attendee.type === "contact" ? "Contact" : attendee.type === "internal" ? "Internal attendee" : "Candidate",
        avatar: attendee.avatar,
        status: "Pending" as const,
      })),
      proposals: [],
      linkedTo: (meta?.linkedRecords ?? []).map((record) => ({
        type: record.type,
        label: String(record.item?.name ?? record.item?.title ?? record.item?.organization ?? record.type),
        avatar: typeof record.item?.avatar === "string" ? record.item.avatar : undefined,
      })),
    };
  });
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
        <div className="week-head corner">{getCalendarOffsetLabel()}</div>
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
                    const unanimousResponse = event.source !== "GOOGLE" && event.statusLabel === "Scheduled" && event.previewAttendees.length > 0 && event.previewAttendees.every((attendee) => attendee.status === event.previewAttendees[0].status)
                      ? event.previewAttendees[0].status.toLowerCase()
                      : null;
                    const responseClass = unanimousResponse ? `event-pill--response-${unanimousResponse}` : "";
                    const showAvatarStates = event.source !== "GOOGLE" && event.statusLabel !== "Draft" && event.statusLabel !== "Logged" && event.statusLabel !== "Cancelled";
                    const stateClass = event.source === "GOOGLE"
                      ? "event-pill--google"
                      : event.statusLabel === "Cancelled" ? "event-pill--cancelled"
                        : event.statusLabel === "Completed" ? "event-pill--completed"
                          : event.statusLabel === "Draft" ? "event-pill--draft"
                            : event.statusLabel === "Logged" ? "event-pill--logged"
                              : "event-pill--scheduled";
                    return (
                      <button
                        type="button"
                        className={`event-pill quarter-event event-pill--clickable ${stateClass} ${responseClass}`}
                        style={{ top: `${(event.minute / 60) * HOUR_PX + 1}px`, height: `${Math.max(30, (duration / 60) * HOUR_PX - 2)}px`, zIndex: 10 + index }}
                        key={event.id}
                        onClick={(click) => { click.stopPropagation(); onEventClick(event); }}
                      >
                        <span className="event-pill-copy"><span className="event-pill-time">{String(event.hour).padStart(2, "0")}:{String(event.minute).padStart(2, "0")}</span><span className="event-pill-title">{event.title}</span></span>
                        {event.previewAttendees.length > 0 && (
                          <span className="event-pill-avatars" aria-label={`${event.previewAttendees.length} attendees`}>
                            {event.previewAttendees.slice(0, 4).map((attendee) => (
                              <span className={`event-pill-avatar ${showAvatarStates ? `event-pill-avatar--${attendee.status.toLowerCase()}` : ""}`} key={attendee.id} title={`${attendee.name}${showAvatarStates ? ` — ${attendee.status}` : ""}`}>
                                {event.source === "GOOGLE"
                                  ? <span className="event-pill-avatar-default"><UserRound size={13} strokeWidth={1.8} /></span>
                                  : <Image src={attendee.avatar} alt="" width={18} height={18} />}
                              </span>
                            ))}
                            {event.previewAttendees.length > 4 && <span className="event-pill-avatar-count">+{event.previewAttendees.length - 4}</span>}
                          </span>
                        )}
                        {event.source === "GOOGLE" && <span className="event-pill-calendar-icon" title="Synced from Google Calendar"><Image src="/google-calendar.png" alt="Google Calendar" width={15} height={15} /></span>}
                      </button>
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

function MainCalendar({ events, selectedDate, onSelectDate, onSlot, onEventClick, onSync, syncing, syncAvailable }: { events: CalendarEventItem[]; selectedDate: Date; onSelectDate: (date: Date) => void; onSlot: (date: string, hour: number, minute: number) => void; onEventClick: (event: CalendarEventItem) => void; onSync: () => void; syncing: boolean; syncAvailable: boolean }) {
  const weekStart = startOfWeek(selectedDate);
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  return (
    <main className="calendar-main">
      <div className="calendar-toolbar">
        <h1>{formatWeekRange(weekStart)}</h1>
        <div className="calendar-controls">
          <button className="today-button" onClick={() => onSelectDate(getTodayUtcPlusTwo())}>Today</button>
          <button className="calendar-sync-button" onClick={onSync} disabled={syncing || !syncAvailable} title="Sync events from Google Calendar" aria-label="Sync events from Google Calendar"><RefreshCw size={14} className={syncing ? "animate-spin" : ""} /><span>{syncing ? "Syncing…" : "Sync"}</span></button>
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
  const [completedEventIds, setCompletedEventIds] = useState<Set<string>>(new Set());
  const [draftEvents, setDraftEvents] = useState<CalendarEventItem[]>([]);
  const persistenceReady = useRef(false);
  const [selectedDate, setSelectedDate] = useState(getTodayUtcPlusTwo);
  const [slot, setSlot] = useState(getNextQuarterSlot);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<{ event: CalendarEventItem; proposed: { attendeeEmail: string; slotLabel: string; note: string | null } | null; isEdit: boolean; initialStep?: 1 | 2 } | null>(null);
  const [previewEvent, setPreviewEvent] = useState<CalendarEventItem | null>(null);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedDrafts = window.localStorage.getItem("wiggli-calendar-drafts");
        const savedCompleted = window.localStorage.getItem("wiggli-calendar-completed");
        if (savedDrafts) setDraftEvents(JSON.parse(savedDrafts) as CalendarEventItem[]);
        if (savedCompleted) setCompletedEventIds(new Set(JSON.parse(savedCompleted) as string[]));
      } catch { /* storage is optional */ }
      persistenceReady.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!persistenceReady.current) return;
    try { window.localStorage.setItem("wiggli-calendar-drafts", JSON.stringify(draftEvents)); } catch { /* storage is optional */ }
  }, [draftEvents]);
  useEffect(() => {
    if (!persistenceReady.current) return;
    try { window.localStorage.setItem("wiggli-calendar-completed", JSON.stringify([...completedEventIds])); } catch { /* storage is optional */ }
  }, [completedEventIds]);
  useEffect(() => {
    const organizerName = session?.user?.name?.trim();
    const organizerAvatar = session?.user?.image;
    if (!organizerName) return;
    const timer = window.setTimeout(() => {
      setDraftEvents((current) => current.map((event) =>
        event.organizerName === "You" || event.organizerName === "Organizer"
          ? { ...event, organizerName, organizerInitials: initials(organizerName), organizerAvatar: organizerAvatar || event.organizerAvatar }
          : event
      ));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [session?.user?.image, session?.user?.name]);

  const loadEvents = useCallback(async () => {
    const response = await fetch("/api/events", { cache: "no-store" });
    if (!response.ok) return [];
    const mapped = ((await response.json()) as EventDto[]).map((event) => mapEvent(event, completedEventIds, { email: session?.user?.email, name: session?.user?.name, avatar: session?.user?.image }));
    setEvents(mapped);
    return mapped;
  }, [completedEventIds, session?.user?.email, session?.user?.image, session?.user?.name]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadEvents(), 0);
    return () => window.clearTimeout(timer);
  }, [loadEvents]);
  const openCreator = (date?: string, hour?: number, minute?: number) => {
    setSlot(date !== undefined && hour !== undefined && minute !== undefined ? { date, hour, minute } : getNextQuarterSlot());
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
  const syncCalendar = async () => {
    if (!session?.accessToken) {
      await loadEvents();
      return;
    }
    setSyncing(true);
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      if (!response.ok) {
        notifyIfGoogleSessionExpired(response, await response.json().catch(() => null));
        return;
      }
      await loadEvents();
    } finally {
      setSyncing(false);
    }
  };
  useEffect(() => {
    if (!session?.accessToken) return;
    const initialSync = window.setTimeout(() => void syncCalendar(), 0);
    const timer = window.setInterval(() => void syncCalendar(), 15_000);
    return () => { window.clearTimeout(initialSync); window.clearInterval(timer); };
    // syncCalendar intentionally uses the current session/loadEvents closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken]);

  return (
    <>
      <Header kicker="Calendar" onQuickAdd={() => openCreator()} />
      {bannerVisible && (
        <div className="sync-banner">
          <div><RefreshCw size={14} /><span>Google Calendar and Gmail are connected — events and attendee replies stay synchronized here.</span><button onClick={() => previewEvent ? void syncEvent(previewEvent) : void syncCalendar()}>Sync My Calendar</button></div>
          <button onClick={() => setBannerVisible(false)} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}
      <div className="calendar-workspace">
        <CalendarPanel onSchedule={() => openCreator()} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        <MainCalendar events={[...events, ...draftEvents]} selectedDate={selectedDate} onSelectDate={setSelectedDate} onSlot={openCreator} onEventClick={setPreviewEvent} onSync={() => void syncCalendar()} syncing={syncing} syncAvailable={Boolean(session?.accessToken)} />
      </div>
      {/* Reschedule drawer — reuses EventDrawer in reschedule mode */}
      {rescheduleTarget && (() => {
        const ev = rescheduleTarget.event;
        const editingEvent = {
          id: ev.id,
          title: ev.title,
          date: ev.date,
          hour: ev.hour,
          minute: ev.minute,
          endHour: ev.endHour,
          endMinute: ev.endMinute,
          eventType: ev.eventType,
          description: ev.description,
          storedAttendees: ev.previewAttendees.map((a) => ({
            id: a.id,
            name: a.name,
            email: a.email,
            type: a.role === "Candidate" ? "candidate" : a.role === "Internal attendee" || a.role === "Organizer" ? "internal" : "contact",
            avatar: a.avatar,
            locked: false,
          })),
          // Rebuild the drawer's LocationSnapshot from the stored event so the
          // type (Company address / Custom / Online) round-trips — not just the
          // flattened label, which otherwise reopens as "Custom location".
          // Google Meet conferences are left null (SINGLE-LINK RULE) so the
          // reschedule never duplicates the conference link into the location.
          storedLocation: ev.meetingLinks?.[0]?.provider === "Google Meet"
            ? null
            : (ev.meetingLinks?.[0]?.url || (ev.location && ev.location.startsWith("http") ? ev.location : null))
              ? {
                  open: true,
                  type: "online" as const,
                  office: "",
                  provider: "manual" as const,
                  custom: { street: "", number: "", box: "", city: "", zip: "", country: "", query: "" },
                  manualUrl: ev.meetingLinks?.[0]?.url ?? ev.location,
                }
              : ev.location && !ev.location.startsWith("http")
                ? (ev.locations?.[0]?.type === "Company office"
                    ? { open: true, type: "company" as const, office: ev.location, custom: { street: "", number: "", box: "", city: "", zip: "", country: "", query: "" }, provider: undefined }
                    : { open: true, type: "custom" as const, office: "", custom: { street: "", number: "", box: "", city: "", zip: "", country: "", query: ev.location }, provider: undefined })
                : null,
          storedReminder: ev.reminderMinutes ?? null,
          storedOrganization: null,
          storedContext: null,
        };
        return (
          <EventDrawer
            open={true}
            onClose={() => setRescheduleTarget(null)}
            slot={{ date: ev.date, hour: ev.hour, minute: ev.minute }}
            editingEvent={editingEvent}
            rescheduleDate={rescheduleTarget.initialStep === 2 ? null : ev.date}
            isEdit={rescheduleTarget.isEdit}
            initialStep={rescheduleTarget.initialStep}
            onRescheduleComplete={() => {
              setRescheduleTarget(null);
              void loadEvents();
              window.setTimeout(() => void loadEvents(), 1800);
            }}
            onCreate={(title, occurrences, meta) => {
              if (rescheduleTarget.initialStep === 2) {
                setDraftEvents((current) => current.filter((item) => item.id !== ev.id));
                setRescheduleTarget(null);
                void loadEvents();
                window.setTimeout(() => void loadEvents(), 1800);
                return;
              }
              const replacements = buildDraftEvents(title || "Event", occurrences, meta, "Draft", { name: session?.user?.name, avatar: session?.user?.image });
              setDraftEvents((current) => [...current.filter((item) => item.id !== ev.id), ...replacements]);
            }}
          />
        );
      })()}
      <EventDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slot={slot}
        mode="smart"
        onCreate={(title, occurrences, meta) => {
          setDrawerOpen(false);
          if (meta?.status === "DRAFT" || meta?.status === "LOGGED") {
            const statusLabel = meta?.status === "DRAFT" ? "Draft" : meta?.status === "LOGGED" ? "Logged" : "Scheduled";
            setDraftEvents((current) => [...current, ...buildDraftEvents(title || "Event", occurrences, meta, statusLabel, { name: session?.user?.name, avatar: session?.user?.image })]);
            return;
          }
          void loadEvents();
          window.setTimeout(() => void loadEvents(), 1800);
        }}
      />
      <EventPreviewDialog
        event={previewEvent}
        onClose={() => setPreviewEvent(null)}
        onRefresh={(event) => void syncEvent(event)}
        refreshing={syncing}
        onComplete={(event) => {
          setCompletedEventIds((current) => new Set(current).add(event.id));
          setEvents((current) => current.map((item) => item.id === event.id ? { ...item, statusLabel: "Completed" } : item));
          setPreviewEvent((current) => current?.id === event.id ? { ...current, statusLabel: "Completed" } : current);
        }}
        onReschedule={(event) => {
          setPreviewEvent(null);
          const pending = event.proposals?.[0] ?? null;
          setRescheduleTarget(pending ? { event, proposed: pending, isEdit: false } : { event, proposed: null, isEdit: false });
        }}
        onSchedule={(event) => {
          setPreviewEvent(null);
          setRescheduleTarget({ event, proposed: null, isEdit: false, initialStep: 2 });
        }}
        onEdit={(event) => {
          setPreviewEvent(null);
          setRescheduleTarget({ event, proposed: null, isEdit: true });
        }}
        onDeleted={(deletedEvent) => {
          if (deletedEvent?.id.startsWith("draft-")) {
            setDraftEvents((current) => current.filter((item) => item.id !== deletedEvent.id));
          }
          void loadEvents();
          window.setTimeout(() => void loadEvents(), 600);
        }}
      />
    </>
  );
}
