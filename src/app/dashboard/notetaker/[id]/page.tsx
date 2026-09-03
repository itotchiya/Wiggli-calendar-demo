"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Mic, MonitorPlay, X } from "lucide-react";
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
type Note = {
  id: string; status: string; statusMessage: string | null; source: string;
  recallBotId: string | null; recallRecordingId: string | null;
  transcriptText: string | null; transcriptJson: TLine[] | null;
  summary: Record<string, unknown> | null; templateUsed: string | null;
  event: { summary: string; eventType: string | null; start: string; attendees: { email: string; name: string | null; type: string | null }[] };
  insights: Insight[]; actions: NoteAction[];
};

const TABS = ["Watch", "Recording", "Transcript", "Summary", "Insights", "Actions", "Ask AI"] as const;
type Tab = (typeof TABS)[number];

function SummaryView({ summary }: { summary: Record<string, unknown> }) {
  return (
    <div className="flex flex-col gap-3">
      {Object.entries(summary).map(([key, value]) => (
        <div key={key}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#a3a6aa]">{key.replace(/_/g, " ")}</p>
          {typeof value === "string" ? (
            <p className="mt-0.5 text-[13.5px] text-[#273246]">{value || "—"}</p>
          ) : Array.isArray(value) ? (
            value.length === 0 ? (
              <p className="mt-0.5 text-[13.5px] text-[#a3a6aa]">—</p>
            ) : (
              <ul className="mt-0.5 list-disc pl-5 text-[13.5px] text-[#273246]">
                {value.map((v, i) => (
                  <li key={i}>{typeof v === "string" ? v : JSON.stringify(v)}</li>
                ))}
              </ul>
            )
          ) : (
            <p className="mt-0.5 text-[13.5px] text-[#273246]">{JSON.stringify(value)}</p>
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

export default function NoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [note, setNote] = useState<Note | null>(null);
  const [tab, setTab] = useState<Tab>("Watch");
  const [watchSide, setWatchSide] = useState<"transcript" | "insights" | "ask">("transcript");
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [watchSearch, setWatchSearch] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
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

  const ask = async () => {
    if (!question.trim()) return;
    setBusy(true);
    setAnswer(null);
    try {
      const res = await fetch(`/api/notetaker/notes/${id}/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setAnswer(data.answer as string);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Ask failed");
    } finally {
      setBusy(false);
    }
  };

  const askBox = (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          className="h-9 w-full rounded-lg border border-[#e1e6ec] bg-white px-2.5 text-[13px]"
          placeholder="What salary did the candidate ask for?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void ask();
          }}
        />
        <button type="button" className="primary-button shrink-0" disabled={busy || !question.trim()} onClick={() => void ask()}>
          Ask
        </button>
      </div>
      {answer && <p className="whitespace-pre-wrap rounded-lg bg-[#f8fafc] p-3 text-[13px] text-[#273246]">{answer}</p>}
      {!note?.transcriptText && <p className="text-[13px] text-[#718096]">Add a transcript before asking.</p>}
    </div>
  );

  const insightCards = (compact = false) => (
    <div className="flex flex-col gap-2">
      {(!note || note.insights.length === 0) && <p className="text-[13px] text-[#718096]">No insights yet.</p>}
      {(note?.insights ?? []).map((i) => (
        <div key={i.id} className={`rounded-lg border border-[#e9edf2] px-3 py-2.5 ${i.reviewStatus !== "PENDING" ? "opacity-60" : ""}`}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#a3a6aa]">
            {i.field.replace(/_/g, " ")}
            {typeof i.confidence === "number" ? ` · ${Math.round(i.confidence * 100)}%` : ""}
            {i.speaker ? ` · ${i.speaker}` : ""}
          </p>
          <p className="text-[13.5px] font-semibold text-[#273246]">{i.value}</p>
          {i.evidence && <p className="mt-1 text-[12.5px] italic text-[#718096]">“{i.evidence}”</p>}
          <div className="mt-1.5 flex items-center gap-2">
            {i.timestamp && (
              <button type="button" className="text-[12px] font-bold text-[#058d80] hover:underline" onClick={() => seek(i.timestamp!)}>
                {i.timestamp} — play moment
              </button>
            )}
            {i.reviewStatus === "PENDING" ? (
              <>
                <button type="button" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#178f84]" onClick={() => void review("insights", i.id, "ACCEPTED")}>
                  <Check size={13} /> Accept
                </button>
                <button type="button" className="inline-flex items-center gap-1 text-[12px] text-[#718096]" onClick={() => void review("insights", i.id, "IGNORED")}>
                  <X size={13} /> Ignore
                </button>
              </>
            ) : (
              <span className="text-[11px] font-bold text-[#718096]">{i.reviewStatus}</span>
            )}
          </div>
          {compact ? null : null}
        </div>
      ))}
    </div>
  );

  const actionCards = (
    <div className="flex flex-col gap-2">
      {(!note || note.actions.length === 0) && <p className="text-[13px] text-[#718096]">No suggested actions yet.</p>}
      {(note?.actions ?? []).map((a) => (
        <div key={a.id} className={`rounded-lg border border-[#e9edf2] px-3 py-2.5 ${a.reviewStatus !== "PENDING" ? "opacity-60" : ""}`}>
          <p className="text-[13.5px] font-semibold text-[#273246]">{a.title}</p>
          <p className="text-[12px] text-[#718096]">{[a.owner, a.dueDate, a.timestamp].filter(Boolean).join(" · ")}</p>
          {a.evidence && <p className="mt-1 text-[12.5px] italic text-[#718096]">“{a.evidence}”</p>}
          <div className="mt-1.5 flex items-center gap-2">
            {a.timestamp && (
              <button type="button" className="text-[12px] font-bold text-[#058d80] hover:underline" onClick={() => seek(a.timestamp!)}>
                {a.timestamp} — play moment
              </button>
            )}
            {a.reviewStatus === "PENDING" ? (
              <>
                <button type="button" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#178f84]" onClick={() => void review("actions", a.id, "CREATED_TASK")}>
                  <Check size={13} /> Create task
                </button>
                <button type="button" className="inline-flex items-center gap-1 text-[12px] text-[#718096]" onClick={() => void review("actions", a.id, "IGNORED")}>
                  <X size={13} /> Ignore
                </button>
              </>
            ) : (
              <span className="text-[11px] font-bold text-[#718096]">{a.reviewStatus}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const transcriptView = (lines: TLine[], clickable: boolean) => (
    <div>
      {!note?.transcriptText ? (
        <p className="text-[13px] text-[#718096]">No transcript yet.</p>
      ) : (
        <div className="flex max-h-[52vh] flex-col gap-1 overflow-auto pr-1">
          {lines.length === 0 && <p className="text-[13px] text-[#718096]">No matches.</p>}
          {lines.map((l, idx) => (
            <div key={idx} className={`rounded-md px-2 py-1 text-[13px] ${clickable && l.time ? "cursor-pointer hover:bg-[#e9f6f6]" : ""}`}
              onClick={clickable && l.time ? () => seek(l.time) : undefined}>
              {l.time && <span className="mr-1.5 font-bold text-[#058d80]">{l.time}</span>}
              {l.speaker && <span className="mr-1.5 font-semibold text-[#273246]">{l.speaker}:</span>}
              <span className="text-[#273246]">{l.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!note) {
    return (
      <div className="flex h-full flex-col">
        <Header kicker={<span className="inline-flex items-center gap-2"><Mic size={16} /> AI Notetaker</span>} />
        <p className="p-6 text-[13.5px] text-[#718096]">Loading…</p>
      </div>
    );
  }

  const lines = transcriptLines(note, search);
  const watchLines = transcriptLines(note, watchSearch);

  return (
    <div className="flex h-full flex-col">
      <Header kicker={<span className="inline-flex items-center gap-2"><Mic size={16} /> AI Notetaker</span>} />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 overflow-y-auto p-4 md:p-6">
        <Link href="/dashboard/notetaker" className="inline-flex items-center gap-1 text-[13px] text-[#718096] hover:text-[#273246]">
          <ArrowLeft size={14} /> All notes
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-[19px] font-semibold text-[#273246]">{note.event.summary}</h1>
            <p className="text-[13px] text-[#718096]">
              {note.event.eventType ?? "Meeting"} · {new Date(note.event.start).toLocaleString()}
              {note.templateUsed ? ` · ${note.templateUsed} template` : ""}
            </p>
            <p className="mt-0.5 text-[12px] text-[#718096]">
              {note.event.attendees.map((a) => `${a.name ?? a.email}${a.type ? ` (${a.type})` : ""}`).join(" · ")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusChip status={note.status} />
            {note.transcriptText && (
              <button type="button" className="text-button" disabled={busy} onClick={() => void reanalyze()}>
                Re-analyze
              </button>
            )}
          </div>
        </div>
        {note.statusMessage && (
          <div className="sync-banner" style={{ margin: 0 }}>
            <div><Mic size={15} /><span>{note.statusMessage}</span></div>
          </div>
        )}

        <div className="flex flex-wrap gap-1 border-b border-[#e9edf2]">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-[13.5px] font-semibold transition ${
                tab === t ? "border-b-2 border-[#058d80] text-[#058d80]" : "text-[#718096] hover:text-[#273246]"
              }`}
            >
              {t}
              {t === "Insights" && note.insights.length > 0 ? ` (${note.insights.length})` : ""}
              {t === "Actions" && note.actions.length > 0 ? ` (${note.actions.length})` : ""}
            </button>
          ))}
        </div>

        {tab === "Watch" && (
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="flex min-w-0 flex-col gap-4">
              <section className="overflow-hidden rounded-xl border border-[#e9edf2] bg-[#242e45]">
                {videoUrl ? (
                  <video ref={videoRef} controls className="aspect-video w-full" src={videoUrl} />
                ) : (
                  <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 p-6 text-center">
                    <MonitorPlay size={28} className="text-[#98a3b8]" />
                    <p className="text-[13.5px] text-[#d6dbe5]">
                      {videoError ?? (note.recallRecordingId ? "Loading recording…" : "No recording yet — the video appears here after the bot records the Meet.")}
                    </p>
                    {note.recallRecordingId && (
                      <button type="button" className="text-button" onClick={() => void loadVideo()}>Retry</button>
                    )}
                  </div>
                )}
              </section>
              <section className="rounded-xl border border-[#e9edf2] bg-white p-4">
                <h2 className="text-[15px] font-semibold text-[#273246]">Summary</h2>
                <div className="mt-2">{!note.summary ? <p className="text-[13px] text-[#718096]">No summary yet.</p> : <SummaryView summary={note.summary} />}</div>
              </section>
              <section className="rounded-xl border border-[#e9edf2] bg-white p-4">
                <h2 className="text-[15px] font-semibold text-[#273246]">Suggested actions</h2>
                <div className="mt-2">{actionCards}</div>
              </section>
            </div>
            <aside className="flex min-h-0 flex-col rounded-xl border border-[#e9edf2] bg-white">
              <div className="flex gap-1 border-b border-[#e9edf2] px-2 pt-2">
                {(["transcript", "insights", "ask"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setWatchSide(s)}
                    className={`rounded-t-lg px-3 py-2 text-[13px] font-semibold capitalize ${watchSide === s ? "bg-[#e9f6f6] text-[#058d80]" : "text-[#718096] hover:text-[#273246]"}`}
                  >
                    {s === "ask" ? "Ask AI" : s}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {watchSide === "transcript" && (
                  <div className="flex flex-col gap-2">
                    <input
                      className="h-9 w-full rounded-lg border border-[#e1e6ec] bg-white px-2.5 text-[13px]"
                      placeholder="Search — click a line to seek…"
                      value={watchSearch}
                      onChange={(e) => setWatchSearch(e.target.value)}
                    />
                    {transcriptView(watchLines, true)}
                  </div>
                )}
                {watchSide === "insights" && insightCards(true)}
                {watchSide === "ask" && askBox}
              </div>
            </aside>
          </div>
        )}

        {tab === "Recording" && (
          <section className="rounded-xl border border-[#e9edf2] bg-white p-4">
            <h2 className="text-[15px] font-semibold text-[#273246]">Capture</h2>
            <div className="mt-2 flex flex-col gap-2 text-[13.5px] text-[#273246]">
              <p>Source: <span className="font-semibold">{note.source}</span></p>
              {note.recallBotId && <p className="text-[#718096]">Bot: {note.recallBotId}</p>}
              {note.status === "JOINING" && (
                <div className="sync-banner" style={{ margin: 0 }}>
                  <div><Mic size={15} /><span>If the bot is stuck here, open the Meet and admit “Wiggli Notetaker” from the waiting room.</span></div>
                </div>
              )}
              <div className="mt-1">
                <p className="mb-1 font-semibold">Paste a transcript to test the AI without a bot:</p>
                <textarea
                  className="min-h-32 w-full rounded-lg border border-[#e1e6ec] bg-white p-2.5 text-[13px]"
                  placeholder="[00:00:05] Recruiter: …"
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                />
                <button type="button" className="primary-button mt-2" disabled={busy || !paste.trim()} onClick={() => void submitTranscript()}>
                  Save & analyze
                </button>
              </div>
            </div>
          </section>
        )}

        {tab === "Transcript" && (
          <section className="rounded-xl border border-[#e9edf2] bg-white p-4">
            <h2 className="text-[15px] font-semibold text-[#273246]">Transcript</h2>
            <div className="mt-2 flex flex-col gap-2">
              <input
                className="h-9 w-full rounded-lg border border-[#e1e6ec] bg-white px-2.5 text-[13px]"
                placeholder="Search transcript…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {transcriptView(lines, false)}
            </div>
          </section>
        )}

        {tab === "Summary" && (
          <section className="rounded-xl border border-[#e9edf2] bg-white p-4">
            <h2 className="text-[15px] font-semibold text-[#273246]">AI summary</h2>
            <div className="mt-2">{!note.summary ? <p className="text-[13px] text-[#718096]">No summary yet — add a transcript first.</p> : <SummaryView summary={note.summary} />}</div>
          </section>
        )}

        {tab === "Insights" && (
          <section className="rounded-xl border border-[#e9edf2] bg-white p-4">
            <h2 className="text-[15px] font-semibold text-[#273246]">Candidate insights</h2>
            <div className="mt-2">{insightCards()}</div>
          </section>
        )}

        {tab === "Actions" && (
          <section className="rounded-xl border border-[#e9edf2] bg-white p-4">
            <h2 className="text-[15px] font-semibold text-[#273246]">Suggested actions</h2>
            <div className="mt-2">{actionCards}</div>
          </section>
        )}

        {tab === "Ask AI" && (
          <section className="rounded-xl border border-[#e9edf2] bg-white p-4">
            <h2 className="text-[15px] font-semibold text-[#273246]">Ask about this meeting</h2>
            <div className="mt-2">{askBox}</div>
          </section>
        )}
      </div>
    </div>
  );
}
