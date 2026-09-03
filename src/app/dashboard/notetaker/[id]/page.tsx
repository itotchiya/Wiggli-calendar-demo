"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowUp, Bot, Check, CirclePlay, FileText, ListChecks,
  MonitorPlay, Quote, Search, Sparkles, X,
} from "lucide-react";
import { Header } from "@/components/chrome";
import { StatusChip, timestampToSeconds } from "@/components/notetaker-ui";
import { showToast } from "@/components/toaster";

type Insight = {
  id: string; field: string; value: string; confidence: number | null;
  speaker: string | null; timestamp: string | null; evidence: string | null; reviewStatus: string;
};
type NoteAction = {
  id: string; title: string; owner: string | null; dueDate: string | null;
  timestamp: string | null; evidence: string | null; reviewStatus: string;
};
type TLine = { speaker: string; time: string; text: string };
type ChatMsg = { role: "user" | "assistant"; content: string };
type Note = {
  id: string; status: string; statusMessage: string | null; source: string;
  recallBotId: string | null; recallRecordingId: string | null;
  transcriptText: string | null; transcriptJson: TLine[] | null;
  summary: Record<string, unknown> | null; templateUsed: string | null;
  event: { summary: string; eventType: string | null; start: string; attendees: { email: string; name: string | null; type: string | null }[] };
  insights: Insight[]; actions: NoteAction[];
};

const TABS = ["Watch", "Transcript", "Summary", "Insights", "Actions", "Ask AI"] as const;
type Tab = (typeof TABS)[number];

const SUGGESTIONS = [
  "Summarize this meeting in 3 bullets",
  "What salary did the candidate ask for?",
  "What are the agreed next steps?",
  "Any red flags or concerns?",
];

