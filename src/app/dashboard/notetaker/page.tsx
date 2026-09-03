"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mic, Plus, RefreshCw, Video } from "lucide-react";
import { Header } from "@/components/chrome";
import { StatusChip } from "@/components/notetaker-ui";
import { showToast } from "@/components/toaster";
import type { EventDto } from "@/types/event";

type NoteRow = {
  id: string;
  status: string;
  statusMessage: string | null;
  source: string;
  templateUsed: string | null;
  updatedAt: string;
  recallRecordingId: string | null;
  event: EventDto & { attendees: { email: string; name: string | null; type: string | null }[] };
  _count: { insights: number; actions: number };
};

function candidateName(row: NoteRow): string {
  const c = row.event.attendees.find((a) => a.type === "candidate");
  return c ? (c.name ?? c.email) : "—";
}

export default function NotetakerPage() {
  const [notes, setNotes] = useState<NoteRow[] | null>(null);
  const [events, setEvents] = useState<EventDto[]>([]);
  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/notetaker/notes");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { notes: NoteRow[] };
      setNotes(data.notes);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load notes");
      setNotes([]);
    }
  };

  const loadEvents = async () => {
    try {
      const res = await fetch("/api/events");
      if (res.ok) setEvents((await res.json()) as EventDto[]);
    } catch {
      /* table still works without the picker */
    }
  };

  useEffect(() => {
    void load();
    void loadEvents();
  }, []);

  const create = async (eventId: string, source: "RECALL_BOT" | "MANUAL_PASTE") => {
    setCreating(true);
    try {
      const res = await fetch("/api/notetaker/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, source }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      showToast(source === "RECALL_BOT" ? "Notetaker bot on its way — admit it in Meet." : "Note created — paste the transcript.");
      setPicking(false);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create note");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <Header
        kicker={
          <span className="inline-flex items-center gap-2">
            <Mic size={16} /> AI Notetaker
          </span>
        }
      />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-6">
        <div className="sync-banner" style={{ margin: 0 }}>
          <div>
            <Mic size={15} />
            <span>Test mode — mock/test meetings only. The bot joins Google Meet, records, transcribes and drafts notes.</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => void load()}>
              <span className="inline-flex items-center gap-1"><RefreshCw size={12} /> Refresh</span>
            </button>
            <button type="button" onClick={() => setPicking((v) => !v)}>
              <span className="inline-flex items-center gap-1"><Plus size={12} /> New note</span>
            </button>
          </div>
        </div>

        {picking && (
          <section className="rounded-xl border border-[#e9edf2] bg-white p-4">
            <h2 className="text-[16px] font-semibold text-[#273246]">Attach notetaker to an event</h2>
            <p className="mt-0.5 text-[13px] text-[#718096]">Pick a calendar event. The bot needs a Google Meet link on the event.</p>
            <div className="mt-3 flex flex-col gap-2">
              {events.length === 0 && <p className="text-[13px] text-[#718096]">No events found.</p>}
              {events.slice(0, 20).map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#e9edf2] px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold text-[#273246]">{e.summary}</p>
                    <p className="text-[12px] text-[#718096]">
                      {e.eventType ?? "Meeting"} · {new Date(e.start).toLocaleString()}
                      {e.hangoutLink ? " · Meet link" : " · no Meet link"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" className="text-button" disabled={creating} onClick={() => void create(e.id, "MANUAL_PASTE")}>
                      Paste transcript
                    </button>
                    <button type="button" className="primary-button" disabled={creating || !e.hangoutLink} onClick={() => void create(e.id, "RECALL_BOT")}>
                      <Video size={14} /> Send bot
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-xl border border-[#e9edf2] bg-white">
          {notes === null ? (
            <p className="p-6 text-[13.5px] text-[#718096]">Loading…</p>
          ) : notes.length === 0 ? (
            <p className="p-6 text-[13.5px] text-[#718096]">
              No notes yet. Click “New note”, pick an event and send the bot — or paste a transcript to test the AI without a bot.
            </p>
          ) : (
            <div className="divide-y divide-[#edf0f4]">
              <div className="grid grid-cols-[1fr_170px_130px_110px] gap-3 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-[#a3a6aa]">
                <span>Meeting</span><span>Candidate</span><span>Output</span><span className="text-right">Status</span>
              </div>
              {notes.map((n) => (
                <Link
                  key={n.id}
                  href={`/dashboard/notetaker/${n.id}`}
                  className="grid grid-cols-[1fr_170px_130px_110px] items-center gap-3 px-4 py-3 transition hover:bg-[#f8fafc]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold text-[#273246]">
                      {n.recallRecordingId ? <Video size={13} className="mr-1 inline text-[#058d80]" /> : null}
                      {n.event.summary}
                    </p>
                    <p className="truncate text-[12px] text-[#718096]">
                      {n.event.eventType ?? "Meeting"} · {new Date(n.event.start).toLocaleString()}
                      {n.templateUsed ? ` · ${n.templateUsed}` : ""}
                    </p>
                    {n.statusMessage && <p className="truncate text-[12px] text-[#e5a92f]">{n.statusMessage}</p>}
                  </div>
                  <span className="truncate text-[13px] text-[#273246]">{candidateName(n)}</span>
                  <span className="text-[12.5px] text-[#718096]">
                    {n._count.insights > 0 ? `${n._count.insights} insights · ${n._count.actions} actions` : "—"}
                  </span>
                  <span className="text-right"><StatusChip status={n.status} /></span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
