"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Mic, PlayCircle, RefreshCw, Search, Video } from "lucide-react";
import { Header } from "@/components/chrome";
import { StatusChip } from "@/components/notetaker-ui";
import { showToast } from "@/components/toaster";
import type { EventDto } from "@/types/event";

type NoteRow = {
  id: string; status: string; statusMessage: string | null; createdAt: string;
  event: EventDto & { attendees: { email: string; name: string | null; type: string | null }[] };
  _count: { insights: number; actions: number };
};

const FILTERS = ["All", "Ready", "Recording", "Processing", "Failed"] as const;

function candidateName(row: NoteRow): string {
  const c = row.event.attendees.find((a) => a.type === "candidate");
  return c?.name ?? c?.email ?? "—";
}

function statusGroup(status: string): string {
  if (status === "READY") return "Ready";
  if (status === "RECORDING" || status === "JOINING") return "Recording";
  if (status === "FAILED") return "Failed";
  return "Processing";
}

export default function NotetakerPage() {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [events, setEvents] = useState<EventDto[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch("/api/notetaker/notes");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setNotes(data.notes ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load notes");
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      setEvents(data.events ?? []);
    } catch {
      /* picker stays empty */
    }
  };

  useEffect(() => {
    void load();
    void loadEvents();
  }, []);

  const createNote = async (eventId: string, withBot: boolean) => {
    try {
      const res = await fetch("/api/notetaker/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, source: withBot ? "RECALL_BOT" : "MANUAL" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setPickerOpen(false);
      showToast(withBot ? "Bot scheduled — admit “Wiggli Notetaker” in the Meet." : "Note created — paste the transcript to analyze.");
      void load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed");
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (filter !== "All" && statusGroup(n.status) !== filter) return false;
      if (!q) return true;
      return `${n.event.summary} ${candidateName(n)}`.toLowerCase().includes(q);
    });
  }, [notes, query, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: notes.length };
    for (const f of FILTERS.slice(1)) c[f] = notes.filter((n) => statusGroup(n.status) === f).length;
    return c;
  }, [notes]);

  return (
    <div className="flex h-full flex-col">
      <Header kicker={<span className="inline-flex items-center gap-2"><Mic size={16} /> AI Notetaker</span>} />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[21px] font-semibold tracking-tight text-[#273246]">Meeting notes</h1>
            <p className="text-[13.5px] text-[#718096]">
              The bot joins Google Meet, records, transcribes and drafts notes — {notes.length} note{notes.length === 1 ? "" : "s"} so far.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="icon-button" title="Refresh" onClick={() => void load()}>
              <RefreshCw size={16} />
            </button>
            <button type="button" className="primary-button" onClick={() => setPickerOpen(true)}>
              <CalendarPlus size={15} /> New note
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1 sm:max-w-xs">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a3a6aa]" />
            <input
              className="h-9 w-full rounded-full border border-[#e1e6ec] bg-white pl-8 pr-3 text-[13px] outline-none placeholder:text-[#a3a6aa] focus:border-[#058d80]"
              placeholder="Search meetings or candidates…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1 rounded-full border border-[#e9edf2] bg-white p-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-[12.5px] font-semibold transition ${
                  filter === f ? "bg-[#273246] text-white" : "text-[#718096] hover:text-[#273246]"
                }`}
              >
                {f}{counts[f] ? ` · ${counts[f]}` : ""}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="py-10 text-center text-[13.5px] text-[#718096]">Loading notes…</p>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#e1e6ec] bg-white px-6 py-14 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e9f6f6] text-[#058d80]"><Mic size={22} /></span>
            <div>
              <p className="text-[15px] font-semibold text-[#273246]">{notes.length === 0 ? "No notes yet" : "Nothing matches"}</p>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-[#718096]">
                {notes.length === 0
                  ? "Pick an event and send the bot — or paste a transcript to test the AI without a bot."
                  : "Try a different search or filter."}
              </p>
            </div>
            {notes.length === 0 && (
              <button type="button" className="primary-button" onClick={() => setPickerOpen(true)}>
                <CalendarPlus size={15} /> New note
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#e9edf2] bg-white">
            {visible.map((n, idx) => (
              <Link
                key={n.id}
                href={`/dashboard/notetaker/${n.id}`}
                className={`group flex items-center gap-3 px-4 py-3.5 transition hover:bg-[#f6fbfb] ${idx > 0 ? "border-t border-[#eef1f5]" : ""}`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eef4f4] text-[#058d80] transition group-hover:bg-[#e9f6f6]">
                  {n.status === "READY" ? <PlayCircle size={19} /> : <Video size={18} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-[#273246]">{n.event.summary}</span>
                  <span className="mt-0.5 block truncate text-[12.5px] text-[#718096]">
                    {candidateName(n)} · {new Date(n.event.start).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {n._count.insights > 0 || n._count.actions > 0 ? ` · ${n._count.insights} insights · ${n._count.actions} actions` : ""}
                  </span>
                </span>
                <StatusChip status={n.status} />
              </Link>
            ))}
          </div>
        )}

        {pickerOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setPickerOpen(false)}>
            <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-[#eef1f5] px-5 py-4">
                <div>
                  <p className="text-[15px] font-semibold text-[#273246]">New note</p>
                  <p className="text-[12.5px] text-[#718096]">Send the bot, or create empty and paste a transcript.</p>
                </div>
                <button type="button" className="icon-button" onClick={() => setPickerOpen(false)}>✕</button>
              </div>
              <div className="max-h-[55vh] overflow-y-auto p-2">
                {events.length === 0 && <p className="p-4 text-[13px] text-[#718096]">No events found.</p>}
                {events.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 rounded-xl px-3 py-2.5 transition hover:bg-[#f6fbfb]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-[#273246]">{e.summary}</p>
                      <p className="text-[12px] text-[#718096]">{new Date(e.start).toLocaleString()}</p>
                    </div>
                    <button type="button" className="text-button" onClick={() => void createNote(e.id, false)}>Paste transcript</button>
                    <button type="button" className="primary-button" onClick={() => void createNote(e.id, true)}>Send bot</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