function initials(name: string): string {
  return name.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

function Section({ icon, title, action, children }: { icon: React.ReactNode; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)] md:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[14.5px] font-semibold text-slate-800">{icon}{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function SummaryView({ summary }: { summary: Record<string, unknown> }) {
  return (
    <div className="flex flex-col gap-4">
      {Object.entries(summary).map(([key, value]) => (
        <div key={key}>
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#a3a6aa]">{key.replace(/_/g, " ")}</p>
          {typeof value === "string" ? (
            <p className="mt-1 text-[13.5px] leading-relaxed text-[#273246]">{value || "—"}</p>
          ) : Array.isArray(value) ? (
            value.length === 0 ? (
              <p className="mt-1 text-[13.5px] text-[#a3a6aa]">—</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-1.5">
                {value.map((v, i) => (
                  <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-[#273246]">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#058d80]" />
                    {typeof v === "string" ? v : JSON.stringify(v)}
                  </li>
                ))}
              </ul>
            )
          ) : (
            <p className="mt-1 text-[13.5px] text-[#273246]">{JSON.stringify(value)}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function transcriptLines(note: Note, search: string): TLine[] {
  const base: TLine[] = Array.isArray(note.transcriptJson) && note.transcriptJson.length > 0
    ? note.transcriptJson
    : (note.transcriptText ?? "").split("\n").filter(Boolean).map((raw) => {
        const m = raw.match(/^\[([^\]]+)\]\s*([^:]+):\s*(.*)$/);
        return m ? { time: m[1], speaker: m[2].trim(), text: m[3] } : { time: "", speaker: "", text: raw };
      });
  return search ? base.filter((l) => `${l.speaker} ${l.text}`.toLowerCase().includes(search.toLowerCase())) : base;
}

function ChatPanel({ messages, thinking, onSend, disabledHint }: {
  messages: ChatMsg[]; thinking: boolean; onSend: (text: string) => void; disabledHint: string | null;
}) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  const send = () => {
    const text = draft.trim();
    if (!text || thinking || disabledHint) return;
    setDraft("");
    onSend(text);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#273246] text-white"><Sparkles size={20} /></span>
            <div>
              <p className="text-[14px] font-semibold text-[#273246]">Ask about this meeting</p>
              <p className="mt-0.5 text-[12.5px] text-[#718096]">Answers come only from the transcript — with evidence.</p>
            </div>
            <div className="flex max-w-sm flex-wrap justify-center gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!!disabledHint}
                  onClick={() => onSend(s)}
                  className="rounded-full border border-[#e1e6ec] bg-white px-3 py-1.5 text-[12px] font-medium text-[#273246] transition hover:border-[#058d80] hover:text-[#058d80] disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#273246] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white">{m.content}</div>
            </div>
          ) : (
            <div key={i} className="flex gap-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e9f6f6] text-[#058d80]"><Bot size={15} /></span>
              <div className="min-w-0 flex-1 whitespace-pre-wrap rounded-2xl rounded-tl-md bg-[#f4f7f9] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-[#273246]">{m.content}</div>
            </div>
          )
        )}
        {thinking && (
          <div className="flex gap-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e9f6f6] text-[#058d80]"><Bot size={15} /></span>
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-[#f4f7f9] px-4 py-3">
              {[0, 1, 2].map((d) => (
                <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#98a3b8]" style={{ animationDelay: `${d * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="pt-3">
        {disabledHint ? (
          <p className="rounded-xl bg-[#fff7e6] px-3 py-2.5 text-center text-[12.5px] font-medium text-[#b97f0f]">{disabledHint}</p>
        ) : (
          <div className="flex items-center gap-2 rounded-full border border-[#e1e6ec] bg-white py-1.5 pl-4 pr-1.5 shadow-sm transition focus-within:border-[#058d80]">
            <input
              className="h-8 w-full bg-transparent text-[13.5px] outline-none placeholder:text-[#a3a6aa]"
              placeholder="Ask anything about this meeting…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button
              type="button"
              onClick={send}
              disabled={!draft.trim() || thinking}
              aria-label="Send"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#058d80] text-white transition hover:bg-[#047a6e] disabled:opacity-30"
            >
              <ArrowUp size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [note, setNote] = useState<Note | null>(null);
  const [tab, setTab] = useState<Tab>("Watch");
  const [watchSide, setWatchSide] = useState<"transcript" | "insights" | "ask">("transcript");
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [watchSearch, setWatchSearch] = useState("");
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [thinking, setThinking] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`/api/notetaker/notes/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { note: Note };
      setNote(data.note);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load note");
    }
  };

  const loadVideo = async () => {
    setVideoUrl(null);
    setVideoError(null);
    try {
      const res = await fetch(`/api/notetaker/notes/${id}/video`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setVideoUrl(data.url as string);
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : "Video unavailable");
    }
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (tab === "Watch" && note?.recallRecordingId && !videoUrl && !videoError) void loadVideo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, note?.recallRecordingId]);

  const seek = (time: string) => {
    const seconds = timestampToSeconds(time);
    const video = videoRef.current;
    if (seconds === null || !video) return;
    try {
      video.currentTime = seconds;
      void video.play();
    } catch {
      /* seek best-effort */
    }
  };

  const submitTranscript = async () => {
    if (!paste.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/notetaker/notes/${id}/transcript`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcriptText: paste }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setNote(data.note);
      setPaste("");
      showToast("Transcript analyzed.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const reanalyze = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/notetaker/notes/${id}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setNote(data.note);
      showToast("Re-analyzed.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const review = async (kind: "insights" | "actions", itemId: string, decision: string) => {
    const res = await fetch(`/api/notetaker/${kind}/${itemId}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (res.ok) void load();
    else showToast("Review failed");
  };

  const sendChat = async (text: string) => {
    const next = [...chat, { role: "user" as const, content: text }];
    setChat(next);
    setThinking(true);
    try {
      const res = await fetch(`/api/notetaker/notes/${id}/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text, history: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setChat([...next, { role: "assistant", content: data.answer as string }]);
    } catch (err) {
      setChat([...next, { role: "assistant", content: `Sorry — ${err instanceof Error ? err.message : "that didn't work"}. Try again.` }]);
    } finally {
      setThinking(false);
    }
  };

  const transcriptView = (lines: TLine[], clickable: boolean) => {
    if (!note?.transcriptText) {
      return (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <FileText size={22} className="text-[#c3cad4]" />
          <p className="text-[13px] text-[#718096]">No transcript yet — it appears here once the bot records.</p>
        </div>
      );
    }
    if (lines.length === 0) return <p className="py-6 text-center text-[13px] text-[#718096]">No matches.</p>;
    return (
      <div className="flex flex-col">
        {lines.map((l, idx) => (
          <div
            key={idx}
            onClick={clickable && l.time ? () => seek(l.time) : undefined}
            className={`flex gap-3 rounded-xl px-2.5 py-2 ${clickable && l.time ? "cursor-pointer transition hover:bg-[#f2faf9]" : ""}`}
          >
            {l.speaker ? (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eef2f6] text-[11px] font-bold text-[#5f6c81]">
                {initials(l.speaker)}
              </span>
            ) : (
              <span className="w-8 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2">
                {l.speaker && <span className="text-[12.5px] font-semibold text-[#273246]">{l.speaker}</span>}
                {l.time && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      seek(l.time);
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-[#e9f6f6] px-2 py-0.5 text-[11px] font-bold text-[#058d80] transition hover:bg-[#058d80] hover:text-white"
                  >
                    <CirclePlay size={11} /> {l.time}
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-[#3d4a61]">{l.text}</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const insightCards = () => (
    <div className="flex flex-col gap-2.5">
      {(!note || note.insights.length === 0) && (
        <p className="py-6 text-center text-[13px] text-[#718096]">No insights yet — they appear after analysis.</p>
      )}
      {(note?.insights ?? []).map((ins) => (
        <div key={ins.id} className={`rounded-xl border border-[#e9edf2] bg-[#fbfcfd] p-3.5 ${ins.reviewStatus !== "PENDING" ? "opacity-60" : ""}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#a3a6aa]">{ins.field.replace(/_/g, " ")}</p>
            {typeof ins.confidence === "number" && (
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#e9edf2]">
                  <div className="h-full rounded-full bg-[#058d80]" style={{ width: `${Math.round(ins.confidence * 100)}%` }} />
                </div>
                <span className="text-[11px] font-bold text-[#058d80]">{Math.round(ins.confidence * 100)}%</span>
              </div>
            )}
          </div>
          <p className="mt-1 text-[14.5px] font-semibold text-[#273246]">{ins.value}</p>
          {ins.speaker && <p className="mt-0.5 text-[12px] text-[#718096]">Said by {ins.speaker}</p>}
          {ins.evidence && (
            <p className="mt-2 flex gap-1.5 rounded-lg bg-white p-2.5 text-[12.5px] italic leading-relaxed text-[#5f6c81]">
              <Quote size={13} className="mt-0.5 shrink-0 text-[#c3cad4]" />{ins.evidence}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {ins.timestamp && (
              <button type="button" onClick={() => seek(ins.timestamp!)} className="inline-flex items-center gap-1 rounded-full bg-[#e9f6f6] px-2.5 py-1 text-[11.5px] font-bold text-[#058d80] transition hover:bg-[#058d80] hover:text-white">
                <CirclePlay size={12} /> {ins.timestamp}
              </button>
            )}
            <span className="flex-1" />
            {ins.reviewStatus === "PENDING" ? (
              <>
                <button type="button" onClick={() => void review("insights", ins.id, "ACCEPTED")} className="inline-flex items-center gap-1 rounded-full bg-[#273246] px-3 py-1 text-[11.5px] font-semibold text-white transition hover:bg-[#058d80]">
                  <Check size={12} /> Accept
                </button>
                <button type="button" onClick={() => void review("insights", ins.id, "IGNORED")} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-medium text-[#718096] transition hover:bg-[#f1f5f9]">
                  <X size={12} /> Ignore
                </button>
              </>
            ) : (
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#a3a6aa]">{ins.reviewStatus}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const actionCards = () => (
    <div className="flex flex-col gap-2.5">
      {(!note || note.actions.length === 0) && (
        <p className="py-6 text-center text-[13px] text-[#718096]">No suggested actions yet.</p>
      )}
      {(note?.actions ?? []).map((a) => (
        <div key={a.id} className={`rounded-xl border border-[#e9edf2] bg-[#fbfcfd] p-3.5 ${a.reviewStatus !== "PENDING" ? "opacity-60" : ""}`}>
          <p className="text-[14px] font-semibold leading-snug text-[#273246]">{a.title}</p>
          {(a.owner || a.dueDate || a.timestamp) && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {a.owner && <span className="rounded-full bg-[#eef2f6] px-2 py-0.5 text-[11px] font-semibold text-[#5f6c81]">{a.owner}</span>}
              {a.dueDate && <span className="rounded-full bg-[#fff7e6] px-2 py-0.5 text-[11px] font-semibold text-[#b97f0f]">{a.dueDate}</span>}
              {a.timestamp && (
                <button type="button" onClick={() => seek(a.timestamp!)} className="inline-flex items-center gap-1 rounded-full bg-[#e9f6f6] px-2 py-0.5 text-[11px] font-bold text-[#058d80] transition hover:bg-[#058d80] hover:text-white">
                  <CirclePlay size={11} /> {a.timestamp}
                </button>
              )}
            </div>
          )}
          {a.evidence && (
            <p className="mt-2 flex gap-1.5 rounded-lg bg-white p-2.5 text-[12.5px] italic leading-relaxed text-[#5f6c81]">
              <Quote size={13} className="mt-0.5 shrink-0 text-[#c3cad4]" />{a.evidence}
            </p>
          )}
          <div className="mt-2.5 flex items-center gap-2">
            <span className="flex-1" />
            {a.reviewStatus === "PENDING" ? (
              <>
                <button type="button" onClick={() => void review("actions", a.id, "CREATED_TASK")} className="inline-flex items-center gap-1 rounded-full bg-[#273246] px-3 py-1 text-[11.5px] font-semibold text-white transition hover:bg-[#058d80]">
                  <Check size={12} /> Create task
                </button>
                <button type="button" onClick={() => void review("actions", a.id, "IGNORED")} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-medium text-[#718096] transition hover:bg-[#f1f5f9]">
                  <X size={12} /> Ignore
                </button>
              </>
            ) : (
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#a3a6aa]">{a.reviewStatus}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  if (!note) {
    return (
      <div className="flex h-full flex-col">
        <Header kicker="AI Notetaker" />
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-2 text-[13.5px] text-[#718096]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#e1e6ec] border-t-[#058d80]" /> Loading note…
          </div>
        </div>
      </div>
    );
  }

  const lines = transcriptLines(note, search);
  const watchLines = transcriptLines(note, watchSearch);
  const noTranscriptHint = !note.transcriptText ? "Add a transcript first — paste one in the Watch tab." : null;

  return (
    <div className="flex h-full flex-col">
      <Header kicker="AI Notetaker" />
      <div className="flex-1 overflow-y-auto bg-[#f4f6f9]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-6">
        <Link href="/dashboard/notetaker" className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-[#718096] transition hover:text-[#273246]">
          <ArrowLeft size={14} /> All notes
        </Link>

        <div className="relative overflow-hidden rounded-3xl bg-[#242e45] p-5 text-white md:p-6">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(480px 200px at 90% -20%, rgba(61,255,162,0.18), transparent 60%), radial-gradient(400px 180px at 5% 120%, rgba(5,141,128,0.35), transparent 60%)" }}
          />
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[20px] font-semibold tracking-tight md:text-[22px]">{note.event.summary}</h1>
                <StatusChip status={note.status} />
              </div>
              <p className="mt-1 text-[13px] text-[#c3cad4]">
                {note.event.eventType ?? "Meeting"} · {new Date(note.event.start).toLocaleString()}
                {note.templateUsed ? ` · ${note.templateUsed} template` : ""}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {note.event.attendees.map((a) => (
                  <span key={a.email} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-2.5 text-[12px] font-medium text-[#e2e8f0]">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-[#3DFFA2] text-[9px] font-bold text-[#0b2e23]">{initials(a.name ?? a.email)}</span>
                    {a.name ?? a.email}
                    {a.type && <span className="text-[#98a3b8]">· {a.type}</span>}
                  </span>
                ))}
              </div>
            </div>
            {note.transcriptText && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void reanalyze()}
                className="inline-flex h-9 shrink-0 items-center rounded-full border border-white/25 bg-white/5 px-3.5 text-[12.5px] font-semibold text-white transition hover:bg-white/15 disabled:opacity-50"
              >
                Re-analyze
              </button>
            )}
          </div>
        </div>

        <div className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-full border border-slate-200/70 bg-white p-1 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                tab === t ? "bg-[#273246] text-white shadow-sm" : "text-[#718096] hover:text-[#273246]"
              }`}
            >
              {t}
              {t === "Insights" && note.insights.length > 0 ? ` · ${note.insights.length}` : ""}
              {t === "Actions" && note.actions.length > 0 ? ` · ${note.actions.length}` : ""}
            </button>
          ))}
        </div>

        {note.statusMessage && (
          <div className="sync-banner" style={{ margin: 0 }}>
            <div><Sparkles size={15} /><span>{note.statusMessage}</span></div>
          </div>
        )}

        {tab === "Watch" && (
          <div className="grid items-start gap-4 lg:grid-cols-[1fr_370px]">
            <div className="flex min-w-0 flex-col gap-4">
              <div className="overflow-hidden rounded-3xl bg-[#242e45] shadow-[0_16px_40px_-16px_rgba(36,46,69,0.5)]">
                {videoUrl ? (
                  <video ref={videoRef} controls className="aspect-video w-full" src={videoUrl} />
                ) : (
                  <div className="flex aspect-video w-full flex-col items-center justify-center gap-2.5 p-6 text-center">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-[#d6dbe5]"><MonitorPlay size={24} /></span>
                    <p className="max-w-sm text-[13.5px] leading-relaxed text-[#d6dbe5]">
                      {videoError ?? (note.recallRecordingId ? "Loading recording…" : "No recording yet — the video appears here after the bot records the Meet.")}
                    </p>
                    {note.recallRecordingId && (
                      <button type="button" className="text-button" onClick={() => void loadVideo()}>Retry</button>
                    )}
                  </div>
                )}
              </div>
              <Section icon={<FileText size={15} className="text-[#058d80]" />} title="Summary">
                {!note.summary
                  ? <p className="text-[13px] text-[#718096]">No summary yet — paste a transcript below to generate one.</p>
                  : <SummaryView summary={note.summary} />}
                {!note.transcriptText && (
                  <div className="mt-3">
                    <textarea
                      className="min-h-24 w-full rounded-xl border border-[#e1e6ec] bg-white p-3 text-[13px] outline-none placeholder:text-[#a3a6aa] focus:border-[#058d80]"
                      placeholder="[00:00:05] Recruiter: …"
                      value={paste}
                      onChange={(e) => setPaste(e.target.value)}
                    />
                    <button type="button" className="primary-button mt-2" disabled={busy || !paste.trim()} onClick={() => void submitTranscript()}>
                      Save & analyze
                    </button>
                  </div>
                )}
              </Section>
              <Section icon={<ListChecks size={15} className="text-[#058d80]" />} title="Suggested actions">
                {actionCards()}
              </Section>
            </div>
            <aside className="flex max-h-[calc(100vh-220px)] min-h-[480px] flex-col rounded-3xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)] lg:sticky lg:top-0">
              <div className="flex gap-1 border-b border-[#eef1f5] px-3 pt-2.5">
                {(["transcript", "insights", "ask"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setWatchSide(s)}
                    className={`rounded-t-lg px-3 py-2 text-[13px] font-semibold capitalize transition ${
                      watchSide === s ? "bg-[#e9f6f6] text-[#058d80]" : "text-[#718096] hover:text-[#273246]"
                    }`}
                  >
                    {s === "ask" ? "Ask AI" : s}
                  </button>
                ))}
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
                {watchSide === "transcript" && (
                  <div className="relative mb-2">
                    <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a3a6aa]" />
                    <input
                      className="h-9 w-full rounded-full border border-[#e1e6ec] bg-white pl-8 pr-3 text-[13px] outline-none placeholder:text-[#a3a6aa] focus:border-[#058d80]"
                      placeholder="Search — click a line to seek…"
                      value={watchSearch}
                      onChange={(e) => setWatchSearch(e.target.value)}
                    />
                  </div>
                )}
                {watchSide === "transcript" && transcriptView(watchLines, true)}
                {watchSide === "insights" && insightCards()}
                {watchSide === "ask" && (
                  <ChatPanel messages={chat} thinking={thinking} onSend={(t) => void sendChat(t)} disabledHint={noTranscriptHint} />
                )}
              </div>
            </aside>
          </div>
        )}

        {tab === "Transcript" && (
          <Section
            icon={<FileText size={15} className="text-[#058d80]" />}
            title={`Transcript${lines.length > 0 ? ` · ${lines.length} lines` : ""}`}
            action={
              <div className="relative w-56">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a3a6aa]" />
                <input
                  className="h-8.5 w-full rounded-full border border-[#e1e6ec] bg-white py-1.5 pl-8 pr-3 text-[12.5px] outline-none placeholder:text-[#a3a6aa] focus:border-[#058d80]"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            }
          >
            <div className="max-h-[60vh] overflow-y-auto">{transcriptView(lines, false)}</div>
          </Section>
        )}

        {tab === "Summary" && (
          <Section icon={<FileText size={15} className="text-[#058d80]" />} title="AI summary">
            {!note.summary
              ? <p className="text-[13px] text-[#718096]">No summary yet — add a transcript first.</p>
              : <SummaryView summary={note.summary} />}
          </Section>
        )}

        {tab === "Insights" && (
          <Section icon={<Sparkles size={15} className="text-[#058d80]" />} title={`Candidate insights${note.insights.length > 0 ? ` · ${note.insights.length}` : ""}`}>
            {insightCards()}
          </Section>
        )}

        {tab === "Actions" && (
          <Section icon={<ListChecks size={15} className="text-[#058d80]" />} title={`Suggested actions${note.actions.length > 0 ? ` · ${note.actions.length}` : ""}`}>
            {actionCards()}
          </Section>
        )}

        {tab === "Ask AI" && (
          <Section icon={<Sparkles size={15} className="text-[#058d80]" />} title="Ask about this meeting">
            <div className="flex h-[55vh] min-h-[380px] flex-col">
              <ChatPanel messages={chat} thinking={thinking} onSend={(t) => void sendChat(t)} disabledHint={noTranscriptHint} />
            </div>
          </Section>
        )}
      </div>
      </div>
    </div>
  );
}
