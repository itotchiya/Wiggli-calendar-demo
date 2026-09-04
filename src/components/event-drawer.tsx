"use client";

import {
  AlarmClock,
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  ContactRound,
  Copy,
  ExternalLink,
  Eye,
  Info,
  Link2,
  Lock,
  Mail,
  Map,
  MapPin,
  MessageSquareText,
  Monitor,
  Loader2,
  PenLine,
  Plus,
  Search,
  Send,
  Sparkles,
  Target,
  Type,
  UserRound,
  UsersRound,
  Video,
  X,
  Save,
  ListTree
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { showToast } from "@/components/toaster";
import { RichBodyEditor, insertIntoActiveEditor, htmlWithVarTokens, replaceSmartContextBlock } from "@/components/rich-body-editor";
import { INVITE_VARIABLES } from "@/lib/invite-variables";
import { notifyIfGoogleSessionExpired } from "@/lib/google-session-client";
import { buildSmartInvitationHtml } from "@/lib/smart-email-template";
import {
  buildSmartAudiences,
  LINKED_VARIABLE_BY_TYPE,
  type SmartEventDocument,
  type SmartEventSlot,
  type SmartLinkedRecord,
} from "@/lib/smart-event-schema";

import { useEventTypes } from "@/lib/event-types";
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

type IconType = React.ComponentType<{ size?: number; strokeWidth?: number }>;

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return <button className={`toggle ${on ? "on" : ""}`} onClick={onClick} role="switch" aria-checked={on} aria-label={label}><span /></button>;
}

export type TimedDate = { date: string; endDate?: string; start: string; end: string; isRange?: boolean };
type ReminderUnit = "minutes" | "hours" | "days" | "weeks";
type AttendeeType = "candidate" | "contact" | "internal";
type Organization = { id: string; name: string; initials: string; relationship: "Holding" | "Subsidiary" };
export type LinkedContext = { id: string; kind: "job" | "opportunity"; title: string; contract: "Permanent" | "Temporary"; organizationId: string; organization: string; organizationInitials: string };
type AttendeeSchedule = { status: "Busy" | "Out of Office" | "Awaiting response" | "Confirmed"; date: string; time?: string };
export type AttendeePerson = { id: string; name: string; email: string; type: AttendeeType; avatar: string; links?: LinkedContext[]; organizations?: string[]; schedules?: AttendeeSchedule[]; locked?: boolean };

function multipleDateError(slotCount: number, attendees: AttendeePerson[]): string | null {
  if (slotCount <= 1) return null;
  return "Multiple slots are only available for one candidate";
}

const organizations: Record<string, Organization> = {
  gm: { id: "gm", name: "General Motors", initials: "GM", relationship: "Holding" },
  nova: { id: "nova", name: "Nova Systems", initials: "NS", relationship: "Subsidiary" },
  cobalt: { id: "cobalt", name: "Cobalt Industries", initials: "CI", relationship: "Subsidiary" },
  zephyr: { id: "zephyr", name: "Zephyr Labs", initials: "ZL", relationship: "Subsidiary" },
  "jacquet-scrl": { id: "jacquet-scrl", name: "Jacquet SCRL", initials: "JS", relationship: "Holding" },
};

const linkedContexts: Record<string, LinkedContext> = {
  frontend: { id: "frontend", kind: "job", title: "Frontend developer", contract: "Permanent", organizationId: "gm", organization: "General Motors", organizationInitials: "GM" },
  backend: { id: "backend", kind: "job", title: "Backend developer", contract: "Temporary", organizationId: "gm", organization: "General Motors", organizationInitials: "GM" },
  engineering: { id: "engineering", kind: "opportunity", title: "Engineering recruitment", contract: "Permanent", organizationId: "gm", organization: "General Motors", organizationInitials: "GM" },
  development: { id: "development", kind: "opportunity", title: "New development team", contract: "Temporary", organizationId: "gm", organization: "General Motors", organizationInitials: "GM" },
  novaFrontend: { id: "nova-frontend", kind: "job", title: "Product frontend engineer", contract: "Permanent", organizationId: "nova", organization: "Nova Systems", organizationInitials: "NS" },
  novaPlatform: { id: "nova-platform", kind: "opportunity", title: "Platform expansion", contract: "Temporary", organizationId: "nova", organization: "Nova Systems", organizationInitials: "NS" },
  cobaltDesign: { id: "cobalt-design", kind: "job", title: "Product designer", contract: "Permanent", organizationId: "cobalt", organization: "Cobalt Industries", organizationInitials: "CI" },
  zephyrResearch: { id: "zephyr-research", kind: "opportunity", title: "Research partnership", contract: "Temporary", organizationId: "zephyr", organization: "Zephyr Labs", organizationInitials: "ZL" },
  jacquetRND: { id: "jacquet-rnd", kind: "job", title: "R&D Chimistry", contract: "Permanent", organizationId: "jacquet-scrl", organization: "Jacquet SCRL", organizationInitials: "JS" },
};

const candidateLinks: Record<string, LinkedContext[]> = {
  "linksomoney": [linkedContexts.frontend],
  "luxqoox-candidate": [linkedContexts.backend],
  "ava-thompson": [linkedContexts.frontend],
  "ethan-patel": [linkedContexts.frontend, linkedContexts.backend, linkedContexts.engineering, linkedContexts.development],
  "sofia-morales": [linkedContexts.frontend, linkedContexts.novaFrontend, linkedContexts.novaPlatform],
  "jamal-washington": [],
  "linh-nguyen": [linkedContexts.engineering],
  "oliver-schmidt": [linkedContexts.backend, linkedContexts.development],
  "nadia-benali": [linkedContexts.frontend],
  "lucas-martin": [linkedContexts.backend, linkedContexts.engineering],
};

const internalSchedules: AttendeeSchedule[][] = [
  [{ status: "Busy", date: "05/08/2026", time: "13:00 – 15:00" }, { status: "Awaiting response", date: "12/08/2026" }, { status: "Confirmed", date: "25/08/2026" }],
  [{ status: "Out of Office", date: "09/08/2026", time: "09:00 – 17:00" }, { status: "Confirmed", date: "18/08/2026", time: "11:00 – 12:00" }],
  [{ status: "Awaiting response", date: "12/08/2026" }],
  [{ status: "Confirmed", date: "25/08/2026" }, { status: "Busy", date: "28/08/2026", time: "15:30 – 16:30" }],
  [{ status: "Busy", date: "06/08/2026", time: "10:30 – 11:30" }, { status: "Out of Office", date: "14/08/2026", time: "09:00 – 17:00" }],
  [{ status: "Confirmed", date: "07/08/2026", time: "14:00 – 15:00" }],
  [{ status: "Awaiting response", date: "13/08/2026" }, { status: "Confirmed", date: "20/08/2026", time: "09:30 – 10:00" }, { status: "Busy", date: "27/08/2026", time: "16:00 – 17:00" }],
  [{ status: "Out of Office", date: "18/08/2026", time: "09:00 – 17:00" }],
];

const contactOrganizations: Record<string, string[]> = {
  "linksomoney-contact": ["gm"],
  "luxqoox-contact": ["nova"],
  "victoria-sterling": ["gm", "nova", "cobalt", "zephyr", "jacquet-scrl"],
  "james-whitaker": ["gm", "jacquet-scrl"],
  "priya-kapoor": ["nova", "jacquet-scrl"],
  "robert-chen": ["jacquet-scrl"],
  "isabella-rossi": ["cobalt", "jacquet-scrl"],
  "daniel-okafor": ["zephyr", "jacquet-scrl"],
  "amelie-laurent": ["gm", "nova", "jacquet-scrl"],
};

const attendeeTypeLabels: Record<AttendeeType, string> = {
  candidate: "Candidate",
  contact: "Contact",
  internal: "Internal attendee",
};

const TEST_EMAILS = [
  "linksomoney@gmail.com",
  "luxqoox@gmail.com",
  "must.boufous@gmail.com",
  "must-boufous@outlook.com",
  "mustapha@wiggli.io",
] as const;

const INTERNAL_TEST_EMAILS = ["luxqoox@gmail.com", "mustapha@wiggli.io"] as const;

const randFrom = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

const attendeeDirectory: Record<AttendeeType, AttendeePerson[]> = {
  candidate: [
    ["linksomoney", "Links Omoney", randFrom(TEST_EMAILS)],
    // Keep one stable Outlook recipient available for calendar sync testing.
    ["luxqoox-candidate", "Lux Qoox", "must-boufous@outlook.com"],
    ["ava-thompson", "Ava Thompson", randFrom(TEST_EMAILS)],
    ["ethan-patel", "Ethan Patel", randFrom(TEST_EMAILS)],
    ["sofia-morales", "Sofia Morales", randFrom(TEST_EMAILS)],
    ["jamal-washington", "Jamal Washington", randFrom(TEST_EMAILS)],
    ["linh-nguyen", "Linh Nguyen", randFrom(TEST_EMAILS)],
    ["oliver-schmidt", "Oliver Schmidt", randFrom(TEST_EMAILS)],
    ["nadia-benali", "Nadia Benali", randFrom(TEST_EMAILS)],
    ["lucas-martin", "Lucas Martin", randFrom(TEST_EMAILS)],
  ].map(([id, name, email], index) => ({ id, name, email, type: "candidate" as const, avatar: `/avatars/avatar-${index + 1}.webp`, links: candidateLinks[id] })),
  contact: [
    ["linksomoney-contact", "Links Omoney", "linksomoney@gmail.com"],
    ["luxqoox-contact", "Lux Qoox", "linksomoney@gmail.com"],
    ["victoria-sterling", "Victoria Sterling", "linksomoney@gmail.com"],
    ["james-whitaker", "James Whitaker", "linksomoney@gmail.com"],
    ["priya-kapoor", "Priya Kapoor", "linksomoney@gmail.com"],
    ["robert-chen", "Robert Chen", "linksomoney@gmail.com"],
    ["isabella-rossi", "Isabella Rossi", "linksomoney@gmail.com"],
    ["daniel-okafor", "Daniel Okafor", "linksomoney@gmail.com"],
    ["amelie-laurent", "Amelie Laurent", "linksomoney@gmail.com"],
  ].map(([id, name, email], index) => ({ id, name, email, type: "contact" as const, avatar: `/avatars/avatar-${index + 16}.webp`, organizations: contactOrganizations[id] })),
  internal: [
    ["must-boufous", "Mustapha Boufous", randFrom(INTERNAL_TEST_EMAILS)],
    ["sarah-jenkins", "Sarah Jenkins", randFrom(INTERNAL_TEST_EMAILS)],
    ["david-park", "David Park", randFrom(INTERNAL_TEST_EMAILS)],
    ["emily-carter", "Emily Carter", randFrom(INTERNAL_TEST_EMAILS)],
    ["marcus-johnson", "Marcus Johnson", randFrom(INTERNAL_TEST_EMAILS)],
    ["aisha-patel", "Aisha Patel", randFrom(INTERNAL_TEST_EMAILS)],
    ["liam-obrien", "Liam O'Brien", randFrom(INTERNAL_TEST_EMAILS)],
    ["yasmine-bennis", "Yasmine Bennis", randFrom(INTERNAL_TEST_EMAILS)],
    ["noah-williams", "Noah Williams", randFrom(INTERNAL_TEST_EMAILS)],
  ].map(([id, name, email], index) => ({ id, name, email, type: "internal" as const, avatar: `/avatars/avatar-${((index + 22) % 24) + 1}.webp`, schedules: internalSchedules[index] })),
};

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function minutesToTime(value: number) {
  const normalized = Math.max(0, Math.min(Math.ceil(value / 15) * 15, 23 * 60 + 45));
  return formatCompactTime(Math.floor(normalized / 60), normalized % 60);
}

function addMinutesToDateTime(date: string, time: string, amount: number) {
  const total = timeToMinutes(time) + amount;
  return total >= 24 * 60
    ? { date: dateKey(addDays(parseDateKey(date), 1)), time: minutesToTime(total - 24 * 60) }
    : { date, time: minutesToTime(total) };
}

function dateTimeStamp(date: string, time: string) {
  return parseDateKey(date).getTime() + timeToMinutes(time) * 60_000;
}

function formatMonthDay(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", timeZone: "UTC" }).format(date);
}

function minimumTimeForDate(date: string) {
  const next = getNextQuarterSlot();
  return date === next.date ? formatCompactTime(next.hour, next.minute) : "00:00";
}

