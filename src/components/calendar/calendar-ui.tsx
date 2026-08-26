"use client";

/**
 * Shared prototype-style calendar building blocks.
 * Extracted from the prototype's app/page.tsx so pages stay lean and no
 * markup is duplicated between routes.
 */

import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { dateKey, formatMonthYear, formatPickerLabel, formatTime, getTodayUtcPlusTwo, getUtcPlusTwoCalendarTime } from "@/lib/datetime-proto";

export const weekdayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const hours = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, "0")}:00`);
const quarterHours = [0, 15, 30, 45];
const HOUR_PX = 62;

export function MiniCalendar({ selectedDate, onSelectDate }: { selectedDate: Date; onSelectDate: (date: Date) => void }) {
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

export function CalendarSidePanel({ onSchedule, selectedDate, onSelectDate }: { onSchedule: () => void; selectedDate: Date; onSelectDate: (date: Date) => void }) {
  const [personalOn, setPersonalOn] = useState(true);
  const [groupOn, setGroupOn] = useState(false);
  return (
    <aside className="calendar-panel">
      <div className="calendar-panel-title"><h2>Calendar</h2><button onClick={onSchedule}><CalendarDays size={16} /> Schedule</button></div>
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

export type WeekEvent = {
  id: string;
  date: string;
  hour: number;
  minute: number;
  endHour: number;
  endMinute: number;
};

export function WeekGrid<TEvent extends WeekEvent & { title: string }>({ events, onSlot, onEventClick, weekDates, selectedDate }: { events: TEvent[]; onSlot: (date: string, hour: number, minute: number) => void; onEventClick: (event: TEvent) => void; weekDates: Date[]; selectedDate: Date }) {
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
                    return (
                      <button
                        type="button"
                        className="calendar-event"
                        style={{ height: Math.round(duration * (HOUR_PX / 60)) - 4, zIndex: 40 + index }}
                        onClick={() => onEventClick(event)}
                        key={event.id}
                      ><span>{event.title}</span></button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
