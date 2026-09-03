"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TIMEZONES } from "@/lib/timezones";
import { guessLocalTimezone } from "@/lib/format";
import { buildDefaultInviteHtml, type InviteContext } from "@/lib/email-template";
import type { EventDto } from "@/types/event";

type AttendeeRow = { email: string; name: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function defaultStartLocal(): string {
  // Next half-hour slot in the user's LOCAL time (never in the past).
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 30, 0, 0); // round UP to next half hour
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "YYYY-MM-DDTHH:mm" + minutes → same format. */
function addMinutesLocal(wallClock: string, mins: number): string {
  const d = new Date(wallClock);
  if (Number.isNaN(d.getTime())) return wallClock;
  d.setMinutes(d.getMinutes() + mins);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Date → "YYYY-MM-DDTHH:mm" in local time (for input min= attributes). */
function toLocalInputValue(d: Date): string {
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function durationMs(a: string, b: string): number {
  return new Date(b).getTime() - new Date(a).getTime();
}

function durationOk(start: string, end: string): boolean {
  return durationMs(start, end) >= 15 * 60_000;
}

function durationLabel(start: string, end: string): string {
  const ms = durationMs(start, end);
  if (!Number.isFinite(ms) || ms <= 0) return "invalid range";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

// client-safe: zonedWallClockToUtc is pure Intl math (no node deps)
import { zonedWallClockToUtc } from "@/lib/datetime";

/** Renders the REAL branded email HTML attendees will receive (preview mode). */
function EmailPreview(props: {
  summary: string;
  description: string;
  location: string;
  start: string;
  end: string;
  timezone: string;
  customHtml: boolean;
}) {
  // Stable preview fallbacks (lazy init keeps render pure for the compiler).
  const [fallbackStart] = useState(() => new Date());
  const [fallbackEnd] = useState(() => new Date(Date.now() + 3600_000));
  const startUtc = props.start
    ? zonedWallClockToUtc(props.start, props.timezone)
    : fallbackStart;
  const endUtc = props.end
    ? zonedWallClockToUtc(props.end, props.timezone)
    : fallbackEnd;

  const ctx: InviteContext = {
    event: {
      summary: props.summary || "Your event title",
      description: props.description || null,
      location: props.location || null,
      startUtc,
      endUtc,
      timezone: props.timezone,
    },
    attendeeNameOrEmail: "guest",
    organizerEmail: "you@gmail.com",
    attendees: [],
    meetUrl: null,
    reminderLabel: null,
  };

  if (props.customHtml) {
    return (
      <div className="rounded-md border bg-muted-foreground/5 p-4 text-sm">
        <Badge variant="secondary" className="mb-2">Custom HTML body</Badge>
        <p className="text-xs text-muted-foreground">
          Your custom body is sent verbatim inside the invite email, alongside the
          attached calendar invitation attendees respond to natively.
        </p>
        <div
          className="mt-2 rounded border p-3"
          dangerouslySetInnerHTML={{
            __html: `<div class="text-xs">${escapeHtml(props.description || "(your custom HTML)")}</div>`,
          }}
        />
      </div>
    );
  }

  // The exact same function that generates the outbound email, in preview mode.
  const html = buildDefaultInviteHtml(
    ctx,
    { preview: true }
  )
    .replace(/<\!doctype html>/i, "")
    .replace(/<\/?html[^>]*>/gi, "")
    .replace(/<body[^>]*>/i, "")
    .replace(/<\/body>/i, "");

  return (
    <div className="overflow-hidden rounded-lg border bg-[#f2f7f4] shadow-sm">
      <iframe
        title="Email preview"
        srcDoc={html}
        sandbox=""
        className="h-[560px] w-full border-0 bg-transparent"
      />
    </div>
  );
}

function escapeHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function CreateEventPage() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  // Defaults: next half-hour slot in the user's LOCAL timezone; end +1h.
  const [start, setStart] = useState(defaultStartLocal());
  const [end, setEnd] = useState(() => addMinutesLocal(defaultStartLocal(), 60));
  const [timezone, setTimezone] = useState(guessLocalTimezone());
  const [attendees, setAttendees] = useState<AttendeeRow[]>([{ email: "", name: "" }]);
  const [emailSubject, setEmailSubject] = useState("");
  const [customHtmlOn, setCustomHtmlOn] = useState(false);
  const [emailHtml, setEmailHtml] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastCreated, setLastCreated] = useState<EventDto | null>(null);

  /** Start changes: keep duration ≥15min by nudging end when it would cross. */
  function onStartChange(v: string) {
    setStart(v);
    if (!v) return;
    const s = new Date(v).getTime();
    const e = new Date(end).getTime();
    if (Number.isFinite(s) && Number.isFinite(e) && e - s < 15 * 60_000) {
      setEnd(addMinutesLocal(v, 30));
    }
  }

  const addRow = () => setAttendees((r) => [...r, { email: "", name: "" }]);
  const removeRow = (i: number) =>
    setAttendees((r) => (r.length > 1 ? r.filter((_, idx) => idx !== i) : r));
  const updateRow = (i: number, patch: Partial<AttendeeRow>) =>
    setAttendees((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const cleanAttendees = attendees
      .map((a) => ({ email: a.email.trim().toLowerCase(), name: a.name.trim() }))
      .filter((a) => a.email.length > 0);
    if (cleanAttendees.length === 0) return toast.error("Add at least one attendee.");
    if (cleanAttendees.some((a) => !EMAIL_RE.test(a.email)))
      return toast.error("One of the attendee emails looks invalid.");

    // Time sanity (mirrors server rules: future start, ≥15 min duration)
    const sMs = new Date(start).getTime();
    const eMs = new Date(end).getTime();
    if (!Number.isFinite(sMs) || !Number.isFinite(eMs))
      return toast.error("Please pick valid start and end times.");
    if (eMs - sMs < 15 * 60_000)
      return toast.error("Meetings must be at least 15 minutes long.");
    if (sMs < Date.now() - 60_000)
      return toast.error("Start time must be in the future.");

    if (!session?.accessToken) {
      return toast.error("Please sign in with Google first.");
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          summary,
          description,
          location,
          start,
          end,
          timezone,
          attendees: cleanAttendees,
          emailSubject,
          emailHtml: customHtmlOn ? emailHtml : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);

      toast.success(`Invite${cleanAttendees.length > 1 ? "s" : ""} sent! Google event created.`);
      setLastCreated(body as EventDto);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invites");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <Card>
        <CardHeader>
          <CardTitle>New event</CardTitle>
          <CardDescription>
            Creates the Google Calendar event (<code>sendUpdates: &quot;none&quot;</code>), then sends your branded invite with an attached METHOD:REQUEST .ics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!session && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              Sign in with Google (top right) to create events and send emails.
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="title">Event title</Label>
            <Input id="title" value={summary} onChange={(e) => setSummary(e.target.value)}
                   placeholder="Quarterly Product Sync" required />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="start">Start</Label>
              <Input id="start" type="datetime-local" value={start}
                     min={toLocalInputValue(new Date())}
                     onChange={(e) => onStartChange(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">End</Label>
              <Input id="end" type="datetime-local" value={end}
                     min={addMinutesLocal(start, 15)}
                     onChange={(e) => setEnd(e.target.value)} required />
              <p className="text-xs text-muted-foreground">
                Minimum 15 minutes · {durationLabel(start, end)}
                {durationOk(start, end) ? "" : " — too short (min 15 min)"}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tz">Timezone</Label>
            <Select value={timezone} onValueChange={(v) => setTimezone(v ?? guessLocalTimezone())}>
              <SelectTrigger id="tz" className="w-full">
                <SelectValue placeholder="Pick a timezone" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="loc">Location <span className="text-muted-foreground">(address or meeting URL)</span></Label>
            <Input id="loc" value={location} onChange={(e) => setLocation(e.target.value)}
                   placeholder="https://meet.google.com/abc-defg-hij or 12 Rue de la Paix, Paris" />
          </div>

          <div className="space-y-1.5">
            <Label>Description / email body context</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
                      placeholder="Agenda, dial-in details, anything attendees should know…" />
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Attendees</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRow}>+ Add</Button>
            </div>
            {attendees.map((row, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="name@email.com" type="email" value={row.email}
                       onChange={(e) => updateRow(i, { email: e.target.value })} />
                <Input placeholder="Name (optional)" className="max-w-44" value={row.name}
                       onChange={(e) => updateRow(i, { name: e.target.value })} />
                <Button type="button" variant="ghost" size="icon"
                        onClick={() => removeRow(i)} aria-label="Remove attendee">×</Button>
              </div>
            ))}
          </div>

          <Separator />

          <Tabs defaultValue="default" onValueChange={(v) => setCustomHtmlOn(v === "custom")}>
            <TabsList>
              <TabsTrigger value="default">Branded template</TabsTrigger>
              <TabsTrigger value="custom">Custom HTML</TabsTrigger>
            </TabsList>
            <TabsContent value="default" className="pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="subj">Email subject override <span className="text-muted-foreground">(optional)</span></Label>
                <Input id="subj" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)}
                       placeholder={`Invitation: ${summary || "…"}`} />
              </div>
            </TabsContent>
            <TabsContent value="custom" className="pt-2 space-y-2">
              <Label htmlFor="html">Custom HTML body</Label>
              <Textarea id="html" rows={8} value={emailHtml}
                        onChange={(e) => setEmailHtml(e.target.value)}
                        className="font-mono text-xs"
                        placeholder="<h2>You're invited!</h2><p>Join us for …</p>" />
              <p className="text-xs text-muted-foreground">
                The RSVP button row is appended automatically to custom bodies.
              </p>
            </TabsContent>
          </Tabs>

          <Button type="submit" disabled={submitting || !session} className="w-full">
            {submitting ? "Creating & sending…" : "Create event & send invites"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4 lg:sticky lg:top-8 self-start">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Live preview</CardTitle>
            <CardDescription>What attendees see in their inbox.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmailPreview
              summary={summary}
              description={description}
              location={location}
              start={start}
              end={end}
              timezone={timezone}
              customHtml={customHtmlOn}
            />
          </CardContent>
        </Card>

        {lastCreated && (
          <Card className="border-emerald-500/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-emerald-600 dark:text-emerald-400">✓ Sent</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><strong>{lastCreated.summary}</strong></p>
              <p className="text-muted-foreground">Google event: {lastCreated.googleEventId}</p>
              <p className="text-muted-foreground">iCalUID: <code className="text-xs">{lastCreated.iCalUID}</code></p>
              <p className="text-muted-foreground">{lastCreated.attendees.length} attendee(s) emailed.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </form>
  );
}
