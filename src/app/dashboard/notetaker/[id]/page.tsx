"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Insight = {
  id: string; field: string; value: string; confidence: number | null;
  speaker: string | null; timestamp: string | null; evidence: string | null; reviewStatus: string;
};
type NoteAction = {
  id: string; title: string; owner: string | null; dueDate: string | null;
  timestamp: string | null; evidence: string | null; reviewStatus: string;
};
type Note = {
  id: string; status: string; statusMessage: string | null; source: string;
  recallBotId: string | null; recallRecordingUrl: string | null;
  transcriptText: string | null; summary: Record<string, unknown> | null; templateUsed: string | null;
  event: { summary: string; eventType: string | null; start: string; attendees: { email: string; name: string | null; type: string | null }[] };
  insights: Insight[]; actions: NoteAction[];
};

const TABS = ["Recording", "Transcript", "Summary", "Insights", "Actions", "Ask AI"] as const;

function SummaryView({ summary }: { summary: Record<string, unknown> }) {
  return (
    <div className="flex flex-col gap-3">
      {Object.entries(summary).map(([key, value]) => (
        <div key={key}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{key.replace(/_/g, " ")}</p>
          {typeof value === "string" ? (
            <p className="text-sm">{value || "—"}</p>
          ) : Array.isArray(value) ? (
            value.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="list-disc pl-5 text-sm">
                {value.map((v, i) => (
                  <li key={i}>{typeof v === "string" ? v : JSON.stringify(v)}</li>
                ))}
              </ul>
            )
          ) : (
            <p className="text-sm">{JSON.stringify(value)}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function NoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [note, setNote] = useState<Note | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Recording");
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`/api/notetaker/notes/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { note: Note };
      setNote(data.note);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load note");
    }
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 10000); // live status while bot works
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
      toast.success("Transcript analyzed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
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
      toast.success("Re-analyzed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const reviewInsight = async (insightId: string, decision: "ACCEPTED" | "IGNORED") => {
    const res = await fetch(`/api/notetaker/insights/${insightId}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (res.ok) void load();
    else toast.error("Review failed");
  };

  const reviewAction = async (actionId: string, decision: "CREATED_TASK" | "IGNORED") => {
    const res = await fetch(`/api/notetaker/actions/${actionId}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (res.ok) void load();
    else toast.error("Review failed");
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
      toast.error(err instanceof Error ? err.message : "Ask failed");
    } finally {
      setBusy(false);
    }
  };

  if (!note) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;

  const transcriptLines = (note.transcriptText ?? "")
    .split("\n")
    .filter((l) => (search ? l.toLowerCase().includes(search.toLowerCase()) : true));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <Link href="/dashboard/notetaker" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> All notes
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{note.event.summary}</h1>
          <p className="text-sm text-muted-foreground">
            {note.event.eventType ?? "Meeting"} · {new Date(note.event.start).toLocaleString()}
            {note.templateUsed ? ` · ${note.templateUsed} template` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {note.event.attendees.map((a) => `${a.name ?? a.email}${a.type ? ` (${a.type})` : ""}`).join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{note.status}</Badge>
          {note.transcriptText && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void reanalyze()}>
              Re-analyze
            </Button>
          )}
        </div>
      </div>
      {note.statusMessage && (
        <Card>
          <CardContent className="py-3 text-sm">{note.statusMessage}</CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "default" : "ghost"} onClick={() => setTab(t)}>
            {t}
            {t === "Insights" && note.insights.length > 0 ? ` (${note.insights.length})` : ""}
            {t === "Actions" && note.actions.length > 0 ? ` (${note.actions.length})` : ""}
          </Button>
        ))}
      </div>

      {tab === "Recording" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Capture</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p>Source: <Badge variant="secondary">{note.source}</Badge></p>
            {note.recallBotId && <p className="text-muted-foreground">Bot: {note.recallBotId}</p>}
            {note.recallRecordingUrl && (
              <a className="text-blue-600 underline" href={note.recallRecordingUrl} target="_blank" rel="noreferrer">
                Open recording
              </a>
            )}
            {note.status === "JOINING" && (
              <p className="rounded-md bg-amber-500/10 p-3">
                If the bot is stuck here, open the Meet and admit “Wiggli Notetaker” from the waiting room.
              </p>
            )}
            <div>
              <p className="mb-1 font-medium">Paste a transcript to test the AI without a bot:</p>
              <textarea
                className="min-h-32 w-full rounded-md border bg-background p-2 text-sm"
                placeholder="[00:00:05] Recruiter: …"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
              />
              <Button size="sm" className="mt-2" disabled={busy || !paste.trim()} onClick={() => void submitTranscript()}>
                Save & analyze
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "Transcript" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Transcript</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            <input
              className="w-full rounded-md border bg-background p-2 text-sm"
              placeholder="Search transcript…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {!note.transcriptText ? (
              <p className="text-sm text-muted-foreground">No transcript yet.</p>
            ) : (
              <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">
                {transcriptLines.join("\n") || "No matches."}
              </pre>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "Summary" && (
        <Card>
          <CardHeader><CardTitle className="text-base">AI summary</CardTitle></CardHeader>
          <CardContent>
            {!note.summary ? (
              <p className="text-sm text-muted-foreground">No summary yet — add a transcript first.</p>
            ) : (
              <SummaryView summary={note.summary} />
            )}
          </CardContent>
        </Card>
      )}

      {tab === "Insights" && (
        <div className="flex flex-col gap-2">
          {note.insights.length === 0 && (
            <p className="text-sm text-muted-foreground">No insights yet.</p>
          )}
          {note.insights.map((i) => (
            <Card key={i.id} className={i.reviewStatus !== "PENDING" ? "opacity-60" : ""}>
              <CardContent className="flex items-start justify-between gap-3 py-3">
                <div className="text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {i.field.replace(/_/g, " ")}
                    {typeof i.confidence === "number" ? ` · ${Math.round(i.confidence * 100)}%` : ""}
                    {i.speaker ? ` · ${i.speaker}` : ""}
                    {i.timestamp ? ` · ${i.timestamp}` : ""}
                  </p>
                  <p className="font-medium">{i.value}</p>
                  {i.evidence && <p className="mt-1 italic text-muted-foreground">“{i.evidence}”</p>}
                  {i.reviewStatus !== "PENDING" && (
                    <Badge variant="secondary" className="mt-1">{i.reviewStatus}</Badge>
                  )}
                </div>
                {i.reviewStatus === "PENDING" && (
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="outline" onClick={() => void reviewInsight(i.id, "ACCEPTED")}>
                      <Check size={14} /> Accept
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void reviewInsight(i.id, "IGNORED")}>
                      <X size={14} /> Ignore
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === "Actions" && (
        <div className="flex flex-col gap-2">
          {note.actions.length === 0 && (
            <p className="text-sm text-muted-foreground">No suggested actions yet.</p>
          )}
          {note.actions.map((a) => (
            <Card key={a.id} className={a.reviewStatus !== "PENDING" ? "opacity-60" : ""}>
              <CardContent className="flex items-start justify-between gap-3 py-3">
                <div className="text-sm">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[a.owner, a.dueDate, a.timestamp].filter(Boolean).join(" · ")}
                  </p>
                  {a.evidence && <p className="mt-1 italic text-muted-foreground">“{a.evidence}”</p>}
                  {a.reviewStatus !== "PENDING" && (
                    <Badge variant="secondary" className="mt-1">{a.reviewStatus}</Badge>
                  )}
                </div>
                {a.reviewStatus === "PENDING" && (
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="outline" onClick={() => void reviewAction(a.id, "CREATED_TASK")}>
                      <Check size={14} /> Create task
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void reviewAction(a.id, "IGNORED")}>
                      <X size={14} /> Ignore
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === "Ask AI" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Ask about this meeting</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                className="w-full rounded-md border bg-background p-2 text-sm"
                placeholder="What salary did the candidate ask for?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void ask();
                }}
              />
              <Button size="sm" disabled={busy || !question.trim()} onClick={() => void ask()}>
                Ask
              </Button>
            </div>
            {answer && <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">{answer}</p>}
            {!note.transcriptText && (
              <p className="text-sm text-muted-foreground">Add a transcript before asking.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