function DrawerTimeField({ value, label, min = "00:00", max = "23:45", onChange }: { value: string; label: string; min?: string; max?: string; onChange: (value: string) => void }) {
  const choices = Array.from({ length: 96 }, (_, index) => minutesToTime(index * 15)).filter((time) => time >= min && time <= max);
  return <span className="drawer-time-select"><select className="drawer-time-field" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>{choices.map((time) => <option value={time} key={time}>{time}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></span>;
}

function MultipleDatePicker({ value, minDate, onChange, getMultipleDateError, onMultipleDateError }: { value: TimedDate[]; minDate: string; onChange: (value: TimedDate[]) => void; getMultipleDateError?: (slotCount: number) => string | null; onMultipleDateError?: (message: string) => void }) {
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
    onChange(sortedSlots.map((slot, slotIndex) => {
      if (slotIndex !== index) return slot;
      const next = { ...slot, ...patch };
      return patch.start ? { ...next, end: endAfter(next.start, next.end) } : next;
    }));
  };

  const addSlot = (date: string) => {
    const error = getMultipleDateError?.(sortedSlots.length + 1);
    if (error) {
      onMultipleDateError?.(error);
      return;
    }
    const existing = sortedSlots.filter((slot) => slot.date === date);
    const template = existing.at(-1) ?? sortedSlots[0];
    const start = template ? minutesToTime(timeToMinutes(template.end) + 15) : minimumTimeForDate(date);
    if (timeToMinutes(start) > 23 * 60 + 30) return;
    const end = minutesToTime(timeToMinutes(start) + 15);
    setActiveDate(date);
    onChange([...sortedSlots, { date, start, end }].sort((a, b) => dateTimeStamp(a.date, a.start) - dateTimeStamp(b.date, b.start)));
  };

  const selectDate = (date: string) => {
    if (date < minDate) return;
    setActiveDate(date);
    if (selectedDates.has(date)) {
      const next = sortedSlots.filter((slot) => slot.date !== date);
      onChange(next);
      setActiveDate(next[0]?.date || minDate);
      return;
    }
    const error = getMultipleDateError?.(sortedSlots.length + 1);
    if (error) {
      onMultipleDateError?.(error);
      return;
    }
    const template = sortedSlots[0];
    const start = date === minDate
      ? (template?.start && template.start >= minimumTimeForDate(date) ? template.start : minimumTimeForDate(date))
      : template?.start ?? "09:00";
    onChange([...sortedSlots, { date, start, end: endAfter(start, template?.end ?? minutesToTime(timeToMinutes(start) + 15)) }].sort((a, b) => dateTimeStamp(a.date, a.start) - dateTimeStamp(b.date, b.start)));
  };

  const removeSlot = (slot: TimedDate) => {
    const next = sortedSlots.filter((candidate) => candidate !== slot);
    onChange(next);
    if (activeDate === slot.date && !next.some((candidate) => candidate.date === slot.date)) {
      setActiveDate(next[0]?.date || minDate);
    }
  };

  const moveMonth = (amount: number) => {
    setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + amount, 1)));
  };

  return (
    <div className="date-mode-card multiple-date-card">
      <div className="drawer-mini-calendar">
        <div className="drawer-mini-heading">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeft size={14} /></button>
          <strong>{formatMonthYear(visibleMonth)}</strong>
          <button type="button" onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight size={14} /></button>
        </div>
        <div className="drawer-mini-weekdays">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
        <div className="drawer-mini-days">
          {days.map((day) => {
            const key = dateKey(day);
            const outside = day.getUTCMonth() !== visibleMonth.getUTCMonth();
            const past = key < minDate;
            if (outside) return <span key={key} aria-hidden="true" />;
            return <button type="button" key={key} className={`${selectedDates.has(key) ? "selected" : ""} ${key === minDate ? "today" : ""} ${past ? "past" : ""}`} disabled={past} onClick={() => selectDate(key)} aria-label={formatPickerLabel(day)} aria-pressed={selectedDates.has(key)}>{day.getUTCDate()}</button>;
          })}
        </div>
      </div>
      <div className="multiple-time-list">
        <div className="multiple-time-toolbar">
          <span><Clock3 size={15} /> Select time</span>
          <button type="button" onClick={() => undefined}><Sparkles size={13} /> Find best Times</button>
        </div>
        {groupedSlots.length === 0 ? <p className="multiple-empty">Select one or more days to add available time slots.</p> : groupedSlots.map(([date, slots]) => (
          <div className="multiple-time-group" key={date} data-active={activeDate === date || undefined}>
            <div className="multiple-time-heading">
              <span>{formatMonthDay(parseDateKey(date))}</span>
            </div>
            {slots.map((slot, groupIndex) => {
              const index = sortedSlots.indexOf(slot);
              return <div className="multiple-time-row" key={`${date}-${groupIndex}`}>
                <div>
                  <DrawerTimeField value={slot.start} min={minimumTimeForDate(date)} max="23:30" label={`Start time for ${formatMonthDay(parseDateKey(date))}`} onChange={(start) => updateSlot(index, { start })} />
                  <span>–</span>
                  <DrawerTimeField value={slot.end} min={minutesToTime(timeToMinutes(slot.start) + 15)} label={`End time for ${formatMonthDay(parseDateKey(date))}`} onChange={(end) => updateSlot(index, { end })} />
                  {groupIndex === 0
                    ? <button type="button" className="add-time-slot" onClick={() => addSlot(date)} aria-label={`Add another time on ${formatMonthDay(parseDateKey(date))}`}><Plus size={17} /></button>
                    : <button type="button" className="remove-time-slot" onClick={() => removeSlot(slot)} aria-label={`Remove slot ${groupIndex + 1} on ${formatMonthDay(parseDateKey(date))}`}><X size={16} /></button>}
                </div>
              </div>;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function AttendeeAvatar({ name, avatar, organizer = false, size = 32 }: { name: string; avatar?: string; organizer?: boolean; size?: number }) {
  const initials = name.split(" ").map((part) => part[0]).slice(0, 2).join("");
  const palette = ["#667eea", "#0f9b8e", "#c06c84", "#4f7c8d", "#8b6fc0", "#d97757"];
  const color = organizer ? "#f5a000" : palette[name.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0) % palette.length];
  // Show the photo when it loads; fall back to initials if the image is
  // missing or fails (a bare colored circle looks like "no avatar").
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(avatar && !organizer && !imgFailed);
  return <span className="attendee-avatar" style={{ background: color, width: size, height: size, fontSize: size <= 28 ? 9 : 10 }}>{showImage ? <img src={avatar} alt="" onError={() => setImgFailed(true)} /> : initials}</span>;
}

function AttendeeChip({ name, type, avatar, organizer = false, onRemove }: { name: string; type: string; avatar?: string; organizer?: boolean; onRemove?: () => void }) {
  return (
    <span className="attendee-chip">
      <AttendeeAvatar name={name} avatar={avatar} organizer={organizer} />
      <span className="attendee-chip-copy"><strong>{name}</strong><small>{type}</small></span>
      {onRemove && <button type="button" onClick={onRemove} aria-label={`Remove ${name}`}><X size={15} /></button>}
    </span>
  );
}

function AttendeePicker({ selected, onSelect, onRemove, disabled = false }: { selected: AttendeePerson[]; onSelect: (person: AttendeePerson) => void; onRemove: (id: string) => void; disabled?: boolean }) {
  const [menu, setMenu] = useState<"types" | AttendeeType | null>(null);
  const [query, setQuery] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const typeIcons: Record<AttendeeType, IconType> = { candidate: UserRound, contact: ContactRound, internal: UsersRound };
  const activePeople = menu && menu !== "types" ? attendeeDirectory[menu].filter((person) => `${person.name} ${person.email}`.toLowerCase().includes(query.toLowerCase())) : [];

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setMenu(null);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  const chooseType = (type: AttendeeType) => {
    if (disabled) return;
    setQuery("");
    setMenu(type);
  };

  return (
    <div className="attendee-picker" ref={pickerRef}>
      <div className="attendee-chips">
        <AttendeeChip name="Kai Zeller" type="Organizer" organizer />
        {selected.map((person) => <AttendeeChip name={person.name} type={attendeeTypeLabels[person.type]} avatar={person.avatar} onRemove={disabled || person.locked ? undefined : () => onRemove(person.id)} key={person.id} />)}
        {!disabled && (
          <button className="add-attendee-button" type="button" aria-label="Add attendee" aria-expanded={menu !== null} onClick={() => setMenu((current) => current ? null : "types")}><Plus size={21} /></button>
        )}
      </div>

      {menu === "types" && (
        <div className="attendee-type-menu" role="menu" aria-label="Attendee type">
          {(["candidate", "contact", "internal"] as AttendeeType[]).map((type) => {
            const Icon = typeIcons[type];
            return (
              <div key={type} className="attendee-type-option-wrap group relative">
                <button type="button" role="menuitem" onClick={() => chooseType(type)} className="w-full"><Icon size={20} /><span>{attendeeTypeLabels[type]}</span></button>
              </div>
            );
          })}
        </div>
      )}

      {menu && menu !== "types" && (
        <div className="attendee-people-menu">
          <div className="attendee-menu-heading"><strong>Add {attendeeTypeLabels[menu].toLowerCase()}</strong><button type="button" onClick={() => { setMenu("types"); setQuery(""); }}>Change type</button></div>
          <label className="attendee-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" aria-label={`Search ${attendeeTypeLabels[menu].toLowerCase()}`} /><Search size={18} /></label>
          <div className="attendee-results">
            {activePeople.map((person) => {
              const alreadySelected = selected.some((item) => item.id === person.id);
              return <button type="button" disabled={alreadySelected} onClick={() => { onSelect(person); setMenu(null); setQuery(""); }} aria-label={`Select ${person.name}`} key={person.id}><AttendeeAvatar name={person.name} avatar={person.avatar} /><span style={{ gap: 1 }}><strong style={{ fontSize: 13, lineHeight: 1.2 }}>{person.name}</strong><small style={{ fontSize: 11, marginTop: 1, lineHeight: 1.2 }}>{person.email}</small></span>{alreadySelected && <Check size={16} />}</button>;
            })}
            {activePeople.length === 0 && <p>No attendees found.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function LinkedContextCard({ item, removable, showAction = true, showOrganization = true, onRemove }: { item: LinkedContext; removable?: boolean; showAction?: boolean; showOrganization?: boolean; onRemove?: () => void }) {
  const ContextIcon = item.kind === "job" ? BriefcaseBusiness : Target;
  return (
    <div className="linked-context-card">
      <ContextIcon size={16} />
      <strong>{item.title}</strong>
      <span className="contract-badge">{item.contract}</span>
      {showOrganization && <><span className="organization-mark">{item.organizationInitials}</span><span className="organization-name">{item.organization}</span></>}
      {showAction && <button className="view-context-button" type="button">{item.kind === "job" ? "View Application" : "View Opportunity"}<ExternalLink size={14} /></button>}
      {removable && <button className="remove-context-button" type="button" onClick={onRemove} aria-label={`Remove ${item.title}`}><X size={15} /></button>}
    </div>
  );
}

function OrganizationCard({ organization, removable, onRemove }: { organization: Organization; removable?: boolean; onRemove?: () => void }) {
  return (
    <div className="organization-card">
      <span className={`organization-mark organization-${organization.id}`}>{organization.initials}</span>
      <strong>{organization.name}</strong>
      <span className="organization-separator">•</span>
      <Building2 size={14} />
      <span>{organization.relationship}</span>
      {removable && <button type="button" onClick={onRemove} aria-label={`Remove ${organization.name}`}><X size={15} /></button>}
    </div>
  );
}

function FieldErrorIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18.14c-.77 1.33.19 3 1.73 3h16.9c1.54 0 2.5-1.67 1.73-3L13.71 3.86c-.77-1.33-2.65-1.33-3.42 0Z" />
      <rect x="11.05" y="9.6" width="1.9" height="5.2" rx="0.95" fill="#fff" />
      <circle cx="12" cy="17.2" r="1.05" fill="#fff" />
    </svg>
  );
}

function RelationshipAlert({ copy }: { copy: string }) {
  return <div className="candidate-context-alert" role="alert"><AlertTriangle size={15} className="banner-icon" /><span>{copy}</span></div>;
}

function RelationshipContextSection({ talent, contact, selectedOrganization, selectedContext, onSelectOrganization, onClearOrganization, onSelectContext, onClearContext, orgError = false, contextError = false, jobsOnly = false }: {
  talent?: AttendeePerson;
  contact: AttendeePerson;
  selectedOrganization: Organization | null;
  selectedContext: LinkedContext | null;
  onSelectOrganization: (organization: Organization) => void;
  onClearOrganization: () => void;
  onSelectContext: (item: LinkedContext) => void;
  onClearContext: () => void;
  orgError?: boolean;
  contextError?: boolean;
  jobsOnly?: boolean;
}) {
  const [organizationOpen, setOrganizationOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [organizationQuery, setOrganizationQuery] = useState("");
  const [contextQuery, setContextQuery] = useState("");
  const relationshipRef = useRef<HTMLElement>(null);
  const contactOrganizationIds = contact.organizations ?? [];
  const links = (talent?.links ?? Object.values(linkedContexts).filter((item) => contactOrganizationIds.includes(item.organizationId))).filter((item) => !jobsOnly || item.kind === "job");
  const talentOrganizationIds = new Set(links.map((item) => item.organizationId));
  const combined = Boolean(talent);
  const sharedOrgIds = combined
    ? Array.from(talentOrganizationIds)
    : contactOrganizationIds.filter((id) => !talent || talentOrganizationIds.has(id));
  const sharedOrganizations = sharedOrgIds
    .map((id) => organizations[id] ?? ({ id, name: id, initials: id.slice(0, 2).toUpperCase(), relationship: "Subsidiary" as const } as Organization));
  const filteredOrganizations = sharedOrganizations.filter((item) => `${item.name} ${item.relationship}`.toLowerCase().includes(organizationQuery.toLowerCase()));
  const organizationLinks = selectedOrganization ? links.filter((item) => item.organizationId === selectedOrganization.id) : [];
  const filteredLinks = organizationLinks.filter((item) => `${item.title} ${item.contract}`.toLowerCase().includes(contextQuery.toLowerCase()));
  const jobs = filteredLinks.filter((item) => item.kind === "job");
  const opportunities = filteredLinks.filter((item) => item.kind === "opportunity");
  const hasNoOrganizations = contactOrganizationIds.length === 0;
  const hasNoRelationship = !combined && Boolean(talent) && !hasNoOrganizations && sharedOrganizations.length === 0;

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!relationshipRef.current?.contains(event.target as Node)) {
        setOrganizationOpen(false);
        setContextOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  return (
    <section className="candidate-contact-context" ref={relationshipRef}>
      <div className="relationship-block">
        <label>Organization<span className="required-star">*</span></label>
        {hasNoOrganizations ? <RelationshipAlert copy={`${contact.name} has no organization linked.`} /> : hasNoRelationship ? <RelationshipAlert copy={`${contact.name} has no organization connected to ${talent?.name}`} /> : selectedOrganization ? (
          <OrganizationCard organization={selectedOrganization} removable={sharedOrganizations.length > 1} onRemove={() => { onClearOrganization(); setOrganizationOpen(false); setContextOpen(false); }} />
        ) : (
          <div className="context-search-wrap">
            <label className="context-search"><input value={organizationQuery} onFocus={() => { setOrganizationOpen(true); setContextOpen(false); }} onChange={(event) => { setOrganizationQuery(event.target.value); setOrganizationOpen(true); setContextOpen(false); }} placeholder="Select organization" aria-label="Select organization" /><Search size={17} /></label>
            {organizationOpen && <div className="context-results organization-results">{filteredOrganizations.map((item) => <button type="button" onClick={() => { onSelectOrganization(item); setOrganizationOpen(false); setOrganizationQuery(""); }} key={item.id}><OrganizationCard organization={item} /></button>)}{filteredOrganizations.length === 0 && <p>No matching organizations.</p>}</div>}
          </div>
        )}
        {!hasNoOrganizations && !hasNoRelationship && !selectedOrganization && orgError && <p className="field-error"><FieldErrorIcon /> Select an organization</p>}
      </div>

      <div className="relationship-block">
        <label>{jobsOnly ? "Job" : "Job / opportunity"}<span className="required-star">*</span></label>
        {selectedContext ? <LinkedContextCard item={selectedContext} showOrganization={false} removable={organizationLinks.length > 1} onRemove={() => { onClearContext(); setContextOpen(false); }} /> : (
          <div className={`context-search-wrap ${!selectedOrganization ? "disabled" : ""}`}>
            <label className="context-search"><input disabled={!selectedOrganization} value={contextQuery} onFocus={() => { setContextOpen(true); setOrganizationOpen(false); }} onChange={(event) => { setContextQuery(event.target.value); setContextOpen(true); setOrganizationOpen(false); }} placeholder={jobsOnly ? "Select job" : "Select job or opportunity"} aria-label={jobsOnly ? "Select client job" : "Select client job or opportunity"} /><Search size={17} /></label>
            {contextOpen && selectedOrganization && <div className="context-results">
              {jobs.length > 0 && <><h4>Jobs</h4>{jobs.map((item) => <button type="button" onClick={() => { onSelectContext(item); setContextOpen(false); setContextQuery(""); }} key={item.id}><LinkedContextCard item={item} showAction={false} showOrganization={false} /></button>)}</>}
              {opportunities.length > 0 && <><h4>Opportunities</h4>{opportunities.map((item) => <button type="button" onClick={() => { onSelectContext(item); setContextOpen(false); setContextQuery(""); }} key={item.id}><LinkedContextCard item={item} showAction={false} showOrganization={false} /></button>)}</>}
              {filteredLinks.length === 0 && <p>{jobsOnly ? "No matching jobs." : "No matching jobs or opportunities."}</p>}
            </div>}
          </div>
        )}
        {selectedOrganization && !selectedContext && contextError && <p className="field-error"><FieldErrorIcon /> {jobsOnly ? "Select a job" : "Select a job or opportunity"}</p>}
      </div>
    </section>
  );
}

function TalentContextSection({ talent, selected, onSelect, onClear, showError = false, jobsOnly = false }: { talent: AttendeePerson; selected: LinkedContext | null; onSelect: (item: LinkedContext) => void; onClear: () => void; showError?: boolean; jobsOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const contextRef = useRef<HTMLElement>(null);
  const links = (talent.links ?? []).filter((item) => !jobsOnly || item.kind === "job");
  const filtered = links.filter((item) => `${item.title} ${item.organization} ${item.contract}`.toLowerCase().includes(query.toLowerCase()));
  const jobs = filtered.filter((item) => item.kind === "job");
  const opportunities = filtered.filter((item) => item.kind === "opportunity");

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!contextRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  if (links.length === 0) {
    return (
      <section className="candidate-context-section" ref={contextRef}>
        <label>{jobsOnly ? "Job" : "Job / opportunity"}<span className="required-star">*</span></label>
        <RelationshipAlert copy={`This ${talent.type} must be linked to ${jobsOnly ? "a job" : "a job or opportunity"}.`} />
      </section>
    );
  }

  return (
    <section className="candidate-context-section" ref={contextRef}>
      <label>{jobsOnly ? "Job" : "Job / opportunity"}<span className="required-star">*</span></label>
      {selected ? <LinkedContextCard item={selected} removable={links.length > 1} onRemove={() => { onClear(); setOpen(false); }} /> : (
        <div className="context-search-wrap">
          <label className="context-search"><input value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} placeholder={jobsOnly ? "Select job" : "Select job or opportunity"} aria-label={jobsOnly ? "Select job" : "Select job or opportunity"} /><Search size={17} /></label>
          {open && (
            <div className="context-results">
              {jobs.length > 0 && <><h4>Jobs</h4>{jobs.map((item) => <button type="button" onClick={() => { onSelect(item); setOpen(false); setQuery(""); }} key={item.id}><LinkedContextCard item={item} showAction={false} /></button>)}</>}
              {opportunities.length > 0 && <><h4>Opportunities</h4>{opportunities.map((item) => <button type="button" onClick={() => { onSelect(item); setOpen(false); setQuery(""); }} key={item.id}><LinkedContextCard item={item} showAction={false} /></button>)}</>}
              {filtered.length === 0 && <p>{jobsOnly ? "No matching jobs." : "No matching jobs or opportunities."}</p>}
            </div>
          )}
        </div>
      )}
      {!selected && showError && <p className="field-error"><FieldErrorIcon /> {jobsOnly ? "Select a job" : "Select a job or opportunity"}</p>}
    </section>
  );
}

type RelatedToType = "Candidate" | "Job" | "Opportunity" | "Organization" | "Contact";

type LinkedRecord = { type: RelatedToType; item: any };

function LinkedToSection({ records, onAdd, onRemove, disabled = false }: { records: LinkedRecord[]; onAdd: (type: RelatedToType, item: any) => void; onRemove: (type: RelatedToType) => void; disabled?: boolean }) {
  const [menu, setMenu] = useState<"types" | RelatedToType | null>(null);
  const [query, setQuery] = useState("");
  const [showAllJobs, setShowAllJobs] = useState(false);
  const [showAllOpps, setShowAllOpps] = useState(false);
  const [addingJobId, setAddingJobId] = useState<string | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const typeIcons: Record<RelatedToType, IconType> = { Candidate: UserRound, Job: BriefcaseBusiness, Opportunity: Target, Organization: Building2, Contact: ContactRound };
  const allTypes: RelatedToType[] = ["Candidate", "Contact", "Job", "Opportunity", "Organization"];
  const selectedTypes = records.map((r) => r.type);
  const anchor = records[0] ?? null;
  const getItemsForType = (type: RelatedToType): any[] => {
    if (type === "Candidate") return attendeeDirectory.candidate;
    if (type === "Contact") return attendeeDirectory.contact;
    if (type === "Organization") return Object.values(organizations);
    if (type === "Job") return Object.values(linkedContexts).filter((c) => c.kind === "job");
    if (type === "Opportunity") return Object.values(linkedContexts).filter((c) => c.kind === "opportunity");
    return [];
  };
  // Free linking: the organizer can link ANY record to the event — no anchor
  // relation filtering, no "not linked to any X" empty states. A candidate can
  // be linked alongside a contact and a job even when they share no relation.
  const getAllowedIds = (_target: RelatedToType): Set<string> | null => null;
  const allowedIds = menu && menu !== "types" ? getAllowedIds(menu as RelatedToType) : null;
  // when user clicks Add to a job / Browse opportunities, bypass filter to show all
  const effectiveAllowed = (showAllJobs && menu === "Job" && anchor?.type === "Candidate") || (showAllOpps && menu === "Opportunity" && anchor?.type === "Candidate") ? null : allowedIds;
  const isEmptyDueToRelation = effectiveAllowed !== null && effectiveAllowed.size === 0 && menu !== "types" && records.length > 0;
  const allForMenu = menu && menu !== "types" ? getItemsForType(menu as RelatedToType) : [];
  const filteredItems = menu && menu !== "types" ? allForMenu.filter((item) => {
    if (effectiveAllowed && !effectiveAllowed.has(item.id)) return false;
    const text = `${item.name ?? item.title ?? ""} ${item.email ?? item.organization ?? ""} ${item.id ?? ""}`.toLowerCase();
    return text.includes(query.toLowerCase());
  }) : [];

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!sectionRef.current?.contains(event.target as Node)) { setMenu(null); setShowAllJobs(false); setShowAllOpps(false); setAddingJobId(null); }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  useEffect(() => { if (menu !== "Job") { setShowAllJobs(false); setAddingJobId(null); } if (menu !== "Opportunity") setShowAllOpps(false); }, [menu]);
  useEffect(() => { setShowAllJobs(false); setShowAllOpps(false); setAddingJobId(null); }, [records.length]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key?.startsWith("wg_linked_opportunity_") && !e.key?.startsWith("wg_submit_opportunity_") && !e.key?.startsWith("wg_submit_candidate_")) return;
      if (anchor?.type !== "Candidate" || selectedTypes.includes("Opportunity")) return;
      const cid = anchor.item.id;
      const storedOppId = (() => { try { return localStorage.getItem(`wg_submit_opportunity_${cid}`); } catch { return null; } })();
      if (storedOppId) {
        const opp = (linkedContexts as any)[storedOppId] ?? Object.values(linkedContexts).find((c) => c.id === storedOppId);
        if (opp) { onAdd("Opportunity", opp); return; }
      }
      let hasLinked = false;
      try { hasLinked = !!localStorage.getItem(`wg_linked_opportunity_${cid}`) || Object.keys(localStorage).some((k) => k.startsWith(`wg_linked_opportunity_${cid}_`)); } catch {}
      if (hasLinked) {
        const opp = Object.values(linkedContexts).find((c) => c.kind === "opportunity");
        if (opp) onAdd("Opportunity", opp);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [anchor, selectedTypes, onAdd]);

  const openRecord = (record: LinkedRecord) => {
    const id = record.item?.id ?? record.item?.reference ?? "";
    if (record.type === "Candidate") window.open(`/candidates/${id}`, "_blank");
    else if (record.type === "Contact") window.open(`/contacts/${id}`, "_blank");
    else if (record.type === "Job") window.open(`/jobs/${id}`, "_blank");
    else if (record.type === "Opportunity") window.open(`/opportunities/${id}`, "_blank");
    else if (record.type === "Organization") window.open(`/organizations/${id}`, "_blank");
    else window.open("/", "_blank");
  };
  const openSubmitPage = (candidateName: string, candidateId: string, opportunityId?: string, opportunityTitle?: string) => {
    const params = new URLSearchParams({ candidate: candidateId, name: candidateName });
    if (opportunityId) params.set("opportunity", opportunityId);
    if (opportunityTitle) params.set("opportunityTitle", opportunityTitle);
    window.open(`/submit-candidates?${params.toString()}`, "_blank");
  };

  return (
    <div ref={sectionRef} style={{ position: "relative" }}>
      {records.length > 0 && (
        <div style={{ display: "grid", gap: 2, marginBottom: 8 }}>
          {records.map((record) => {
            return (
              <div
                key={record.type}
                className="linked-record-pill"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#f7f9fb",
                  borderRadius: 4,
                  padding: "6px",
                  minHeight: 34,
                  border: "none",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                  {record.type === "Candidate" || record.type === "Contact" ? (
                    <>
                      <AttendeeAvatar name={record.item.name} avatar={record.item.avatar} size={24} />
                      <strong style={{ fontSize: 14, color: "#334155", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{record.item.name}</strong>
                      <span style={{ color: "#8a95a8", fontSize: 14, whiteSpace: "nowrap" }}>• {record.type}</span>
                    </>
                  ) : record.type === "Organization" ? (
                    record.item.relationship === "Subsidiary" ? (
                      <>
                        <span className="organization-mark organization-gm" style={{ width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, flex: "none", background: "#e74c3c", color: "#fff" }}>GM</span>
                        <span style={{ color: "#8a95a8", fontSize: 14, whiteSpace: "nowrap" }}>General Motors</span>
                        <ChevronRight size={14} style={{ color: "#9aa8be", flex: "none" }} />
                        <span className={`organization-mark organization-${record.item.id}`} style={{ width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, flex: "none" }}>{record.item.initials}</span>
                        <strong style={{ fontSize: 14, color: "#334155", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{record.item.name}</strong>
                      </>
                    ) : (
                      <>
                        <span className={`organization-mark organization-${record.item.id}`} style={{ width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, flex: "none" }}>{record.item.initials}</span>
                        <strong style={{ fontSize: 14, color: "#334155", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{record.item.name}</strong>
                      </>
                    )
                  ) : record.type === "Job" ? (
                    <>
                      <span style={{ width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", color: "#0e9384", flex: "none" }}><BriefcaseBusiness size={18} /></span>
                      <strong style={{ fontSize: 14, color: "#334155", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{record.item.title}</strong>
                    </>
                  ) : (
                    <>
                      <span style={{ width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", color: "#0e9384", flex: "none" }}><Target size={18} /></span>
                      <strong style={{ fontSize: 14, color: "#334155", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{record.item.title}</strong>
                    </>
                  )}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => openRecord(record)}
                    aria-label={`Open ${record.type} in new tab`}
                    title="Open in new tab"
                    className="linked-external-btn"
                    style={{ width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: 6, background: "transparent", color: "#6b7a90", cursor: "pointer" }}
                  >
                    <ExternalLink size={16} />
                  </button>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => onRemove(record.type)}
                      aria-label={`Remove ${record.type}`}
                      style={{ width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: 6, background: "transparent", color: "#94a3b8", cursor: "pointer" }}
                    >
                      <X size={15} />
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!disabled && (
        <button className="outline-action" type="button" aria-expanded={menu !== null} onClick={() => setMenu((c) => (c ? null : "types"))}>
          <Link2 size={15} /> Link a record
        </button>
      )}

      {menu === "types" && (
        <div className="attendee-type-menu" role="menu" aria-label="Linked to type" style={{ left: 0, width: 260 }}>
          {allTypes.map((t) => {
            const Icon = typeIcons[t];
            const disabled = selectedTypes.includes(t);
            return (
              <div key={t} className="attendee-type-option-wrap group relative">
                <button type="button" role="menuitem" disabled={disabled} title={disabled ? "Already linked" : undefined} onClick={() => { if (disabled) return; setMenu(t); setQuery(""); }} className="w-full">
                  <Icon size={20} /><span>{t}</span>
                  {disabled && <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>Already linked</span>}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {menu && menu !== "types" && (
        <div className="attendee-people-menu" style={{ left: 0 }}>
          <div className="attendee-menu-heading"><strong>{menu === "Organization" ? "Link an organization" : `Link a ${menu.toLowerCase()}`}</strong><button type="button" onClick={() => { setMenu("types"); setQuery(""); }}>Change type</button></div>
          <label className="attendee-search"><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" aria-label={`Search ${menu.toLowerCase()}`} /><Search size={18} /></label>
          <div className="attendee-results">
            {filteredItems.map((item: any) => {
              if (menu === "Candidate" || menu === "Contact") {
                return <button type="button" onClick={() => { onAdd(menu as RelatedToType, item); setMenu(null); setQuery(""); setShowAllJobs(false); setShowAllOpps(false); }} key={item.id}><AttendeeAvatar name={item.name} avatar={item.avatar} /><span style={{ gap: 1 }}><strong style={{ fontSize: 13, lineHeight: 1.2 }}>{item.name}</strong><small style={{ fontSize: 11, marginTop: 1, lineHeight: 1.2 }}>{item.email}</small></span></button>;
              }
              if (menu === "Organization") {
                return <button type="button" onClick={() => { onAdd(menu as RelatedToType, item); setMenu(null); setQuery(""); setShowAllJobs(false); setShowAllOpps(false); }} key={item.id}><span className={`organization-mark organization-${item.id}`} style={{ width: 29, height: 29, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, flex: "none" }}>{item.initials}</span><span style={{ gap: 1 }}><strong style={{ fontSize: 13, lineHeight: 1.2 }}>{item.name}</strong><small style={{ fontSize: 11, marginTop: 1, lineHeight: 1.2 }}>{item.relationship}</small></span></button>;
              }
              return <button type="button" onClick={() => { onAdd(menu as RelatedToType, item); setMenu(null); setQuery(""); setShowAllJobs(false); setShowAllOpps(false); }} key={item.id}><span style={{ width: 29, height: 29, borderRadius: 6, background: "#e6ecf2", display: "grid", placeItems: "center", color: "#078c80", flex: "none" }}>{menu === "Job" ? <BriefcaseBusiness size={14} /> : <Target size={14} />}</span><span style={{ gap: 1 }}><strong style={{ fontSize: 13, lineHeight: 1.2 }}>{item.title}</strong><small style={{ fontSize: 11, marginTop: 1, lineHeight: 1.2 }}>{item.contract} • {item.organization}</small></span></button>;
            })}
            {filteredItems.length === 0 && !isEmptyDueToRelation && query.trim() !== "" && (menu === "Candidate" || menu === "Contact" || menu === "Organization") && (
              <div style={{ display: "grid", gap: 0 }}>
                <p style={{ color: "#8a95a8", fontSize: 13, margin: 0, textAlign: "center", padding: "12px 12px 10px" }}>No results found</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 12px", borderTop: "1px solid #f1f5f9" }}>
                  <span style={{ color: "#334155", fontSize: 12 }}>Did not find the {menu.toLowerCase()}?</span>
                  <button type="button" onClick={() => { const url = menu === "Candidate" ? "http://localhost:3000/candidates" : "http://localhost:3000/contacts"; window.open(url, "_blank"); setMenu(null); setQuery(""); setShowAllJobs(false); setShowAllOpps(false); }} style={{ background: "#fff", border: "1px solid #d9e0e8", borderRadius: 4, padding: "3px 7px", display: "inline-flex", alignItems: "center", gap: 4, color: "#475569", fontSize: 11, cursor: "pointer", flex: "none" }}><Plus size={10} />Add {menu.toLowerCase()}</button>
                </div>
              </div>
            )}
            {filteredItems.length === 0 && !isEmptyDueToRelation && query.trim() !== "" && (menu === "Job" || menu === "Opportunity") && (
              <div style={{ display: "grid", gap: 0 }}>
                <p style={{ color: "#8a95a8", fontSize: 13, margin: 0, textAlign: "center", padding: "12px 12px 10px" }}>No results found</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 12px", borderTop: "1px solid #f1f5f9" }}>
                  <span style={{ color: "#334155", fontSize: 12 }}>Did not find the {menu.toLowerCase()}?</span>
                  <button type="button" onClick={() => { window.open("http://localhost:3000/jobs", "_blank"); setMenu(null); setQuery(""); setShowAllJobs(false); setShowAllOpps(false); }} style={{ background: "#fff", border: "1px solid #d9e0e8", borderRadius: 4, padding: "3px 7px", display: "inline-flex", alignItems: "center", gap: 4, color: "#475569", fontSize: 11, cursor: "pointer", flex: "none" }}><Plus size={10} />{menu === "Job" ? "Create" : "Add"} {menu.toLowerCase()}</button>
                </div>
              </div>
            )}
            {filteredItems.length === 0 && query.trim() === "" && <p style={{ padding: "12px", textAlign: "center", color: "#8a95a8", fontSize: 13 }}>No results found</p>}
          </div>
        </div>
      )}
    </div>
  );
}

const meetingProviders = {
  wiggli: { label: "Wiggli Meet", logo: "/wiggli-meet.png", link: "https://meet.wiggli.com/event/axelle-bastin-71574286025" },
  google: { label: "Google Meet", logo: "/google-meet.png", link: "https://meet.google.com/wig-gli-demo" },
  teams: { label: "Microsoft Teams", logo: "/microsoft-teams.png", link: "https://teams.microsoft.com/l/meetup-join/wiggli-demo" },
  zoom: { label: "Zoom", logo: "/Zoom-logo.png", link: "https://zoom.us/j/71574286025" },
  manual: { label: "Manual URL", logo: "", link: "" },
} as const;
type MeetingProvider = keyof typeof meetingProviders;

type LocationSnapshot = {
  open: boolean;
  type: "company" | "custom" | "online";
  office: string;
  provider?: MeetingProvider;
  custom: { street: string; number: string; box: string; city: string; zip: string; country: string; query: string };
  manualUrl?: string;
  aiNotetaker?: boolean;
  /** Real Meet link provisioned instantly via /api/meet-link. */
  meetLink?: string | null;
};

function EventLocation({ open, required, onOpen, onRemove, showError = false, onValidityChange, initialLocation, onLocationChange, disabled = false }: { open: boolean; required: boolean; onOpen: () => void; onRemove: () => void; showError?: boolean; onValidityChange?: (valid: boolean) => void; initialLocation?: LocationSnapshot | null; onLocationChange?: (data: LocationSnapshot) => void; disabled?: boolean }) {
  const [locationType, setLocationType] = useState<"company" | "custom" | "online">(() => (initialLocation?.type as "company" | "custom" | "online") ?? "company");
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const [officeMenuOpen, setOfficeMenuOpen] = useState(false);
  const [selectedOffice, setSelectedOffice] = useState(() => initialLocation?.office ?? "");
  const [customTab, setCustomTab] = useState<"details" | "map">("details");
  const [addressQuery, setAddressQuery] = useState(() => initialLocation?.custom.query ?? "Paris");
  const [street, setStreet] = useState(() => initialLocation?.custom.street ?? "");
  const [number, setNumber] = useState(() => initialLocation?.custom.number ?? "");
  const [box, setBox] = useState(() => initialLocation?.custom.box ?? "");
  const [city, setCity] = useState(() => initialLocation?.custom.city ?? "Paris");
  const [zip, setZip] = useState(() => initialLocation?.custom.zip ?? "");
  const [country, setCountry] = useState(() => initialLocation?.custom.country ?? "");
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const [providerChoice, setProviderChoice] = useState<MeetingProvider>(() => (initialLocation?.provider as MeetingProvider) ?? "wiggli");
  const [manualUrl, setManualUrl] = useState(() => initialLocation?.manualUrl ?? "");
  const [aiNotetaker, setAiNotetaker] = useState(() => initialLocation?.aiNotetaker ?? false);
  const [copied, setCopied] = useState(false);
  // Google Meet is provisioned by Google when the event is created — no
  // pre-provisioning here (that produced a duplicate link in Location).
  const instantMeetLink = null as string | null;
  const provider = providerChoice;
  const locationRef = useRef<HTMLElement>(null);
  const offices = ["Paris HQ — 12 Rue de la Paix, 75002 Paris", "Brussels Office — 18 Avenue Louise, 1050 Brussels", "London Hub — 25 Old Street, EC1V London", "Casablanca Office — 42 Boulevard Zerktouni, Casablanca"];
  const locationOptions = [{ id: "company" as const, label: "Company address", icon: Building2 }, { id: "custom" as const, label: "Custom location", icon: MapPin }, { id: "online" as const, label: "Online", icon: Video }];
  const activeLocation = locationOptions.find((item) => item.id === locationType)!;
  const ActiveLocationIcon = activeLocation.icon;
  const providerLogo = meetingProviders[provider].logo;
  const conferenceLink = meetingProviders[provider].link;

  useEffect(() => {
    if (initialLocation) {
      setLocationType(initialLocation.type);
      setSelectedOffice(initialLocation.office);
      setAddressQuery(initialLocation.custom.query);
      setStreet(initialLocation.custom.street);
      setNumber(initialLocation.custom.number);
      setBox(initialLocation.custom.box);
      setCity(initialLocation.custom.city);
      setZip(initialLocation.custom.zip);
      setCountry(initialLocation.custom.country);
      setProviderChoice((initialLocation.provider as MeetingProvider) ?? "wiggli");
      setManualUrl(initialLocation.manualUrl ?? "");
      setAiNotetaker(initialLocation.aiNotetaker ?? false);
    } else if (open) {
      setLocationType("company");
      setSelectedOffice("");
      setAddressQuery("Paris");
      setStreet("");
      setNumber("");
      setBox("");
      setCity("Paris");
      setZip("");
      setCountry("");
      setProviderChoice("wiggli");
      setManualUrl("");
      setAiNotetaker(false);
    }
  }, [initialLocation, open]);

  useEffect(() => {
    onLocationChange?.({
      open,
      type: locationType,
      office: selectedOffice,
      provider: providerChoice,
      custom: { street, number, box, city, zip, country, query: addressQuery },
      manualUrl,
      aiNotetaker,
      meetLink: instantMeetLink,
    });
  }, [open, locationType, selectedOffice, providerChoice, street, number, box, city, zip, country, addressQuery, manualUrl, aiNotetaker, instantMeetLink, onLocationChange]);

  useEffect(() => {
    if (open) return;
    setLocationType("company");
    setLocationMenuOpen(false);
    setOfficeMenuOpen(false);
    setSelectedOffice("");
    setProviderMenuOpen(false);
    setProviderChoice("wiggli");
    setManualUrl("");
    setAiNotetaker(false);
  }, [open]);

  const locationValid = locationType === "company" ? Boolean(selectedOffice) : locationType === "custom" ? Boolean(street.trim() && city.trim() && country.trim()) : locationType === "online" ? (providerChoice === "manual" ? Boolean(manualUrl.trim()) : true) : true;

  useEffect(() => {
    onValidityChange?.(locationValid);
  }, [locationValid]);

  useEffect(() => { setCopied(false); }, [conferenceLink]);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!locationRef.current?.contains(event.target as Node)) {
        setLocationMenuOpen(false);
        setOfficeMenuOpen(false);
        setProviderMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  const chooseMapLocation = (place: "paris" | "brussels" | "casablanca") => {
    const places = {
      paris: { query: "12 Rue de la Paix, Paris", street: "Rue de la Paix", number: "12", city: "Paris", zip: "75002", country: "France" },
      brussels: { query: "18 Avenue Louise, Brussels", street: "Avenue Louise", number: "18", city: "Brussels", zip: "1050", country: "Belgium" },
      casablanca: { query: "42 Boulevard Zerktouni, Casablanca", street: "Boulevard Zerktouni", number: "42", city: "Casablanca", zip: "20000", country: "Morocco" },
    }[place];
    setAddressQuery(places.query);
    setStreet(places.street);
    setNumber(places.number);
    setCity(places.city);
    setZip(places.zip);
    setCountry(places.country);
  };

  return (
    <section className="event-location-section" ref={locationRef}>
      <div className="field-label field-space location-heading">
        <span>Location{(required || open) && <span className="required-star">*</span>}</span>
        {open && !required && !disabled ? <button type="button" onClick={onRemove} aria-label="Remove location"><X size={15} /></button> : <span style={{ width: 24, height: 24 }} aria-hidden="true" />}
      </div>
      {!open ? (disabled ? null : <button className="outline-action" type="button" onClick={onOpen}><Plus size={15} /> Select location</button>) : (
        <div className="location-card">
          <div className="location-dropdown-wrap">
            <button className="location-select" type="button" disabled={disabled} aria-expanded={locationMenuOpen} onClick={() => { if (disabled) return; setLocationMenuOpen((value) => !value); setOfficeMenuOpen(false); setProviderMenuOpen(false); }} style={{ fontSize: 13, height: 39, ...(disabled ? { background: "#f8fafc", color: "#475569", cursor: "not-allowed" } : {}) }}><span style={{ fontSize: 13 }}><ActiveLocationIcon size={16} /> {activeLocation.label}</span><ChevronDown size={15} /></button>
            {locationMenuOpen && <div className="location-options" role="menu" aria-label="Location type">{locationOptions.map((item) => { const Icon = item.icon; return <button type="button" role="menuitem" onClick={() => { setLocationType(item.id); setLocationMenuOpen(false); setOfficeMenuOpen(false); setProviderMenuOpen(false); }} key={item.id} style={{ fontSize: 13 }}><span style={{ fontSize: 13 }}><Icon size={16} />{item.label}</span>{locationType === item.id && <Check size={15} />}</button>; })}</div>}
          </div>

          {locationType === "company" && <div className="office-dropdown-wrap">
            <button className="location-select office-select" type="button" aria-expanded={officeMenuOpen} onClick={() => { setOfficeMenuOpen((value) => !value); setLocationMenuOpen(false); setProviderMenuOpen(false); }} style={{ fontSize: 13, height: 39 }}><span style={{ fontSize: 13, color: selectedOffice ? "#334158" : "#8da0b9" }}>{selectedOffice || "Select an office"}</span><ChevronDown size={15} /></button>
            {officeMenuOpen && <div className="office-options" role="listbox" aria-label="Company offices">{offices.map((office) => <button type="button" role="option" aria-selected={selectedOffice === office} onClick={() => { setSelectedOffice(office); setOfficeMenuOpen(false); }} key={office} style={{ fontSize: 13 }}><span style={{ fontSize: 13 }}>{office}</span>{selectedOffice === office && <Check size={14} />}</button>)}</div>}
          </div>}

          {locationType === "custom" && <div className="custom-location-panel">
            <label className="address-search"><input value={addressQuery} onChange={(event) => setAddressQuery(event.target.value)} placeholder="Search an address" aria-label="Search custom address" />{addressQuery && <button type="button" aria-label="Clear address" onClick={() => setAddressQuery("")}><X size={14} /></button>}</label>
            <div className="custom-location-tabs"><button className={customTab === "details" ? "selected" : ""} type="button" onClick={() => setCustomTab("details")}><MapPin size={14} /> Details</button><button className={customTab === "map" ? "selected" : ""} type="button" onClick={() => setCustomTab("map")}><Map size={14} /> Map</button></div>
            {customTab === "details" ? <div className="address-fields">
              <label className="wide">Street<input value={street} onChange={(event) => setStreet(event.target.value)} placeholder="Street" /></label>
              <label>Number<input value={number} onChange={(event) => setNumber(event.target.value)} placeholder="Number" /></label><label>Box<input value={box} onChange={(event) => setBox(event.target.value)} placeholder="Box" /></label>
              <label>City<input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City" /></label><label>Zip<input value={zip} onChange={(event) => setZip(event.target.value)} placeholder="Zip" /></label><label>Country<input value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Country" /></label>
            </div> : <div className="map-preview" aria-label="Location map"><span className="map-road road-one" /><span className="map-road road-two" /><span className="map-road road-three" /><button className="map-marker marker-paris" type="button" aria-label="Select Paris office on map" onClick={() => chooseMapLocation("paris")}><MapPin size={18} /></button><button className="map-marker marker-brussels" type="button" aria-label="Select Brussels office on map" onClick={() => chooseMapLocation("brussels")}><MapPin size={18} /></button><button className="map-marker marker-casablanca" type="button" aria-label="Select Casablanca office on map" onClick={() => chooseMapLocation("casablanca")}><MapPin size={18} /></button><div className="map-address-preview"><MapPin size={14} /><span><strong>{addressQuery || "Choose a point on the map"}</strong><small>{city && country ? `${city}, ${country}` : "Select a marker to preview its address"}</small></span></div></div>}
          </div>}

          {locationType === "online" && <>
            <label className="field-label" style={{ fontSize: 13, marginTop: 12, marginBottom: 0 }}>Host via</label>
            <div className="provider-dropdown-wrap">
              <button className="location-select" type="button" aria-expanded={providerMenuOpen} onClick={() => { setProviderMenuOpen((value) => !value); setLocationMenuOpen(false); setOfficeMenuOpen(false); }} style={{ fontSize: 13, height: 39 }}><span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>{provider === "manual" ? <Link2 size={16} /> : <img className="meeting-provider-logo" src={providerLogo} alt="" />}{meetingProviders[provider].label}</span><ChevronDown size={15} /></button>
              {providerMenuOpen && <div className="provider-options" role="menu" aria-label="Online meeting provider">
                <button type="button" role="menuitem" onClick={() => { setProviderChoice("wiggli"); setProviderMenuOpen(false); }} style={{ fontSize: 13 }}><span style={{ fontSize: 13 }}><img className="meeting-provider-logo" src="/wiggli-meet.png" alt="" />Wiggli Meet</span>{provider === "wiggli" && <Check size={14} />}</button>
                <button type="button" role="menuitem" onClick={() => { setProviderChoice("google"); setProviderMenuOpen(false); }} style={{ fontSize: 13 }}><span style={{ fontSize: 13 }}><img className="meeting-provider-logo" src="/google-meet.png" alt="" />Google Meet</span>{provider === "google" && <Check size={14} />}</button>
                <button type="button" role="menuitem" onClick={() => { setProviderChoice("teams"); setProviderMenuOpen(false); }} style={{ fontSize: 13 }}><span style={{ fontSize: 13 }}><img className="meeting-provider-logo" src="/microsoft-teams.png" alt="" />Microsoft Teams</span>{provider === "teams" && <Check size={14} />}</button>
                <button type="button" role="menuitem" onClick={() => { setProviderChoice("zoom"); setProviderMenuOpen(false); }} style={{ fontSize: 13 }}><span style={{ fontSize: 13 }}><img className="meeting-provider-logo" src="/Zoom-logo.png" alt="" />Zoom</span>{provider === "zoom" && <Check size={14} />}</button>
                <button type="button" role="menuitem" onClick={() => { setProviderChoice("manual"); setProviderMenuOpen(false); }} style={{ fontSize: 13 }}><span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}><Link2 size={16} />Manual URL</span>{provider === "manual" && <Check size={14} />}</button>
              </div>}
            </div>
            {provider === "teams" || provider === "google" ? null : provider === "manual" ? <>
              <label className="field-label" style={{ fontSize: 13, marginTop: 12, marginBottom: 0 }}>Meeting link<span className="required-star">*</span></label>
              <input className="drawer-title-input" value={manualUrl} onChange={(event) => setManualUrl(event.target.value)} placeholder="Add meeting link" aria-label="Add meeting link" style={{ height: 39, fontSize: 13 }} />
            </> : <>
              <label className="field-label" style={{ fontSize: 13, marginTop: 12, marginBottom: 0 }}>Meeting link</label>
              <div style={{ minHeight: 39, height: 39, display: "flex", alignItems: "center", width: "100%", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 9, padding: "0 11px" }}>
                <><span style={{ fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#334155" }}>{conferenceLink}</span><button type="button" aria-label={copied ? "Copied" : "Copy meeting link"} title={copied ? "Copied!" : "Copy link"} onClick={async () => { try { await navigator.clipboard.writeText(conferenceLink); showToast("Link copied"); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch {} }} style={{ width: 28, height: 28, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 7, marginLeft: 8, cursor: "pointer" }} className="copy-meeting-link">{copied ? <Check size={14} /> : <Copy size={14} />}</button></>
              </div>
            </>}
          </>}
        </div>
      )}
      {locationType === "online" && open && (
        <div className="location-card" style={{ marginTop: 12, padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334158", fontWeight: 500 }}><span style={{ display: "flex" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g clipPath="url(#clip0_359_159930)"><path d="M10.4016 3.78516L12.0547 8.08305C12.2864 8.68548 12.4022 8.98669 12.5824 9.24006C12.742 9.46461 12.9382 9.66081 13.1628 9.82048C13.4162 10.0006 13.7174 10.1165 14.3198 10.3482L18.6177 12.0012L14.3198 13.6543C13.7174 13.886 13.4162 14.0018 13.1628 14.182C12.9382 14.3416 12.742 14.5378 12.5824 14.7624C12.4022 15.0158 12.2864 15.317 12.0547 15.9194L10.4016 20.2173L8.74858 15.9194C8.51688 15.317 8.40103 15.0158 8.22087 14.7624C8.0612 14.5378 7.865 14.3416 7.64045 14.182C7.38708 14.0018 7.08587 13.886 6.48344 13.6543L2.18555 12.0012L6.48344 10.3482C7.08587 10.1165 7.38708 10.0006 7.64045 9.82048C7.865 9.66081 8.0612 9.46461 8.22087 9.24006C8.40103 8.98669 8.51688 8.68548 8.74858 8.08305L10.4016 3.78516Z" fill="#00CB24" stroke="#00CB24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.6176 2.73438L19.1796 4.19561C19.2584 4.40043 19.2978 4.50284 19.359 4.58898C19.4133 4.66532 19.48 4.73203 19.5563 4.78631C19.6425 4.84756 19.7449 4.88695 19.9497 4.96573L21.4109 5.52774L19.9497 6.08975C19.7449 6.16853 19.6425 6.20792 19.5563 6.26917C19.48 6.32346 19.4133 6.39016 19.359 6.4665C19.2978 6.55265 19.2584 6.65505 19.1796 6.85987L18.6176 8.32111L18.0556 6.85987C17.9768 6.65505 17.9374 6.55265 17.8762 6.4665C17.8219 6.39016 17.7552 6.32346 17.6788 6.26917C17.5927 6.20792 17.4903 6.16853 17.2855 6.08975L15.8242 5.52774L17.2855 4.96573C17.4903 4.88695 17.5927 4.84756 17.6788 4.78631C17.7552 4.73203 17.8219 4.66532 17.8762 4.58898C17.9374 4.50283 17.9768 4.40043 18.0556 4.19561L18.6176 2.73438Z" fill="#00CB24" stroke="#00CB24" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5676 17.1523L18.8457 17.8753C18.8847 17.9767 18.9042 18.0273 18.9345 18.0699C18.9613 18.1077 18.9943 18.1407 19.0321 18.1676C19.0747 18.1979 19.1254 18.2174 19.2267 18.2564L19.9497 18.5344L19.2267 18.8125C19.1254 18.8515 19.0747 18.871 19.0321 18.9013C18.9943 18.9281 18.9613 18.9611 18.9345 18.9989C18.9042 19.0415 18.8847 19.0922 18.8457 19.1935L18.5676 19.9165L18.2896 19.1935C18.2506 19.0922 18.2311 19.0415 18.2008 18.9989C18.1739 18.9611 18.1409 18.9281 18.1032 18.9013C18.0605 18.871 18.0099 18.8515 17.9085 18.8125L17.1855 18.5344L17.9085 18.2564C18.0099 18.2174 18.0605 18.1979 18.1032 18.1676C18.1409 18.1407 18.1739 18.1077 18.2008 18.0699C18.2311 18.0273 18.2506 17.9767 18.2896 17.8753L18.5676 17.1523Z" fill="#00CB24" stroke="#00CB24" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round"/></g><defs><clipPath id="clip0_359_159930"><rect width="24" height="24" fill="white"/></clipPath></defs></svg></span> Wiggli Notetaker</span>
            <p style={{ fontSize: 12, color: "#8da0b9", margin: 0, lineHeight: 1.4 }}>The AI notetaker joins at the meeting time — admit it from the lobby to start recording.</p>
          </div>
          <Toggle on={aiNotetaker} onClick={() => setAiNotetaker((v) => !v)} label="Wiggli Notetaker" />
        </div>
      )}
      {open && showError && !locationValid && <p className="field-error"><FieldErrorIcon /> Please enter a valid address</p>}
    </section>
  );
}

function DrawerInfoPanel({ talent, internalAttendees }: { talent?: AttendeePerson; internalAttendees: AttendeePerson[] }) {
  return (
    <aside className="drawer-info-column">
      <section>
        <h3><Clock3 size={16} /> Attendee Schedules</h3>
        {internalAttendees.length === 0 ? <p>No available schedules</p> : <div className="attendee-schedule-list">{internalAttendees.flatMap((person) => (person.schedules ?? []).map((schedule, index) => <div className={`attendee-schedule-card status-${schedule.status.toLowerCase().replaceAll(" ", "-")}`} key={`${person.id}-${index}`}><div><strong>{person.name}</strong><span>{schedule.status}</span></div><div><span><CalendarDays size={14} />{schedule.date}</span>{schedule.time && <span><Clock3 size={14} />{schedule.time}</span>}</div></div>))}</div>}
      </section>
      {talent && <section className="history-section"><h3><Clock3 size={16} /> History</h3><p>with <strong>{talent.name}</strong></p><div className="history-list"><span><CalendarDays size={14} />25/06/2026 <i>9:30 – 10:00</i></span><span><CalendarDays size={14} />14/07/2026 <i>15:30 – 16:00</i></span></div></section>}
    </aside>
  );
}

export type DrawerCandidate = { name: string; jobTitle: string };
export type DrawerContact = { name: string; email: string; organization?: string; organizationId?: string; organizations?: string[] };

export function buildCandidateAttendee(candidate: DrawerCandidate): AttendeePerson {
  const slug = candidate.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  if (!candidate.jobTitle) {
    return {
      id: `table-${slug}`,
      name: candidate.name,
      email: "",
      type: "candidate",
      avatar: "",
      locked: true,
      links: [],
    };
  }
  return {
    id: `table-${slug}`,
    name: candidate.name,
    email: "",
    type: "candidate",
    avatar: "",
    locked: true,
    links: [{
      id: `job-${slug}`,
      kind: "job",
      title: candidate.jobTitle,
      contract: "Permanent",
      organizationId: "jacquet-scrl",
      organization: "Jacquet SCRL",
      organizationInitials: "JS",
    }],
  };
}

export function buildContactAttendee(contact: DrawerContact): AttendeePerson {
  const slug = contact.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const orgIds = contact.organizations ?? (contact.organizationId ? [contact.organizationId] : ["jacquet-scrl"]);
  return {
    id: `contact-${slug}`,
    name: contact.name,
    email: contact.email,
    type: "contact",
    avatar: "",
    locked: true,
    organizations: orgIds,
  };
}

export type EventMeta = {
  status?: "DRAFT" | "LOGGED" | "SCHEDULED";
  description: string;
  attendees: { id: string; name: string; email: string; type: string; avatar: string; links?: { id: string; kind: string; title: string; contract: string; organizationId: string; organization: string; organizationInitials: string }[]; organizations?: string[]; schedules?: { status: string; date: string; time?: string }[]; locked?: boolean }[];
  reminderLabel: string;
  organization?: { id: string; name: string; initials: string; relationship: string } | null;
  linkedContext?: { id: string; kind: string; title: string; contract: string; organizationId: string; organization: string; organizationInitials: string } | null;
  location?: LocationSnapshot | null;
  eventType: string;
  relatedTo?: { type: RelatedToType; item: any } | null;
  linkedRecords?: LinkedRecord[];
};

export function EventDrawer({
  open,
  onClose,
  slot,
  onCreate,
  initialCandidate,
  initialContact,
  editingEvent,
  rescheduleDate,
  isEdit,
  initialStep,
  onRescheduleComplete,
  fixedEventType,
  fixedContext,
  initialLinkedRecords,
  mode = "smart",
}: {
  open: boolean;
  onClose: () => void;
  slot: { date: string; hour: number; minute: number };
  onCreate: (title: string, occurrences: TimedDate[], meta?: EventMeta) => void;
  initialCandidate?: DrawerCandidate;
  initialContact?: DrawerContact;
  editingEvent?: {
    id: string | number;
    title: string;
    date: string;
    endDate?: string;
    hour: number;
    minute: number;
    endHour: number;
    endMinute: number;
    eventType?: string;
    description?: string;
    storedAttendees?: {
      id: string;
      name: string;
      email: string;
      type: string;
      avatar: string;
      links?: { id: string; kind: string; title: string; contract: string; organizationId: string; organization: string; organizationInitials: string }[];
      organizations?: string[];
      schedules?: { status: string; date: string; time?: string }[];
      locked?: boolean;
    }[];
    storedOrganization?: { id: string; name: string; initials: string; relationship: string } | null;
    storedContext?: { id: string; kind: string; title: string; contract: string; organizationId: string; organization: string; organizationInitials: string } | null;
    storedLocation?: LocationSnapshot | null;
    storedReminder?: number | null;
  } | null;
  rescheduleDate?: string | null;
  isEdit?: boolean;
  /** Opens the drawer directly on the requested workflow step. */
  initialStep?: 1 | 2;
  onRescheduleComplete?: () => void;
  fixedEventType?: string;
  fixedContext?: LinkedContext;
  allowedEventTypes?: string[];
  initialLinkedRecords?: LinkedRecord[];
  mode?: "smart" | "resend-rsvp" | "native";
}) {
  const { data: session } = useSession();
  const nativeMode = mode === "native";
  const resendRsvpMode = mode === "resend-rsvp";
  const [configuredEventTypes] = useEventTypes();
  const configuredEventTypeNames = useMemo(() => configuredEventTypes.map((type) => type.name), [configuredEventTypes]);
  const [drawerStep, setDrawerStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState("");
  const [rescheduleNote, setRescheduleNote] = useState("");
  const [reminder, setReminder] = useState(true);
  const [reminderValue, setReminderValue] = useState("15");
  const [reminderUnit, setReminderUnit] = useState<ReminderUnit>("minutes");
  const [reminderMenuOpen, setReminderMenuOpen] = useState(false);
  const initialDate = slot.date || dateKey(getTodayUtcPlusTwo());
  const initialStartTime = formatCompactTime(slot.hour, slot.minute);
  const initialEndTime = addMinutesToDateTime(initialDate, initialStartTime, 15).time;
  const [occurrences, setOccurrences] = useState<TimedDate[]>([{ date: initialDate, start: initialStartTime, end: initialEndTime }]);
  const [selectedAttendees, setSelectedAttendees] = useState<AttendeePerson[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [selectedContext, setSelectedContext] = useState<LinkedContext | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const previousHasInvitees = useRef(false);
  const [locationSnapshot, setLocationSnapshot] = useState<LocationSnapshot | null>(null);
  const [error, setError] = useState(false);
  const [orgError, setOrgError] = useState(false);
  const [contextError, setContextError] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [locationValid, setLocationValid] = useState(true);
  const [dateError, setDateError] = useState(false);
  const [multipleDateAttemptError, setMultipleDateAttemptError] = useState<string | null>(null);
  const [linkedToError, setLinkedToError] = useState(false);
  const [description, setDescription] = useState("");
  const [selectedEventType, setEventType] = useState(fixedEventType ?? editingEvent?.eventType ?? configuredEventTypeNames[0] ?? "Meeting");
  const [eventTypeError, setEventTypeError] = useState(false);
  const [eventTypeMenuOpen, setEventTypeMenuOpen] = useState(false);
  const [linkedRecords, setLinkedRecords] = useState<LinkedRecord[]>([]);
  const [sending, setSending] = useState(false);

  // Step 2 Invitation States
  const [activeInviteTab, setActiveInviteTab] = useState<"candidate" | "contact" | "internal">("candidate");
  const [sidePanel, setSidePanel] = useState<"templates" | "placeholders" | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<"Vacancy" | "Candidate" | "Company" | "Interview">("Vacancy");
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");

  const defaultEmailSubjects: Record<"candidate" | "contact" | "internal", string> = {
    candidate: "Invitation: [Event.Title]",
    contact: "Invitation: [Event.Title]",
    internal: "Invitation: [Event.Title]",
  };
  // Keep subject in sync with the title the user typed (editable), so the subject field shows the real title, not the variable.
  // Only overwrites subjects that still contain the placeholder or are still the default.
  const subjectFromTitle = title.trim() ? `Invitation: ${title.trim()}` : "Invitation: [Event.Title]";

  const defaultEmailBodies: Record<"candidate" | "contact" | "internal", string> = {
    candidate: "",
    contact: "",
    internal: "",
  };

  const [emailSubjects, setEmailSubjects] = useState(defaultEmailSubjects);
  const subjectTouchedRef = useRef(false);
  // Sync subject to the exact title the user typed (until they manually edit subject).
  // Shows full event title, not just first letter, and keeps it editable.
  useEffect(() => {
    if (subjectTouchedRef.current) return;
    if (!title.trim()) {
      setEmailSubjects(defaultEmailSubjects);
      return;
    }
    const resolved = `Invitation: ${title.trim()}`;
    setEmailSubjects((prev) => {
      // If subject was auto-derived (placeholder or previous resolved), keep in sync
      const isAuto = (v: string) => v.includes("[Event.Title]") || v.startsWith("Invitation: ");
      // Only auto-update if not manually touched; check each tab
      let changed = false;
      const next = { ...prev };
      (["candidate", "contact", "internal"] as const).forEach((k) => {
        if (isAuto(next[k])) {
          // If subject is auto, update to current full title; prevents truncation to first letter
          if (next[k] !== resolved) {
            next[k] = resolved;
            changed = true;
          }
        }
      });
      return changed ? next : prev;
    });
  }, [title]);
  const [emailBodies, setEmailBodies] = useState(defaultEmailBodies);
  const [smartDocument, setSmartDocument] = useState<SmartEventDocument | null>(null);
  // AI drafting state
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [draftedOnce, setDraftedOnce] = useState(false);

  const reminderRef = useRef<HTMLDivElement>(null);
  const eventTypeRef = useRef<HTMLDivElement>(null);
  const invitationPreparedRef = useRef(false);
  const todayKey = dateKey(getTodayUtcPlusTwo());
  const startDate = occurrences[0]?.date ?? "";
  const selectedTalent = selectedAttendees.find((person) => person.type === "candidate");
  const selectedContact = selectedAttendees.find((person) => person.type === "contact");
  const selectedInternals = selectedAttendees.filter((person) => person.type === "internal");

  const dateMissing = occurrences.length === 0 || occurrences.some((occurrence) => !occurrence.date || !occurrence.start || !occurrence.end);
  const isEditMode = Boolean(isEdit && editingEvent);
  const isRescheduleSameDate = Boolean(rescheduleDate && !isEditMode && occurrences.some((occurrence) => occurrence.date === rescheduleDate));
  const multipleDateAttendeeError = multipleDateError(occurrences.length, selectedAttendees);
  const visibleMultipleDateError = multipleDateAttendeeError ?? multipleDateAttemptError;

  useEffect(() => {
    if (fixedContext) {
      setSelectedContext(fixedContext);
      const org = organizations[fixedContext.organizationId] ?? { id: fixedContext.organizationId, name: fixedContext.organization, initials: fixedContext.organizationInitials, relationship: "Subsidiary" as const };
      setSelectedOrganization(org as Organization);
    }
  }, [fixedContext, open]);

  const eventType = configuredEventTypeNames.includes(selectedEventType)
    ? selectedEventType
    : [fixedEventType, editingEvent?.eventType].find((value): value is string => Boolean(value && configuredEventTypeNames.includes(value))) ?? configuredEventTypeNames[0] ?? "Meeting";

  useEffect(() => {
    if (!dateMissing && !isRescheduleSameDate) setDateError(false);
  }, [dateMissing, isRescheduleSameDate]);

  useEffect(() => {
    setMultipleDateAttemptError(null);
  }, [selectedAttendees]);

  useEffect(() => {
    if (open && rescheduleDate && startDate === rescheduleDate && !isEditMode) setDateError(true);
  }, [open, rescheduleDate, startDate, isEditMode]);

  const availableInviteTabs = useMemo(() => {
    const tabs: { key: "candidate" | "contact" | "internal"; label: string }[] = [];
    if (selectedAttendees.some((person) => person.type === "candidate")) {
      tabs.push({ key: "candidate", label: "Candidate Invitation" });
    }
    if (selectedAttendees.some((person) => person.type === "contact")) {
      tabs.push({ key: "contact", label: "Contact Invitation" });
    }
    if (selectedAttendees.some((person) => person.type === "internal")) {
      tabs.push({ key: "internal", label: "Internal Invitation" });
    }
    if (tabs.length === 0) {
      tabs.push({ key: "candidate", label: "Candidate Invitation" });
    }
    return tabs;
  }, [selectedAttendees]);

  useEffect(() => {
    if (availableInviteTabs.length > 0 && !availableInviteTabs.some((t) => t.key === activeInviteTab)) {
      setActiveInviteTab(availableInviteTabs[0].key);
    }
  }, [availableInviteTabs, activeInviteTab]);

  const selectedTalentContextLinks = selectedTalent?.links ?? [];
  const sharedOrganizationIds = selectedTalent && selectedContact
    ? (selectedContact.organizations ?? []).filter((id) => selectedTalentContextLinks.some((item) => item.organizationId === id))
    : selectedContact?.organizations ?? [];

  const reminderLimits: Record<ReminderUnit, { max: number; copy: string }> = {
    minutes: { max: 40320, copy: "The value must be between the range of 0 to 40 320 minutes." },
    hours: { max: 672, copy: "The value must be between the range of 0 to 672 hours." },
    days: { max: 28, copy: "The value must be between the range of 0 to 28 days." },
    weeks: { max: 4, copy: "The value must be between the range of 0 to 4 weeks." },
  };
  const reminderDefaults: Record<ReminderUnit, string> = { minutes: "15", hours: "2", days: "2", weeks: "1" };
  const hasInvitees = selectedAttendees.length > 0;

  const selectAttendee = (person: AttendeePerson) => {
    setSelectedAttendees((current) => current.some((attendee) => attendee.id === person.id) ? current : [...current, person]);
  };

  const removeAttendee = (id: string) => {
    const removing = selectedAttendees.find((person) => person.id === id);
    setSelectedAttendees((current) => current.filter((person) => person.id !== id));
    if (removing?.type === "candidate" || removing?.type === "contact") {
      setSelectedOrganization(null);
      setSelectedContext(null);
      setOrgError(false);
      setContextError(false);
    }
  };

  // Linked to -> Attendees: candidate/contact linked becomes removable attendee (job/oppo/org just linked)
  useEffect(() => {
    const linkedCandidatesContacts = linkedRecords.filter((r) => r.type === "Candidate" || r.type === "Contact");
    if (linkedCandidatesContacts.length === 0) return;
    setSelectedAttendees((current) => {
      let next = [...current];
      let changed = false;
      for (const rec of linkedCandidatesContacts) {
        const id = rec.item.id;
        if (next.some((p) => p.id === id)) continue;
        let person: AttendeePerson | undefined;
        if (rec.type === "Candidate") person = attendeeDirectory.candidate.find((p) => p.id === id);
        else if (rec.type === "Contact") person = attendeeDirectory.contact.find((p) => p.id === id);
        if (!person) {
          person = {
            id: rec.item.id,
            name: rec.item.name,
            email: rec.item.email ?? "",
            type: rec.type === "Contact" ? "contact" : "candidate",
            avatar: rec.item.avatar ?? "",
          } as AttendeePerson;
        }
        next = [...next, { ...person!, locked: false }];
        changed = true;
      }
      return changed ? next : current;
    });
  }, [linkedRecords]);

  useEffect(() => {
    if (hasInvitees && !previousHasInvitees.current) {
      setLocationOpen(true);
    }
    if (!hasInvitees && previousHasInvitees.current) {
      setLocationOpen(false);
      setLocationError(false);
    }
    previousHasInvitees.current = hasInvitees;
  }, [hasInvitees]);

  useEffect(() => {
    if (editingEvent || fixedContext) return;
    if (!selectedTalent && !selectedContact) {
      setSelectedOrganization(null);
      setSelectedContext(null);
      return;
    }
    const links = selectedTalent?.links ?? Object.values(linkedContexts).filter((item) => (selectedContact?.organizations ?? []).includes(item.organizationId));
    if (!selectedContact) {
      setSelectedOrganization(null);
      setSelectedContext(links.length === 1 ? links[0] : null);
      return;
    }
    const sharedIds = (selectedContact.organizations ?? []).filter((id) => !selectedTalent || links.some((item) => item.organizationId === id));
    if (selectedTalent && selectedContact) {
      const combined = selectedTalentContextLinks;
      setSelectedOrganization(null);
      setSelectedContext(combined.length === 1 ? combined[0] : null);
      return;
    }
    if (sharedIds.length !== 1) {
      setSelectedOrganization(null);
      setSelectedContext(null);
      return;
    }
    const organization = organizations[sharedIds[0]] ?? ({ id: sharedIds[0], name: sharedIds[0], initials: sharedIds[0].slice(0, 2).toUpperCase(), relationship: "Subsidiary" as const } as Organization);
    if (!organization) {
      setSelectedOrganization(null);
      setSelectedContext(null);
      return;
    }
    const relatedLinks = links.filter((item) => item.organizationId === organization.id);
    setSelectedOrganization(organization);
    setSelectedContext(relatedLinks.length === 1 ? relatedLinks[0] : null);
  }, [selectedTalent?.id, selectedContact?.id, editingEvent, fixedContext]);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!reminderRef.current?.contains(event.target as Node)) setReminderMenuOpen(false);
      if (!eventTypeRef.current?.contains(event.target as Node)) setEventTypeMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  const chooseOrganization = (organization: Organization) => {
    const links = (selectedTalent?.links ?? Object.values(linkedContexts)).filter((item) => item.organizationId === organization.id);
    setSelectedOrganization(organization);
    setSelectedContext(links.length === 1 ? links[0] : null);
  };

  useEffect(() => {
    if (!open) return;
    const initialStart = formatCompactTime(slot.hour, slot.minute);
    const initialDate = slot.date || dateKey(getTodayUtcPlusTwo());
    const initialEnd = addMinutesToDateTime(initialDate, initialStart, 15);
    setDrawerStep(initialStep ?? 1);
    invitationPreparedRef.current = false;
    setOccurrences([{ date: initialDate, start: initialStart, end: initialEnd.date === initialDate ? initialEnd.time : "23:45" }]);
    if (editingEvent) {
      const editAttendees = (editingEvent.storedAttendees ?? []).map((a) => {
        const dirPerson = (attendeeDirectory[a.type as AttendeeType] ?? []).find((p) => p.id === a.id);
        return { id: a.id, name: a.name, email: a.email, type: a.type as AttendeeType, avatar: a.avatar || dirPerson?.avatar || "", links: (a.links as LinkedContext[] | undefined) ?? dirPerson?.links, organizations: a.organizations ?? dirPerson?.organizations, schedules: (a.schedules as AttendeePerson["schedules"]) ?? dirPerson?.schedules, locked: a.locked } as AttendeePerson;
      });
      setSelectedAttendees(editAttendees);
      setSelectedOrganization((editingEvent.storedOrganization as Organization) ?? null);
      setSelectedContext((editingEvent.storedContext as LinkedContext) ?? null);
      setLocationSnapshot(editingEvent.storedLocation ?? null);
      setTitle(editingEvent.title);
      const eStart = formatCompactTime(editingEvent.hour, editingEvent.minute);
      const eEnd = formatCompactTime(editingEvent.endHour, editingEvent.endMinute);
      setOccurrences([{ date: editingEvent.date, start: eStart, end: eEnd }]);
      setDescription(editingEvent.description ?? "");
      setLocationOpen(editingEvent.storedLocation ? editingEvent.storedLocation.open : true);
    } else {
      const initialContactAttendees = initialContact ? [buildContactAttendee(initialContact)] : [];
      const initialCandidateAttendees = initialCandidate ? [{ ...buildCandidateAttendee(initialCandidate), locked: false }] : [];
      const initialAttendees = initialContactAttendees.length ? initialContactAttendees : initialCandidateAttendees;
      setSelectedAttendees(initialAttendees);
      setLocationSnapshot(null);
      if (initialContactAttendees.length) {
        const orgIds = (initialContact as any).organizations ?? (initialContact?.organizationId ? [initialContact.organizationId] : []);
        if (orgIds.length === 1) {
          const orgId = orgIds[0];
          const knownOrganization = organizations[orgId] ?? ({ id: orgId, name: initialContact?.organization ?? orgId, initials: orgId.slice(0, 2).toUpperCase(), relationship: "Subsidiary" as const } as Organization);
          setSelectedOrganization(knownOrganization as Organization);
          const relatedLinks = Object.values(linkedContexts).filter((item) => item.organizationId === orgId);
          setSelectedContext(relatedLinks.length === 1 ? relatedLinks[0] : null);
        } else {
          setSelectedOrganization(null);
          setSelectedContext(null);
        }
      } else if (fixedContext) {
        const fixedOrg = organizations[fixedContext.organizationId] ?? { id: fixedContext.organizationId, name: fixedContext.organization, initials: fixedContext.organizationInitials, relationship: "Subsidiary" as const };
        setSelectedOrganization(fixedOrg as Organization);
        setSelectedContext(fixedContext);
      } else {
        setSelectedOrganization(null);
        setSelectedContext(null);
      }
      setTitle("");
      setDescription("");
      setLocationOpen(!!initialAttendees.length);
    }
    if (editingEvent) {
      const storedMinutes = editingEvent.storedReminder;
      if (storedMinutes != null) {
        setReminder(true);
        if (storedMinutes % 10080 === 0) { setReminderValue(String(storedMinutes / 10080)); setReminderUnit("weeks"); }
        else if (storedMinutes % 1440 === 0) { setReminderValue(String(storedMinutes / 1440)); setReminderUnit("days"); }
        else if (storedMinutes % 60 === 0) { setReminderValue(String(storedMinutes / 60)); setReminderUnit("hours"); }
        else { setReminderValue(String(storedMinutes)); setReminderUnit("minutes"); }
      } else {
        setReminder(false);
        setReminderValue("15");
        setReminderUnit("minutes");
      }
    } else {
      setReminder(true);
      setReminderValue("15");
      setReminderUnit("minutes");
    }
    setReminderMenuOpen(false);
    setEventType([fixedEventType, editingEvent?.eventType].find((value): value is string => Boolean(value && configuredEventTypeNames.includes(value))) ?? configuredEventTypeNames[0] ?? "Meeting");
    setEventTypeError(false);
    setEventTypeMenuOpen(false);
    setLinkedRecords(initialLinkedRecords ?? []);
    setLinkedToError(false);
    setError(false);
    setOrgError(false);
    setContextError(false);
    setLocationError(false);
    setDateError(Boolean(rescheduleDate && editingEvent && !isEditMode && editingEvent.date === rescheduleDate));
    setSidePanel(null);
    setEmailSubjects(defaultEmailSubjects);
    setEmailBodies(defaultEmailBodies);
    setSmartDocument(null);
    setDraftedOnce(false);
    setAiError(null);
  }, [open, slot.date, slot.hour, slot.minute, initialCandidate, initialContact, editingEvent, rescheduleDate, initialStep, fixedEventType, configuredEventTypeNames, initialLinkedRecords]);

  const getOccurrences = (): TimedDate[] =>
    [...occurrences].sort((a, b) => dateTimeStamp(a.date, a.start) - dateTimeStamp(b.date, b.start));

  const validateEvent = () => {
    const problems = { title: !title.trim(), date: dateMissing || isRescheduleSameDate, organization: false, context: false, location: false, eventType: false, linkedTo: false, multipleDateAttendees: Boolean(multipleDateAttendeeError) };
    problems.eventType = !eventType.trim();
    problems.location = hasInvitees && (!locationOpen || !locationValid);
    setError(problems.title);
    setDateError(problems.date);
    setOrgError(problems.organization);
    setContextError(problems.context);
    setLocationError(problems.location);
    setEventTypeError(problems.eventType);
    setLinkedToError(problems.linkedTo);
    const hasError = problems.title || problems.date || problems.organization || problems.context || problems.location || problems.eventType || problems.linkedTo || problems.multipleDateAttendees;
    if (hasError) {
      window.setTimeout(() => {
        const body = document.querySelector(".event-drawer.open .drawer-body") as HTMLElement | null;
        if (!body) return;
        if (problems.title || problems.eventType) {
          body.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        const firstError = body.querySelector(".field-error") as HTMLElement | null;
        if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        else body.scrollTo({ top: 0, behavior: "smooth" });
      }, 60);
    }
    return !hasError;
  };

  const buildMeta = (): EventMeta => ({
    description,
    attendees: selectedAttendees.map((p) => ({ id: p.id, name: p.name, email: p.email, type: p.type, avatar: p.avatar, links: p.links, organizations: p.organizations, schedules: p.schedules, locked: p.locked })),
    reminderLabel: reminder ? `${reminderValue} ${reminderUnit}` : "none",
    organization: selectedOrganization,
    linkedContext: selectedContext,
    location: locationSnapshot,
    eventType,
    relatedTo: linkedRecords[0] ? { type: linkedRecords[0].type, item: linkedRecords[0].item } : null,
    linkedRecords,
  });

  const shouldPreviewInvitation = selectedAttendees.length > 0;

  /** Build the single canonical Step 1 JSON document used by AI + send. */
  const buildSmartDocument = (): SmartEventDocument => {
    const typeDefinition = configuredEventTypes.find((item) => item.name === eventType);
    const records: SmartLinkedRecord[] = linkedRecords.flatMap((record) => {
      const label = String(record.item?.name ?? record.item?.title ?? record.item?.organization ?? "").trim();
      if (!label) return [];
      return [{
        type: record.type,
        id: String(record.item?.id ?? record.item?.reference ?? `${record.type}-${label}`),
        label,
        avatar: typeof record.item?.avatar === "string" ? record.item.avatar : undefined,
        variable: LINKED_VARIABLE_BY_TYPE[record.type],
      }];
    });
    // Relationship helpers can auto-select an organization or job from a
    // contact's existing CRM relationships. Only records explicitly shown in
    // the Linked to section are allowed to become AI context.

    const attendees: SmartEventDocument["attendees"] = selectedAttendees.map((attendee) => ({
      id: attendee.id,
      type: attendee.type,
      fullName: attendee.name,
      email: attendee.email,
      avatar: attendee.avatar,
    }));
    const provider = locationSnapshot?.provider;
    const location: SmartEventDocument["event"]["location"] = !locationOpen || !locationSnapshot
      ? { type: "none", label: "No location", value: null }
      : locationSnapshot.type === "online"
        ? {
            type: "online",
            label: "Online",
            provider,
            value:
              provider === "manual"
                ? locationSnapshot.manualUrl ?? null
                : provider === "google"
                  ? null
                  : provider
                    ? meetingProviders[provider].link
                    : null,
            generatedOnCreate: provider === "google",
          }
        : locationSnapshot.type === "company"
          ? { type: "company", label: "Company address", value: locationSnapshot.office || null }
          : {
              type: "custom",
              label: "Other location",
              value: [
                locationSnapshot.custom.street,
                locationSnapshot.custom.number,
                locationSnapshot.custom.box,
                locationSnapshot.custom.zip,
                locationSnapshot.custom.city,
                locationSnapshot.custom.country,
              ].filter(Boolean).join(", ") || locationSnapshot.custom.query || null,
            };
    const reminderMinutes = reminder
      ? Math.max(0, Number(reminderValue) || 0) *
        (reminderUnit === "minutes" ? 1 : reminderUnit === "hours" ? 60 : reminderUnit === "days" ? 1440 : 10080)
      : null;
    const email = session?.user?.email?.toLowerCase() ?? "organizer@wiggli.com";
    const smartSlots: SmartEventSlot[] = getOccurrences().map((occurrence) => ({
      date: occurrence.date,
      startTime: occurrence.start,
      endTime: occurrence.end,
    }));
    const primarySlot = smartSlots[0];
    const document: SmartEventDocument = {
      schemaVersion: 1,
      event: {
        title: title.trim(),
        type: {
          id: typeDefinition?.id,
          name: eventType,
          context: typeDefinition?.description || `A professional ${eventType.toLowerCase()} calendar event.`,
        },
        description: description.trim() || undefined,
         date: primarySlot?.date ?? "",
         startTime: primarySlot?.startTime ?? "",
         endTime: primarySlot?.endTime ?? "",
         slots: smartSlots,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris",
        location,
        ...(locationSnapshot?.aiNotetaker === true ? { aiNotetaker: true } : {}),
        reminderMinutes,
      },
      organizer: {
        fullName: session?.user?.name?.trim() || email.split("@")[0],
        email,
        avatar: session?.user?.image ?? undefined,
        phone: "BE +32456555992",
      },
      linkedTo: records,
      attendees,
      audiences: [],
    };
    document.audiences = buildSmartAudiences(attendees, records);
    return document;
  };

  const generateDrafts = async (
    instruction?: string,
    documentOverride?: SmartEventDocument,
    rebuild = false
  ) => {
    setAiBusy(true);
    setAiError(null);
    try {
      const document = documentOverride ?? smartDocument ?? buildSmartDocument();
      setSmartDocument(document);
      // Minimum "thinking" window so the generating glow reads as AI work,
      // even when the API answers instantly.
      const minDuration = new Promise((resolve) => setTimeout(resolve, 700));
      const res = await fetch("/api/invite-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ document, instruction }),
      });
      const body = await res.json();
      await minDuration;
      if (!res.ok) {
        notifyIfGoogleSessionExpired(res, body);
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setEmailBodies((prev) => {
        const next = { ...prev };
        for (const { type: tab } of document.audiences) {
          const paragraph = String(body.paragraphs?.[tab] ?? "").trim();
          if (!paragraph) continue;
          next[tab] = rebuild || !prev[tab]
            ? buildSmartInvitationHtml(document, tab, paragraph)
            : replaceSmartContextBlock(prev[tab], paragraph);
        }
        return next;
      });
      if (rebuild) {
        const subjectTitle = document.event.title?.trim() || title.trim() || "Event";
        const resolvedSubject = `Invitation: ${subjectTitle}`;
        setEmailSubjects({ candidate: resolvedSubject, contact: resolvedSubject, internal: resolvedSubject });
      }
      setDraftedOnce(true);
      showToast(
        body.source === "fallback"
          ? "Smart draft ready using Wiggli's fallback copy"
          : instruction
            ? "Context paragraphs updated with AI"
            : "Smart draft ready for each attendee type"
      );
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setAiBusy(false);
    }
  };

  // Draft events opened from the preview already have all Step 1 details. Once
  // the drawer has hydrated those details, prepare the invitation review copy
  // so the user can immediately inspect it before sending.
  useEffect(() => {
    if (!open || drawerStep !== 2 || initialStep !== 2 || !editingEvent || rescheduleDate || invitationPreparedRef.current) return;
    invitationPreparedRef.current = true;
    const timer = window.setTimeout(() => {
      const document = buildSmartDocument();
      setSmartDocument(document);
      void generateDrafts(undefined, document, true);
    }, 0);
    return () => window.clearTimeout(timer);
    // State hydration intentionally happens in the open/reset effect above;
    // this callback runs on the following render with the hydrated values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, drawerStep, initialStep, editingEvent, rescheduleDate]);

  const submit = () => {
    if (!validateEvent()) return;

    // NATIVE variant: single step — create via Google's own invitations.
    if (nativeMode) {
      void (async () => {
        setSending(true);
        try {
          const occurrence = getOccurrences()[0];
          if (!occurrence) throw new Error("Select at least one time slot.");
          const res = await fetch("/api/native-events", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              title: title.trim(),
              description,
              location:
                locationSnapshot?.type === "online"
                  ? undefined
                  : locationSnapshot
                    ? locationSnapshot.custom.street || locationSnapshot.office || locationSnapshot.custom.query || ""
                    : undefined,
              conference: locationSnapshot?.type === "online" && locationSnapshot?.provider === "google",
              meetLink: null,
              reminderMinutes: reminder
                ? Math.max(0, Number(reminderValue) || 0) *
                  (reminderUnit === "minutes" ? 1 : reminderUnit === "hours" ? 60 : reminderUnit === "days" ? 1440 : 10080)
                : null,
               date: occurrence.date,
               start: occurrence.start,
               end: occurrence.end,
               slots: getOccurrences().map((item) => ({ date: item.date, start: item.start, end: item.end })),
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris",
              eventType,
              attendees: selectedAttendees.map((r) => ({ email: r.email, name: r.name, type: r.type, avatar: r.avatar })),
              organizerAvatar: session?.user?.image ?? undefined,
              linkedRecords: linkedRecords.map((record) => ({ type: record.type, label: String(record.item?.name ?? record.item?.title ?? record.item?.organization ?? record.type), avatar: typeof record.item?.avatar === "string" ? record.item.avatar : undefined })),
              locationType: locationSnapshot?.type,
            }),
          });
          const created = await res.json();
          if (!res.ok) {
            notifyIfGoogleSessionExpired(res, created);
            throw new Error(created.error ?? `HTTP ${res.status}`);
          }
          onCreate(title.trim(), getOccurrences(), buildMeta());
          showToast(`${title.trim()} created — Google emailed native invitations`);
          onClose();
        } catch (err) {
          showToast(err instanceof Error ? err.message : "Failed to create event");
        } finally {
          setSending(false);
        }
      })();
      return;
    }

    if (!shouldPreviewInvitation) {
      // Organizer-only events still belong in Google Calendar, but have no
      // invitees to notify. Use the native endpoint with an empty attendee list.
      if (selectedAttendees.length === 0) {
        void (async () => {
          setSending(true);
          try {
            const occurrence = getOccurrences()[0];
            if (!occurrence) throw new Error("Select at least one time slot.");
            const location = locationSnapshot?.type === "online"
              ? undefined
              : locationSnapshot
                ? locationSnapshot.custom.street || locationSnapshot.office || locationSnapshot.custom.query || ""
                : undefined;
            const res = await fetch("/api/native-events", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                title: title.trim() || "Event",
                description,
                location,
                conference: locationSnapshot?.type === "online" && locationSnapshot?.provider === "google",
                date: occurrence.date,
                start: occurrence.start,
                end: occurrence.end,
                slots: getOccurrences().map((item) => ({ date: item.date, start: item.start, end: item.end })),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris",
                eventType,
                attendees: [],
                organizerAvatar: session?.user?.image ?? undefined,
                linkedRecords: linkedRecords.map((record) => ({ type: record.type, label: String(record.item?.name ?? record.item?.title ?? record.item?.organization ?? record.type), avatar: typeof record.item?.avatar === "string" ? record.item.avatar : undefined })),
                locationType: locationSnapshot?.type,
                reminderMinutes: reminder ? Math.max(0, Number(reminderValue) || 0) : null,
              }),
            });
            const created = await res.json();
            if (!res.ok) {
              notifyIfGoogleSessionExpired(res, created);
              throw new Error(created.error ?? `HTTP ${res.status}`);
            }
            onCreate(title.trim() || "Event", getOccurrences(), { ...buildMeta(), status: "SCHEDULED" });
            showToast(`${title.trim() || "Event"} created in Google Calendar`);
            onClose();
          } catch (err) {
            showToast(err instanceof Error ? err.message : "Failed to create event");
          } finally {
            setSending(false);
          }
        })();
        return;
      }
      onCreate(title.trim(), getOccurrences(), { ...buildMeta(), status: "SCHEDULED" });
      showToast(`${title.trim()} created successfully`);
      setTitle("");
      setDescription("");
      setError(false);
    } else if (rescheduleDate && editingEvent) {
      // Reschedule mode: go to Step 2 to add update note before dispatching.
      setDrawerStep(2);
    } else {
      // Build one canonical document, then draft the fixed invitation around
      // one AI-owned context paragraph per attendee audience.
      const document = buildSmartDocument();
      setSmartDocument(document);
      setDrawerStep(2);
      setSidePanel(null);
      void generateDrafts(undefined, document, true);
    }
  };

  const saveAsLogged = () => {
    if (!validateEvent()) return;
    onCreate(title.trim(), getOccurrences(), { ...buildMeta(), status: "LOGGED" });
    showToast(`${title.trim()} saved as logged`);
    setTitle("");
    setDescription("");
    setError(false);
  };

  const saveAsDraft = () => {
    if (!title.trim()) {
      setError(true);
      return;
    }
    if (dateMissing) {
      setDateError(true);
      return;
    }
    if (multipleDateAttendeeError) {
      setMultipleDateAttemptError(multipleDateAttendeeError);
      return;
    }
    onCreate(title.trim(), getOccurrences(), { ...buildMeta(), status: "DRAFT" });
    showToast(`${title.trim()} saved as draft`);
    setTitle("");
    setDescription("");
    setError(false);
  };

  /** Called from Step 2 in reschedule mode: calls the reschedule API with new date/time + note. */
  const handleReschedule = async () => {
    if (!editingEvent) return;
    const occ = getOccurrences()[0];
    if (!occ) return;
    if (String(editingEvent.id).startsWith("draft-")) {
      onCreate(title.trim() || "Event", getOccurrences(), { ...buildMeta(), status: "DRAFT" });
      showToast(`${title.trim() || "Event"} rescheduled as draft`);
      onRescheduleComplete?.();
      onClose();
      return;
    }
    setSending(true);
    try {
      const reminderMinutesForPayload = reminder
        ? Math.max(0, Number(reminderValue) || 0) *
          (reminderUnit === "minutes" ? 1 : reminderUnit === "hours" ? 60 : reminderUnit === "days" ? 1440 : 10080)
        : null;
      const locationValue = !locationOpen || !locationSnapshot
        ? undefined
        : locationSnapshot.type === "online"
          ? (locationSnapshot.provider === "manual"
              ? locationSnapshot.manualUrl ?? undefined
              : locationSnapshot.provider === "google"
                ? undefined
                : (locationSnapshot.provider ? meetingProviders[locationSnapshot.provider]?.link ?? undefined : undefined))
          : locationSnapshot.type === "company"
            ? locationSnapshot.office || undefined
            : ([locationSnapshot.custom.street, locationSnapshot.custom.number, locationSnapshot.custom.box, locationSnapshot.custom.zip, locationSnapshot.custom.city, locationSnapshot.custom.country].filter(Boolean).join(", ") || locationSnapshot.custom.query || undefined);
      const res = await fetch(`/api/events/${editingEvent.id}/reschedule`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          start: `${occ.date}T${occ.start}:00`,
          end: `${occ.date}T${occ.end}:00`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris",
          description: description || undefined,
          note: rescheduleNote.trim() || undefined,
          summary: title.trim() || undefined,
          ...(locationValue !== undefined ? { location: locationValue } : {}),
          attendees: selectedAttendees.map((a) => ({ email: a.email, name: a.name, type: a.type })),
          reminderMinutes: reminderMinutesForPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const failedCount = Array.isArray(data.notifyFailed) ? data.notifyFailed.length : 0;
      if (failedCount > 0) {
        showToast(`${title} updated, but the notification email failed for ${failedCount} attendee${failedCount > 1 ? "s" : ""}`);
      } else {
        showToast(`${title} updated — ${data.notified ?? 0} attendee(s) notified`);
      }
      onRescheduleComplete?.();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Reschedule failed");
    } finally {
      setSending(false);
    }
  };

  const handleSendInvitation = async () => {
    const recipients = [...selectedAttendees];
    if (!startDate) return;
    const document = smartDocument ?? buildSmartDocument();

    setSending(true);
    try {
      // Create the Google event ONCE (with Meet + reminder), inviting all attendees.
      // Both composed modes share this exact reviewed document. Only the
      // transport changes, keeping the Smart-vs-Resend comparison controlled.
      const createRes = await fetch(resendRsvpMode ? "/api/resend-events" : "/api/drawer-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          smartDocument: document,
          inviteMessages: Object.entries(emailBodies).map(([tab, bodyHtml]) => ({
            tab: tab as "candidate" | "contact" | "internal",
            subject: emailSubjects[tab as "candidate" | "contact" | "internal"],
            body: htmlWithVarTokens(bodyHtml),
            bodyHtml: htmlWithVarTokens(bodyHtml),
          })),
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok) {
        notifyIfGoogleSessionExpired(createRes, created);
        throw new Error(created.error ?? `HTTP ${createRes.status}`);
      }

      const draftIsBeingScheduled = initialStep === 2 && Boolean(editingEvent && String(editingEvent.id).startsWith("draft-"));
      onCreate(title.trim(), getOccurrences(), draftIsBeingScheduled ? { ...buildMeta(), status: "SCHEDULED" } : buildMeta());
      showToast(`${title.trim()} created — ${resendRsvpMode ? "Resend RSVP invitations" : "Google event"}${created.hangoutLink ? " + Meet link" : ""} synced`);
      // AI Notetaker hook: schedule the Recall bot on the created event (fire-and-forget).
      // Reads the "Wiggli Notetaker" toggle from the Online location section.
      if (locationSnapshot?.aiNotetaker) {
        if (!created.id) {
          showToast("AI Notetaker skipped — created event has no id.");
        } else {
        const eventId = String(created.id);
        if (locationSnapshot.provider !== "google") {
          showToast("AI Notetaker needs Google Meet as the meeting provider for now.");
        } else {
        void fetch("/api/notetaker/notes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventId, source: "RECALL_BOT" }),
        })
          .then(async (noteRes) => {
            const noteBody = await noteRes.json().catch(() => ({}));
            if (!noteRes.ok) throw new Error(noteBody.error ?? `HTTP ${noteRes.status}`);
            showToast("AI Notetaker scheduled — admit “Wiggli Notetaker” in the Meet.");
          })
          .catch((noteErr) => showToast(`Notetaker failed: ${noteErr instanceof Error ? noteErr.message : "unknown error"}`));
        }
        }
      }
      window.setTimeout(() => {
        if (recipients.length === 1) showToast(`Personalized invitation emailed to ${recipients[0].name}`);
        else showToast(`${recipients.length} personalized invitations sent successfully`);
      }, 1500);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setSending(false);
    }
  };

  /**
   * Chip bar: every variable the AI/user can use, filtered to what the current
   * drawer inputs actually provide. Contextual chips (Linked.*, groups, Meet)
   * only appear when their input exists — matching what the resolver can fill.
   */
  const availableVariables = useMemo(() => {
    const linkedTypes = new Set(linkedRecords.map((r) => r.type));
    const hasCandidates = selectedAttendees.some((p) => p.type === "candidate");
    const hasContacts = selectedAttendees.some((p) => p.type === "contact");
    const hasInternals = selectedAttendees.some((p) => p.type === "internal");
    const hasMeet = locationSnapshot?.type === "online" && locationSnapshot?.provider === "google";
    const hasOrg = Boolean(selectedOrganization) || linkedTypes.has("Organization");
    const hasJob = linkedTypes.has("Job") || selectedContext?.kind === "job";
    const hasOpportunity = linkedTypes.has("Opportunity") || selectedContext?.kind === "opportunity";

    const contextualWhen: Record<string, boolean> = {
      "[Meeting.Link]": hasMeet,
      "[Event.Description]": Boolean(description.trim()),
      "[Event.Location]": Boolean(locationSnapshot && locationSnapshot.type !== "online"),
      "[Event.Reminder]": reminder,
      "[Organizer.Phone]": true,
      "[Organizer.Email]": true,
      "[Linked.Candidate]": linkedTypes.has("Candidate"),
      "[Linked.Contact]": linkedTypes.has("Contact"),
      "[Linked.Job]": hasJob,
      "[Linked.Opportunity]": hasOpportunity,
      "[Linked.Organization]": hasOrg,
      "[Organization.Name]": hasOrg,
      "[Job.Title]": hasJob,
      "[Attendees.Candidates]": hasCandidates,
      "[Attendees.Contacts]": hasContacts,
      "[Attendees.Internals]": hasInternals,
    };
    return INVITE_VARIABLES.filter((v) => contextualWhen[v.tag] ?? true).map((v) => ({
      tag: v.tag,
      hint: v.label,
    }));
  }, [selectedOrganization, selectedContext, locationSnapshot, linkedRecords, selectedAttendees, description, reminder]);

  const activeRecipients = useMemo(() => {
    if (activeInviteTab === "candidate") {
      const candidates = selectedAttendees.filter((p) => p.type === "candidate");
      return candidates.length > 0 ? candidates : selectedAttendees;
    }
    if (activeInviteTab === "contact") {
      const contacts = selectedAttendees.filter((p) => p.type === "contact");
      return contacts.length > 0 ? contacts : selectedAttendees;
    }
    const internals = selectedAttendees.filter((p) => p.type === "internal");
    return internals.length > 0 ? internals : selectedAttendees;
  }, [selectedAttendees, activeInviteTab]);

  return (
    <>
      <button className={`drawer-scrim ${open ? "visible" : ""}`} onClick={onClose} aria-label="Close event drawer" />
      <aside
        className={`event-drawer ${open ? "open" : ""}`}
        aria-hidden={!open}
      >
        {drawerStep === 1 ? (
          <>
            <div className="drawer-heading"><h2>{rescheduleDate && editingEvent ? (isEditMode ? `Edit event — ${title}` : `Reschedule — ${title}`) : editingEvent ? "Edit event" : "New Event"}</h2><button onClick={onClose} aria-label="Close"><X size={17} /></button></div>
            <div className="drawer-body">
              <section className="drawer-form-column">
                <label className="field-label"><span>Title<span className="required-star">*</span></span></label>
                <input
                  className="drawer-title-input"
                  value={title}
                  onChange={(event) => { setTitle(event.target.value); setError(false); }}
                  placeholder="Add a title"
                />
                {error && <p className="field-error"><FieldErrorIcon /> Event title is required</p>}

                 <div className="field-label field-space event-type-label-row"><span className="event-type-label-copy">Event type<span className="required-star">*</span></span></div>
                <div ref={eventTypeRef} className="event-type-dropdown-wrap" style={{ position: "relative" }}>
                  <button
                    className="location-select"
                    type="button"
                    disabled={!!(rescheduleDate && editingEvent)}
                    aria-expanded={!!(rescheduleDate && editingEvent) ? false : eventTypeMenuOpen}
                    onClick={() => { if (rescheduleDate && editingEvent) return; setEventTypeMenuOpen((v) => !v); }}
                    style={{ width: "100%", fontSize: 13, height: 39, ...((rescheduleDate && editingEvent) ? { backgroundColor: "#f8fafc", color: "#64748b" } : {}) }}
                  >
                    <span style={{ fontSize: 13 }}>{eventType}</span>
                    <ChevronDown size={15} />
                  </button>
                  {eventTypeMenuOpen && !(rescheduleDate && editingEvent) && (
                    <div className="location-options event-type-options" role="menu" aria-label="Event type" style={{ width: "100%" }}>
                      {configuredEventTypeNames.map((opt) => {
                        return (
                          <button type="button" role="menuitem" key={opt} onClick={() => { setEventType(opt); setEventTypeMenuOpen(false); setEventTypeError(false); }} style={{ fontSize: 13 }}>
                            <span style={{ fontSize: 13 }}>{opt}</span>
                            {eventType === opt && <Check size={14} />}
                          </button>
                        );
                      })}
                      <div className="event-type-custom-option">
                        <span className="event-type-custom-label">Customize your event types</span>
                        <button
                          type="button"
                          role="menuitem"
                          className="event-type-custom-action"
                          onClick={() => { window.open("/dashboard/settings/custom-fields?category=event-type", "_blank", "noopener,noreferrer"); setEventTypeMenuOpen(false); }}
                        >
                          <Plus size={13} /> Add custom type
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {eventTypeError && <p className="field-error"><FieldErrorIcon /> Event type is required</p>}

                 <label className="field-label field-space"><span>Date &amp; Time<span className="required-star">*</span></span></label>
                 <MultipleDatePicker
                   key={open ? `date-time-${slot.date}-${slot.hour}-${slot.minute}` : "date-time-closed"}
                   value={occurrences}
                   minDate={rescheduleDate && editingEvent ? "2020-01-01" : todayKey}
                   onChange={(next) => { setOccurrences(next); setMultipleDateAttemptError(null); }}
                   getMultipleDateError={(slotCount) => multipleDateError(slotCount, selectedAttendees)}
                   onMultipleDateError={setMultipleDateAttemptError}
                 />
                 {dateError && <p className="field-error"><FieldErrorIcon /> {isRescheduleSameDate ? "Please choose a different date to reschedule" : "Select a date"}</p>}
                 {visibleMultipleDateError && <p className="field-error"><FieldErrorIcon /> {visibleMultipleDateError}</p>}

                <section className="related-to-section">
                  <div className="field-label field-space location-heading"><span>Linked to</span></div>
                  <LinkedToSection
                    records={linkedRecords}
                    onAdd={(type, item) => setLinkedRecords((prev) => prev.some((r) => r.type === type) ? prev : [...prev, { type, item }])}
                    onRemove={(type) => setLinkedRecords((prev) => prev.filter((r) => r.type !== type))}
                    disabled={!!(rescheduleDate && editingEvent)}
                  />
                </section>

                <label className="field-label field-space attendee-field-label"><span>Attendees<span className="required-star">*</span></span></label>
                <AttendeePicker key={open ? `attendees-${slot.date}-${slot.hour}-${slot.minute}` : "attendees-closed"} selected={selectedAttendees} onRemove={removeAttendee} onSelect={selectAttendee} />
                {nativeMode && selectedAttendees.length > 0 && !(rescheduleDate && editingEvent) && (
                  <p className="helper" style={{ marginTop: 6 }}><Info size={14} /> Google will email each attendee its standard calendar invitation — no custom email in this mode.</p>
                )}

                <EventLocation
                  open={locationOpen}
                  required={hasInvitees}
                  onOpen={() => setLocationOpen(true)}
                  onRemove={() => setLocationOpen(false)}
                  showError={locationError}
                  onValidityChange={(valid) => { setLocationValid(valid); if (valid) setLocationError(false); }}
                  initialLocation={locationSnapshot ?? editingEvent?.storedLocation ?? null}
                  onLocationChange={setLocationSnapshot}
                />

                {(
                  <div className="reminder-block field-space" ref={reminderRef}>
                    <div className="reminder-title"><label className="field-label">Reminder</label><Toggle on={reminder} onClick={() => { setReminder((value) => !value); setReminderMenuOpen(false); }} label="Reminder" /></div>
                    {reminder && <><div className="reminder-controls"><input type="number" min="0" max={reminderLimits[reminderUnit].max} value={reminderValue} onChange={(event) => setReminderValue(event.target.value)} onBlur={() => { if (!reminderValue) setReminderValue(reminderDefaults[reminderUnit]); }} aria-label="Reminder value" /><div className="reminder-unit-wrap"><button className="select-like reminder-unit-select" type="button" aria-expanded={reminderMenuOpen} onClick={() => setReminderMenuOpen((value) => !value)}><span>{reminderUnit}</span><ChevronDown size={13} /></button>{reminderMenuOpen && <div className="reminder-unit-options" role="menu" aria-label="Reminder unit">{(["minutes", "hours", "days", "weeks"] as ReminderUnit[]).map((unit) => <button type="button" role="menuitem" onClick={() => { setReminderUnit(unit); setReminderValue(reminderDefaults[unit]); setReminderMenuOpen(false); }} key={unit}><span>{unit}</span>{reminderUnit === unit && <Check size={14} />}</button>)}</div>}</div></div><p className="helper"><Info size={14} /> {reminderLimits[reminderUnit].copy}</p></>}
                  </div>
                )}

                <label className="field-label field-space">Description</label>
                <div className="description-field"><textarea value={description} onChange={(event) => setDescription(event.target.value.slice(0, 2000))} placeholder="Description here" /></div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}><span style={{ color: description.length >= 2000 ? "#e5484d" : "#8da0b9", fontSize: 11 }}>{description.length}/2000</span></div>
              </section>
              <DrawerInfoPanel talent={selectedTalent} internalAttendees={selectedInternals} />
            </div>
            <div className="drawer-footer">
              <button className="text-button" onClick={onClose}>Cancel</button>
              <div>
                {rescheduleDate && editingEvent ? (
                  <button className="create-event-button" onClick={submit}>
                    {isEditMode ? "Update event" : "Reschedule"} <ArrowRight size={18} strokeWidth={1.9} />
                  </button>
                ) : nativeMode ? (
                  <button className="create-event-button" disabled={sending} onClick={submit}>{sending ? "Creating…" : <>Create event &amp; invite <ArrowRight size={18} strokeWidth={1.9} /></>}</button>
                ) : (
                  <>
                    <button className="save-draft-button" type="button" onClick={saveAsDraft}>Save as Draft</button>
                    <button className="save-logged-button" type="button" onClick={saveAsLogged}>Save as Logged</button>
                    <button className={`create-event-button ${shouldPreviewInvitation ? "" : "hug-content"}`} onClick={submit}>{shouldPreviewInvitation ? <>Preview invitation <ArrowRight size={18} strokeWidth={1.9} /></> : "Create event"}</button>
                  </>
                )}
              </div>
            </div>
          </>
        ) : rescheduleDate && editingEvent ? (
          /* Step 2 – Reschedule: add an optional update note and confirm */
          <>
            <div className="drawer-heading">
              <div className="drawer-heading-left">
                <button className="drawer-back-btn" onClick={() => setDrawerStep(1)} aria-label="Back"><ChevronLeft size={18} /></button>
                <h2>{isEditMode ? "Review & update event" : "Review & notify attendees"}</h2>
              </div>
              <button onClick={onClose} aria-label="Close"><X size={17} /></button>
            </div>
            <div className="drawer-body review-invite-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Schedule summary */}
              <div style={{ background: "#f0f9f6", border: "1px solid #c6e9de", borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "#0f5132" }}>New schedule</p>
                {(() => { const occ = getOccurrences()[0]; return occ ? <p style={{ margin: 0, fontSize: 13, color: "#1d5c3a" }}>{occ.date} · {occ.start} – {occ.end}</p> : null; })()}
                {selectedAttendees.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                    {selectedAttendees.map((a) => (
                      <span key={a.id} style={{ fontSize: 12, background: "#fff", border: "1px solid #b2dfcf", borderRadius: 20, padding: "2px 10px", color: "#1d5c3a" }}>{a.name}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Update note */}
              <div>
                <label className="field-label" style={{ marginBottom: 6 }}>Update note <span style={{ color: "#94a3b8", fontWeight: 400 }}>(optional)</span></label>
                <p className="helper" style={{ marginBottom: 8 }}><Info size={13} /> This note will be included in the update notification sent to all attendees.</p>
                <div className="description-field">
                  <textarea
                    value={rescheduleNote}
                    onChange={(e) => setRescheduleNote(e.target.value.slice(0, 500))}
                    placeholder="e.g. Rescheduled to accommodate everyone's availability…"
                    rows={4}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                  <span style={{ color: rescheduleNote.length >= 500 ? "#e5484d" : "#8da0b9", fontSize: 11 }}>{rescheduleNote.length}/500</span>
                </div>
              </div>

              {/* Google Calendar delivery notice */}
              <div style={{ background: "#f8f9fa", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 14px", fontSize: 12, color: "#475569", display: "flex", gap: 8, alignItems: "flex-start" }}>
                <Info size={14} style={{ marginTop: 1, flexShrink: 0, color: "#3b82f6" }} />
                <span>Google Calendar will email an updated invitation to all attendees via <strong>sendUpdates: &quot;all&quot;</strong>.</span>
              </div>
            </div>
            <div className="drawer-footer">
              <button className="text-button" onClick={() => setDrawerStep(1)}><ChevronLeft size={16} /> Back</button>
              <button className="send-invitation-button" type="button" disabled={sending} onClick={() => void handleReschedule()}>
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {sending ? "Updating…" : "Update & notify"}
              </button>
            </div>
          </>
        ) : (
          /* Step 2: Review Invitation */
          <>
            <div className="drawer-heading">
              <div className="drawer-heading-left">
                <button className="drawer-back-btn" onClick={() => setDrawerStep(1)} aria-label="Back to edit event"><ChevronLeft size={18} /></button>
                <h2>Review invitation</h2>
              </div>
              <button onClick={onClose} aria-label="Close"><X size={17} /></button>
            </div>
            <div className="drawer-body review-invite-body">
              <div className="invite-customize-header">
                <h3><Mail size={16} /> Compose {resendRsvpMode ? "Resend RSVP" : "Smart Event"} Invitation</h3>
                <div className="invite-notice-banner">
                  <Info size={16} />
                  <span>{resendRsvpMode
                    ? "This version is sent from the professional Resend calendar domain with one native RSVP invitation per slot."
                    : "Please review and customize the email below. Ensure all details are correct before sending"}</span>
                </div>
              </div>

              {availableInviteTabs.length >= 1 && (
                <div className="invite-tabs">
                  {availableInviteTabs.map((tab) => (
                    <button
                      key={tab.key}
                      className={activeInviteTab === tab.key ? "active" : ""}
                      onClick={() => setActiveInviteTab(tab.key)}
                      type="button"
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="invite-editor-layout">
                <div className="invite-email-card">
                  {/* To Line */}
                  <div className="invite-to-row">
                    <span className="invite-label">To:</span>
                    <div className="invite-to-pills">
                      {activeRecipients.map((rec) => (
                        <span key={rec.id} className="recipient-pill">
                          {rec.email || rec.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Subject Line */}
                  <div className="invite-subject-row">
                    <span className="invite-label">Subject:</span>
                    <input
                      type="text"
                      className="invite-subject-input"
                      value={emailSubjects[activeInviteTab]}
                      onChange={(e) => {
                        subjectTouchedRef.current = true;
                        setEmailSubjects((prev) => ({
                          ...prev,
                          [activeInviteTab]: e.target.value,
                        }));
                      }}
                    />
                  </div>

                  {/* AI toolbar — matches new design: Rewrite invitation + Save template + Templates + Placeholders */}
                  <div className="invite-toolbar" style={{ justifyContent: "flex-end", flexWrap: "wrap", gap: 8, padding: "6px 0 8px", borderBottom: "1px solid #f1f5f9" }}>
                    <button
                      type="button"
                      className={`ai-neon-btn ${aiBusy ? "busy" : ""}`}
                      onClick={() => void generateDrafts()}
                      disabled={aiBusy || !title.trim()}
                      title={!title.trim() ? "Add a title first" : "Rewrite the invitation while keeping the event details intact"}
                      style={{ borderColor: "#86efac", background: aiBusy ? "#f0fdf4" : "#fff", color: "#0f9d76", fontWeight: 600 }}
                    >
                      {aiBusy ? <Loader2 size={14} className="animate-spin" /> : <PenLine size={14} />}
                      {aiBusy ? "Writing…" : draftedOnce ? "Rewrite invitation" : "Write invitation"}
                    </button>
                    <button type="button" className="toolbar-btn" style={{ background: "#e6f7f5", borderColor: "#c7ece6", color: "#0f7a6e", fontWeight: 600 }} onClick={() => showToast("Template saved")}>
                      <Save size={14} /> Save template
                    </button>
                    <button type="button" className="toolbar-btn" onClick={() => setSidePanel((v) => v === "templates" ? null : "templates")}>
                      <ListTree size={14} /> Templates <ChevronRight size={14} />
                    </button>
                    <button type="button" className="toolbar-btn" onClick={() => setSidePanel((v) => v === "placeholders" ? null : "placeholders")}>
                      <span style={{ fontWeight: 700 }}>[Placeholders]</span> <ChevronRight size={14} />
                    </button>
                  </div>

                  {aiError && (
                    <p className="field-error" role="alert"><FieldErrorIcon /> {aiError}</p>
                  )}

                  {/* Email Body Editor (Gmail-compose style, atomic var chips) — signature is OUTSIDE, not editable */}
                  <div className="invite-body-wrapper" style={{ position: "relative", background: "#fff", display: "flex", flexDirection: "column" }}>
                    <RichBodyEditor
                      value={emailBodies[activeInviteTab]}
                      onChange={(html) =>
                        setEmailBodies((prev) => ({
                          ...prev,
                          [activeInviteTab]: html,
                        }))
                      }
                      variables={availableVariables.map((v) => ({ tag: v.tag, hint: v.hint }))}
                      disabled={aiBusy}
                      generatingBlockSelector='[data-smart-block="ai-context"]'
                      generating={aiBusy}
                    />
                  </div>
                  {/* Signature — separated from editable body, always visible, not cleared on rewrite */}
                  <div className="invite-signature-card" style={{ marginTop: 8 }}>
                    <span style={{ fontSize: 13, color: "#475569" }}>Best regards,</span>
                    <strong>Mustapha Boufous</strong>
                    <span style={{ fontSize: 13, color: "#475569" }}>+212636857897</span>
                    <span style={{ fontSize: 13, color: "#475569" }}>toozmust@gmail.com</span>
                    <strong style={{ marginTop: 6 }}>The Wiggli Team</strong>
                  </div>

                  {/* Variables available for THIS email (from the user's inputs) */}
                  <div className="invite-suggestions-bar">
                    <span className="suggestions-label">Insert a placeholder</span>
                    {availableVariables.map((chip) => (
                      <button
                        type="button"
                        key={chip.tag}
                        className="suggestion-chip"
                        title={chip.hint}
                        onClick={() => {
                          // Insert atomically at the caret inside the rich editor.
                          if (!insertIntoActiveEditor(chip.tag)) {
                            setEmailBodies((prev) => ({ ...prev, [activeInviteTab]: `${prev[activeInviteTab]} ${chip.tag}` }));
                          }
                        }}
                      >
                        {chip.tag}
                      </button>
                    ))}
                  </div>

                </div>
                {sidePanel && (
                  <div className="invite-side-panel">
                    <div className="side-panel-header">
                      <h3>{sidePanel === "templates" ? "Templates" : "Placeholders"}</h3>
                      <button type="button" onClick={() => setSidePanel(null)}>✕</button>
                    </div>
                    <div className="side-panel-content">
                      {sidePanel === "templates" ? (
                        <>
                          <div className="side-search-box">
                            <input placeholder="Search templates" value={templateSearchQuery} onChange={(e) => setTemplateSearchQuery(e.target.value)} />
                          </div>
                          <p className="side-panel-helper">Choose a saved template to replace the current invitation.</p>
                          <div className="template-item-list">
                            <button type="button" className="template-card-btn" onClick={() => showToast("No saved templates yet")}>No templates yet</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="side-panel-helper">Click a placeholder to insert it at the cursor.</p>
                          <div className="placeholder-chip-cloud">
                            {availableVariables.map((v) => (
                              <button key={v.tag} type="button" className="placeholder-insert-btn" onClick={() => insertIntoActiveEditor(v.tag)}>{v.tag}</button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="drawer-footer">
              <button className="text-button" onClick={onClose}>Cancel</button>
              <div>
                <button className="back-step-button" type="button" onClick={() => setDrawerStep(1)}>
                  <ChevronLeft size={16} /> Back
                </button>
                <button className="send-invitation-button" type="button" disabled={sending} onClick={handleSendInvitation}>
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />} {sending ? "Sending…" : "Send invitation"}
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
