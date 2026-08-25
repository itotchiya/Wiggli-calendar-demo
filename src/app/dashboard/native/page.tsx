"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CalendarDays, Plus, ArrowLeft, Sparkles } from "lucide-react";
import { EventDrawer, type TimedDate } from "@/components/event-drawer";

type DrawerEvent = {
  id: string;
  title: string;
  date: string;
  hour: number;
  minute: number;
  endHour: number;
  endMinute: number;
  hangoutLink?: string | null;
  attendees: { name: string; email: string; rsvp: string }[];
};

function formatOccurrence(o: { date: string; start: string; end: string }) {
  const d = new Date(`${o.date}T00:00:00`);
  const label = new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
  return `${label} · ${o.start}–${o.end}`;
}

/**
 * NATIVE Google-invitation test page — same drawer UI but WITHOUT step 2.
 * "Create event & invite" uses sendUpdates:"all": Google itself emails every
 * attendee its standard calendar invitation (title/time/location/Meet/reminder/
 * description). No custom email, no AI templates. For A/B testing approaches.
 */
export default function NativeDrawerPage() {
  const { data: session } = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [events, setEvents] = useState<DrawerEvent[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      if (!res.ok) return;
      const list = (await res.json()) as {
        id: string;
        summary: string;
        start: string;
        end: string;
        hangoutLink?: string | null;
        attendees: { name: string | null; email: string; rsvp: string }[];
      }[];
      setEvents(
        list.map((e) => {
          const s = new Date(e.start);
          const en = new Date(e.end);
          const pad = (n: number) => String(n).padStart(2, "0");
          return {
            id: e.id,
            title: e.summary,
            date: `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`,
            hour: s.getHours(),
            minute: s.getMinutes(),
            endHour: en.getHours(),
            endMinute: en.getMinutes(),
            hangoutLink: e.hangoutLink ?? null,
            attendees: e.attendees.map((a) => ({
              name: a.name ?? a.email,
              email: a.email,
              rsvp: a.rsvp,
            })),
          };
        })
      );
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-sync native RSVP statuses every 15s
  useEffect(() => {
    if (!session?.accessToken) return;
    const tick = async () => {
      try {
        await fetch("/api/sync", { method: "POST" });
      } catch {
        /* silent */
      }
      await load();
    };
    void tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [session?.accessToken, load]);

  return (
    <div className="min-h-screen" style={{ background: "#f8fafc", color: "#273246", fontFamily: "var(--font-inter), Inter, sans-serif" }}>
      <header style={{ borderBottom: "1px solid #e9edf2", background: "#fff" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 16px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/dashboard/drawer" style={{ display: "flex", alignItems: "center", gap: 6, color: "#718096", fontSize: 14 }}>
            <ArrowLeft size={16} /> Custom-email drawer
          </Link>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
            <CalendarDays size={18} color="#267a72" /> Native Google invitation
          </span>
          {!session && (
            <a href="/api/auth/signin" style={{ marginLeft: "auto", fontSize: 13, color: "#267a72", fontWeight: 600 }}>
              Sign in with Google →
            </a>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, letterSpacing: "-.01em" }}>Native calendar invitations</h1>
            <p style={{ margin: "4px 0 0", color: "#718096", fontSize: 14 }}>
              One-step drawer. Google Calendar itself emails attendees its standard invite (title · time · location · Meet · reminder · description).
              No custom email, no AI, no Linked-to.
            </p>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#267a72",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "10px 18px",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            <Plus size={17} /> New event
          </button>
        </div>

        {events.length === 0 ? (
          <div style={{ border: "1px dashed #d5dde5", borderRadius: 14, padding: 48, textAlign: "center", color: "#718096", fontSize: 14 }}>
            No events yet.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {events.map((e) => (
              <div key={e.id} style={{ background: "#fff", border: "1px solid #e9edf2", borderRadius: 14, padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 15 }}>{e.title}</strong>
                  <span style={{ color: "#718096", fontSize: 13 }}>
                    {formatOccurrence({ date: e.date, start: `${String(e.hour).padStart(2, "0")}:${String(e.minute).padStart(2, "0")}`, end: `${String(e.endHour).padStart(2, "0")}:${String(e.endMinute).padStart(2, "0")}` })}
                  </span>
                  {e.hangoutLink && (
                    <a href={e.hangoutLink} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#0f766e", fontWeight: 600 }}>
                      {e.hangoutLink}
                    </a>
                  )}
                </div>
                <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 6 }}>
                  {e.attendees.map((a) => (
                    <li key={a.email} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, borderTop: "1px solid #f1f5f9", paddingTop: 6 }}>
                      <span>
                        {a.name} <span style={{ color: "#94a3b8" }}>&lt;{a.email}&gt;</span>
                      </span>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 12,
                          padding: "2px 10px",
                          borderRadius: 999,
                          background:
                            a.rsvp === "ACCEPTED" ? "#e5f6ef" : a.rsvp === "DECLINED" ? "#feecec" : a.rsvp === "TENTATIVE" ? "#fdf3df" : "#eef2f6",
                          color:
                            a.rsvp === "ACCEPTED" ? "#177a53" : a.rsvp === "DECLINED" ? "#b3423d" : a.rsvp === "TENTATIVE" ? "#9a6b13" : "#64748b",
                        }}
                      >
                        {a.rsvp === "ACCEPTED" ? "Yes" : a.rsvp === "DECLINED" ? "No" : a.rsvp === "TENTATIVE" ? "Maybe" : "Awaiting response"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </main>

      <EventDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        nativeMode
        slot={{ date: "", hour: 0, minute: 0 }}
        onCreate={() => {
          void load();
          setTimeout(() => void load(), 2500);
        }}
      />
    </div>
  );
}
