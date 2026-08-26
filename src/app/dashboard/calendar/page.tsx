"use client";

import { RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Header } from "@/components/chrome";
import {
  CalendarSidePanel,
  WeekGrid,
} from "@/components/calendar/calendar-ui";
import { getTodayUtcPlusTwo } from "@/lib/datetime-proto";
import { EventDrawer } from "@/components/event-drawer";
import { EventPreviewDialog } from "@/components/event-preview";
import type { CalendarEventItem, PreviewStatus } from "@/lib/calendar-types";
import { notifyIfGoogleSessionExpired } from "@/lib/google-session-client";
import type { EventDto } from "@/types/event";
import {
  addDays,
  formatWeekRange,
  startOfWeek,
} from "@/lib/datetime-proto";

function eventDateParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
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
  const start = eventDateParts(event.start);
  const end = eventDateParts(event.end);
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
    statusLabel: "Scheduled",
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

export default function CalendarPage() {
  const { data: session } = useSession();
  const [selectedDate, setSelectedDate] = useState<Date>(() => getTodayUtcPlusTwo());
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [previewEvent, setPreviewEvent] = useState<CalendarEventItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [slot, setSlot] = useState({ date: "", hour: 9, minute: 0 });
  const [syncing, setSyncing] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(true);

  const loadEvents = useCallback(async () => {
    if (!session?.user?.email) return;
    try {
      const res = await fetch("/api/events");
      if (!res.ok) return;
      const list = (await res.json()) as EventDto[];
      setEvents(list.map(mapEvent));
    } catch {
      // network hiccups are retried on next sync click
    }
  }, [session?.user?.email]);

  // Initial + session-driven load. The setState happens inside the async
  // callback after await, not synchronously in the effect body.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!session?.user?.email || cancelled) return;
      try {
        const res = await fetch("/api/events");
        if (!res.ok || cancelled) return;
        const list = (await res.json()) as EventDto[];
        if (!cancelled) setEvents(list.map(mapEvent));
      } catch { /* retried via Sync button */ }
    };
    void run();
    return () => { cancelled = true; };
  }, [session?.user?.email]);

  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);
  const weekDates = useMemo(() => [...Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))], [weekStart]);
  const openCreator = () => { setSlot({ date: "", hour: 9, minute: 0 }); setDrawerOpen(true); };
  const openSlot = (date: string, hour: number, minute: number) => { setSlot({ date, hour, minute }); setDrawerOpen(true); };

  const syncEvent = async (event: CalendarEventItem) => {
    setSyncing(true);
    try {
      const response = await fetch(`/api/sync?id=${encodeURIComponent(event.id)}`, { method: "POST" });
      if (!response.ok) {
        notifyIfGoogleSessionExpired(response, await response.json().catch(() => null));
        return;
      }
      const fresh = await loadEvents();
      void fresh;
      setEvents((current) => current); // keep reference stable; re-render picks up new data
    } finally {
      setSyncing(false);
    }
  };

  // After a create, refetch and surface the freshest row for the preview.
  const handleCreated = useCallback(() => {
    void loadEvents();
  }, [loadEvents]);

  return (
    <>
      <Header kicker={<><span className="kicker-muted">Calendar</span></>} onQuickAdd={openCreator} />
      {bannerVisible && (
        <div className="sync-banner">
          <div><RefreshCw size={14} /><span>Sync your Gmail or Outlook to get all your events in one calendar</span><button onClick={() => void loadEvents()}>Sync My Calendar</button></div>
          <button onClick={() => setBannerVisible(false)} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}
      <div className="calendar-workspace">
        <CalendarSidePanel onSchedule={openCreator} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        <main className="calendar-main">
          <header className="calendar-toolbar">
            <h1>{formatWeekRange(weekStart)}</h1>
          </header>
          <WeekGrid
            events={events}
            selectedDate={selectedDate}
            weekDates={weekDates}
            onSlot={openSlot}
            onEventClick={setPreviewEvent}
          />
        </main>
      </div>
      <EventDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slot={slot}
        onCreate={() => {
          setDrawerOpen(false);
          handleCreated();
        }}
      />
      <EventPreviewDialog
        event={previewEvent}
        onClose={() => setPreviewEvent(null)}
        onRefresh={(event) => void syncEvent(event)}
        refreshing={syncing}
      />
    </>
  );
}
