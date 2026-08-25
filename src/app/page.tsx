import Link from "next/link";
import {
  CalendarDays,
  Ban,
  Palette,
  RefreshCw,
  ArrowRight,
} from "lucide-react";

const FEATURES = [
  {
    icon: Ban,
    title: "No gray invites",
    body: "Events are created with sendUpdates:\u0022none\u0022 — Google's default plain invite email is suppressed entirely.",
  },
  {
    icon: Palette,
    title: "Your brand, your email",
    body: "Branded HTML invitations (or fully custom bodies) delivered from your own Gmail via the Gmail API.",
  },
  {
    icon: CalendarDays,
    title: "Native RSVP syncing",
    body: "A METHOD:REQUEST .ics rides along with every email — Gmail, Outlook and Apple Calendar all offer Yes / Maybe / No.",
  },
  {
    icon: RefreshCw,
    title: "Statuses in one place",
    body: "One-click buttons in the email hit our API instantly; a Sync button pulls native calendar responses too.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <CalendarDays className="size-5 text-primary" />
            Wiggli <span className="font-normal text-muted-foreground">Calendar</span>
          </span>
          <Link
            href="/dashboard/create"
            className="ml-auto rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            Open dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Custom calendar invites.
          <br />
          <span className="text-muted-foreground">From your own Gmail.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">
          Create events, add attendees, and send beautifully branded HTML invitations with an
          embedded iCalendar payload — while keeping Google Calendar&apos;s native RSVP flow
          fully intact.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/dashboard/create"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow"
          >
            Create an event <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/dashboard/events"
            className="rounded-md border px-5 py-2.5 text-sm font-medium hover:bg-accent"
          >
            View RSVPs
          </Link>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-4 text-left sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border p-5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <f.icon className="size-5 text-primary" />
              </div>
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Demo · Next.js + Prisma/SQLite + Gmail API + METHOD:REQUEST iCal payloads
      </footer>
    </div>
  );
}
