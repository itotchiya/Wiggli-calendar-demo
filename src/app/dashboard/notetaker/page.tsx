"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Mic, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EventDto } from "@/types/event";

type NoteRow = {
  id: string;
  status: string;
  statusMessage: string | null;
  source: string;
  templateUsed: string | null;
  updatedAt: string;
  event: EventDto & { attendees: { email: string; name: string | null; type: string | null }[] };
  _count: { insights: number; actions: number };
};

const STATUS_BADGE: Record<string, string> = {
  CREATED: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300",
  JOINING: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  RECORDING: "bg-red-500/15 text-red-600 dark:text-red-400",
  TRANSCRIBED: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  PROCESSING: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  READY: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  FAILED: "bg-red-500/15 text-red-600 dark:text-red-400",
};

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
      toast.error(err instanceof Error ? err.message : "Failed to load notes");
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
      toast.success(source === "RECALL_BOT" ? "Notetaker bot scheduled — admit it in Meet." : "Note created — paste the transcript.");
      setPicking(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create note");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Mic size={20} /> AI Notetaker
          </h1>
          <p className="text-sm text-muted-foreground">
            Test mode — mock/test meetings only. The bot joins Google Meet, records, transcribes and drafts notes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setPicking((v) => !v)}>
            <Plus size={14} /> New note
          </Button>
        </div>
      </div>

      {picking && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attach notetaker to an event</CardTitle>
            <CardDescription>Pick a calendar event. Bot needs a Google Meet link on the event.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {events.length === 0 && <p className="text-sm text-muted-foreground">No events found.</p>}
            {events.slice(0, 20).map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.eventType ?? "Meeting"} · {new Date(e.start).toLocaleString()}
                    {e.hangoutLink ? " · Meet link" : " · no Meet link"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" disabled={creating} onClick={() => void create(e.id, "MANUAL_PASTE")}>
                    Paste transcript
                  </Button>
                  <Button size="sm" disabled={creating || !e.hangoutLink} onClick={() => void create(e.id, "RECALL_BOT")}>
                    Send bot
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {notes === null ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : notes.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No notes yet. Click “New note”, pick an event and send the bot — or paste a transcript to test the AI without a bot.
            </p>
          ) : (
            <div className="divide-y">
              {notes.map((n) => (
                <Link key={n.id} href={`/dashboard/notetaker/${n.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{n.event.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {n.event.eventType ?? "Meeting"} · {new Date(n.event.start).toLocaleString()}
                      {n.templateUsed ? ` · ${n.templateUsed} template` : ""}
                      {n.statusMessage ? ` · ${n.statusMessage}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {n._count.insights > 0 && (
                      <span className="text-xs text-muted-foreground">{n._count.insights} insights · {n._count.actions} actions</span>
                    )}
                    <Badge variant="secondary" className={STATUS_BADGE[n.status] ?? STATUS_BADGE.CREATED}>
                      {n.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
