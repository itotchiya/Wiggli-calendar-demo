"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bot, CalendarPlus, ChevronRight, CircleDot, CircleCheck, Loader2,
  Mic, PlayCircle, RefreshCw, Search, TriangleAlert, Video,
} from "lucide-react";
import { Header } from "@/components/chrome";
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

const STATUS_PILL: Record<string, string> = {
  CREATED: "bg-slate-100 text-slate-500",
  JOINING: "bg-blue-50 text-blue-600",
  RECORDING: "bg-red-50 text-red-600",
  TRANSCRIBED: "bg-violet-50 text-violet-600",
  PROCESSING: "bg-amber-50 text-amber-600",
  READY: "bg-teal-50 text-teal-700",
  FAILED: "bg-red-50 text-red-600",
};

function initials(name: string): string {
  return name.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

export default function NotetakerPage() {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [events, setEvents] = useState<EventDto[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testUrl, setTestUrl] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/notetaker/notes");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setNotes(data.notes ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load notes";
      setLoadError(msg);
      showToast(msg);
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
        body: JSON.stringify({ eventId, source: withBot ? "RECALL_BOT" : "MANUAL_PASTE" }),
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

  const testJoin = async () => {
    if (!testUrl.trim() || testBusy) return;
    setTestBusy(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/notetaker/test-join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ meetingUrl: testUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const botId = String(data.bot?.id ?? "unknown");
      setTestResult(`Bot sent — id ${botId}. Open the Meet now and admit “Wiggli Notetaker” from the lobby.`);
      showToast("Test bot sent — admit it in the Meet.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Test join failed";
      setTestResult(msg);
      showToast(msg);
    } finally {
      setTestBusy(false);
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

  const stats = useMemo(() => ({
    total: notes.length,
    ready: notes.filter((n) => n.status === "READY").length,
    recording: notes.filter((n) => n.status === "RECORDING" || n.status === "JOINING").length,
  }), [notes]);

  return (
    <div className="flex h-full flex-col">
      <Header kicker={<span className="inline-flex items-center gap-2"><Mic size={16} /> AI Notetaker</span>} />
      <div className="flex-1 overflow-y-auto bg-[#f4f6f9]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-6">
          {/* Hero */}
          <div className="relative overflow-hidden rounded-3xl bg-[#242e45] p-6 text-white md:p-8">
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(520px 220px at 85% -20%, rgba(61,255,162,0.22), transparent 60%), radial-gradient(420px 200px at 10% 120%, rgba(5,141,128,0.35), transparent 60%)" }}
            />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-xl">
                <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#3DFFA2]">
                  <Mic size={12} /> Wiggli Notetaker
                </p>
                <h1 className="mt-2 text-[24px] font-semibold tracking-tight md:text-[28px]">Never take meeting notes again</h1>
                <p className="mt-1 text-[13.5px] leading-relaxed text-[#c3cad4]">
                  The bot joins your Google Meet, records, transcribes and drafts candidate insights — all linked to your jobs and contacts.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-[#3DFFA2] px-4 text-[13.5px] font-bold text-[#0b2e23] transition hover:brightness-110"
                  >
                    <CalendarPlus size={16} /> New note
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTestOpen(true); setTestResult(null); }}
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-white/25 bg-white/5 px-4 text-[13.5px] font-semibold text-white transition hover:bg-white/15"
                  >
                    <Bot size={16} /> Test join
                  </button>
                </div>
              </div>
              <div className="flex gap-2.5">
                {[
                  { label: "Notes", value: stats.total, icon: <Video size={15} /> },
                  { label: "Ready", value: stats.ready, icon: <CircleCheck size={15} /> },
                  { label: "Recording", value: stats.recording, icon: <CircleDot size={15} /> },
                ].map((s) => (
                  <div key={s.label} className="min-w-[86px] rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 backdrop-blur">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#98a3b8]">{s.icon}{s.label}</p>
                    <p className="mt-0.5 text-[22px] font-semibold leading-none">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {loadError && (
            <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">
              <TriangleAlert size={16} /> Couldn’t load notes ({loadError}).
              <button type="button" className="ml-auto font-bold underline" onClick={() => void load()}>Retry</button>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1 sm:max-w-xs">
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="h-10 w-full rounded-full border border-slate-200 bg-white pl-9 pr-3 text-[13px] shadow-sm outline-none placeholder:text-slate-400 focus:border-teal-600"
                placeholder="Search meetings or candidates…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition ${
                    filter === f ? "bg-[#242e45] text-white shadow" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-slate-800"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-[13.5px] text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Loading notes…
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <span className="grid h-13 w-13 place-items-center rounded-2xl bg-teal-50 p-3 text-teal-700"><Mic size={24} /></span>
              <div>
                <p className="text-[15px] font-semibold text-slate-800">{notes.length === 0 ? "No notes yet" : "Nothing matches"}</p>
                <p className="mx-auto mt-1 max-w-sm text-[13px] text-slate-500">
                  {notes.length === 0
                    ? "Pick an event and send the bot — or paste a transcript to test the AI without a bot."
                    : "Try a different search or filter."}
                </p>
              </div>
              {notes.length === 0 && (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-[#242e45] px-4 text-[13.5px] font-semibold text-white transition hover:bg-teal-700"
                >
                  <CalendarPlus size={16} /> New note
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {visible.map((n) => {
                const name = candidateName(n);
                return (
                  <Link
                    key={n.id}
                    href={`/dashboard/notetaker/${n.id}`}
                    className="group flex items-center gap-3.5 rounded-2xl border border-slate-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:-translate-y-px hover:border-teal-600/30 hover:shadow-[0_8px_24px_-8px_rgba(5,141,128,0.25)]"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#242e45] text-[13px] font-bold text-white">
                      {name !== "—" ? initials(name) : <Video size={18} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[14.5px] font-semibold text-slate-800">{n.event.summary}</span>
                        {(n.status === "RECORDING" || n.status === "JOINING") && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-red-600">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> Live
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-slate-500">
                        {name} · {new Date(n.event.start).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {n._count.insights > 0 || n._count.actions > 0 ? ` · ${n._count.insights} insights · ${n._count.actions} actions` : ""}
                        {n.status === "READY" && n._count.insights === 0 ? " · tap to watch" : ""}
                      </span>
                    </span>
                    {n.status === "READY" && (
                      <span className="hidden shrink-0 items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[11.5px] font-bold text-teal-700 transition group-hover:flex">
                        <PlayCircle size={13} /> Watch
                      </span>
                    )}
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ${STATUS_PILL[n.status] ?? STATUS_PILL.CREATED}`}>
                      {n.status}
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-teal-600" />
                  </Link>
                );
              })}
            </div>
          )}

          {/* Test join modal */}
          {testOpen && (
            <div className="fixed inset-0 z-50 grid place-items-center bg-[#242e45]/50 p-4 backdrop-blur-[2px]" onClick={() => setTestOpen(false)}>
              <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <p className="flex items-center gap-2 text-[16px] font-semibold text-slate-800"><Bot size={18} className="text-teal-700" /> Test join</p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                  Paste a Google Meet link — the bot joins right now, no event needed. Join the same Meet yourself and admit “Wiggli Notetaker”.
                </p>
                <input
                  className="mt-4 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-[13.5px] outline-none placeholder:text-slate-400 focus:border-teal-600 focus:bg-white"
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void testJoin();
                  }}
                />
                {testResult && (
                  <p className="mt-3 rounded-xl bg-slate-100 p-3 text-[12.5px] leading-relaxed text-slate-700">{testResult}</p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" className="text-button" onClick={() => setTestOpen(false)}>Close</button>
                  <button type="button" className="primary-button" disabled={testBusy || !testUrl.trim()} onClick={() => void testJoin()}>
                    <Bot size={15} /> {testBusy ? "Sending…" : "Send bot now"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* New note modal */}
          {pickerOpen && (
            <div className="fixed inset-0 z-50 grid place-items-center bg-[#242e45]/50 p-4 backdrop-blur-[2px]" onClick={() => setPickerOpen(false)}>
              <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="border-b border-slate-100 px-6 py-4">
                  <p className="text-[16px] font-semibold text-slate-800">New note</p>
                  <p className="text-[12.5px] text-slate-500">Send the bot, or create empty and paste a transcript.</p>
                </div>
                <div className="max-h-[55vh] overflow-y-auto p-2.5">
                  {events.length === 0 && <p className="p-4 text-[13px] text-slate-500">No events found.</p>}
                  {events.map((e) => (
                    <div key={e.id} className="flex items-center gap-2 rounded-2xl px-3.5 py-3 transition hover:bg-teal-50/50">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-semibold text-slate-800">{e.summary}</p>
                        <p className="text-[12px] text-slate-500">{new Date(e.start).toLocaleString()}</p>
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
    </div>
  );
}
