"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EventDto } from "@/types/event";
import { formatEventRange } from "@/lib/format";

const RSVP_BADGE: Record<string, { label: string; className: string }> = {
  NEEDS_ACTION: { label: "No response", className: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300" },
  ACCEPTED: { label: "Yes", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  TENTATIVE: { label: "Maybe", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  DECLINED: { label: "No", className: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

function RsvpBadge({ status }: { status: string }) {
  const cfg = RSVP_BADGE[status] ?? RSVP_BADGE.NEEDS_ACTION;
  return <Badge variant="secondary" className={cfg.className}>{cfg.label}</Badge>;
}

export default function EventsPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<EventDto[] | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEvents(await res.json());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load events");
      setEvents([]);
    }
  };

  /** Silent auto-sync: pull native responses, then refresh the list. */
  const autoSync = async () => {
    if (!session?.accessToken) return;
    try {
      await fetch("/api/sync", { method: "POST" });
    } catch {
      /* silent — next tick retries */
    }
    await load();
  };

  useEffect(() => {
    void load();
  }, []);

  // Auto-sync loop: native RSVPs flow in without anyone pressing anything.
  useEffect(() => {
    if (!session?.accessToken) return;
    void autoSync(); // immediate first pull
    const id = setInterval(autoSync, 15_000); // then every 15s
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken]);

  async function syncAll() {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.importedEvents > 0 || body.updatedAttendees > 0) {
        const imported = body.importedEvents > 0 ? `${body.importedEvents} event(s) imported` : "";
        const responses = body.updatedAttendees > 0 ? `${body.updatedAttendees} response(s) updated` : "";
        toast.success([imported, responses].filter(Boolean).join(" · ") + " from Google Calendar.");
      } else {
        toast.info("Everything already up to date.");
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Events &amp; RSVPs</h1>
          <p className="text-sm text-muted-foreground">
            Google Calendar events and RSVP responses — auto-synced every 15 seconds.
          </p>
        </div>
        <Button onClick={syncAll} disabled={syncing || !session}>
          <RefreshCw className={`size-4${syncing ? " animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync now"}
        </Button>
        {!session && <p className="text-sm text-muted-foreground">Sign in to sync.</p>}
      </div>

      {events === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No events yet — create one from the “Create event” tab.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => {
            const counts = event.attendees.reduce<Record<string, number>>((acc, a) => {
              acc[a.rsvp] = (acc[a.rsvp] ?? 0) + 1;
              return acc;
            }, {});
            return (
              <Card key={event.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{event.summary}</CardTitle>
                    {counts.ACCEPTED ? <Badge className="bg-emerald-600">{counts.ACCEPTED} yes</Badge> : null}
                    {counts.TENTATIVE ? <Badge variant="outline">{counts.TENTATIVE} maybe</Badge> : null}
                    {counts.DECLINED ? <Badge variant="outline">{counts.DECLINED} no</Badge> : null}
                  </div>
                  <CardDescription>
                    {formatEventRange(event.start, event.end, event.timezone)}
                    {event.location ? ` · ${event.location}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y rounded-md border text-sm">
                    {event.attendees.map((a) => (
                      <li key={a.id} className="flex items-center justify-between px-3 py-2">
                        <span className="truncate">
                          {a.name ? `${a.name} ` : ""}
                          <span className="text-muted-foreground">&lt;{a.email}&gt;</span>
                        </span>
                        <RsvpBadge status={a.rsvp} />
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 truncate text-xs text-muted-foreground">
                    iCalUID: <code>{event.iCalUID}</code>
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
