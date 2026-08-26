"use client";

import { ExternalLink, X } from "lucide-react";
import { useState } from "react";

export type PreviewAttendeeStatus = "Pending" | "Accepted" | "Declined" | "Tentative";

export type PreviewAttendee = {
  name: string;
  role: string;
  avatar: string;
  status: PreviewAttendeeStatus;
  id?: string;
  type?: string;
};

function AttendeeAvatar({ name, avatar, size = 24 }: { name: string; avatar?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const showImg = !!avatar && !failed;
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
  const palette = ["#667eea", "#0f9b8e", "#c06c84", "#4f7c8d", "#8b6fc0", "#d97757", "#0f766e", "#6366f1"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const bg = palette[h % palette.length];
  if (showImg) return <img src={avatar} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flex: "none" }} onError={() => setFailed(true)} />;
  return <span style={{ width: size, height: size, borderRadius: "50%", background: bg, color: "#fff", display: "grid", placeItems: "center", fontSize: size * 0.42, fontWeight: 700, flex: "none" }}>{initials}</span>;
}

const statusClass: Record<PreviewAttendeeStatus, string> = {
  Pending: "att-status pending",
  Accepted: "att-status accepted",
  Declined: "att-status declined",
  Tentative: "att-status tentative",
};

function attendeeHref(attendee: PreviewAttendee): string | null {
  const ty = (attendee.type ?? "").toLowerCase();
  const slug = attendee.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  if (ty === "candidate" || ty === "freelancer") return `/candidates/${attendee.id || slug}`;
  if (ty === "contact") return `/contacts/${attendee.id || slug}`;
  const role = (attendee.role ?? "").toLowerCase();
  if (role.includes("candidate")) return `/candidates/${attendee.id || slug}`;
  if (role.includes("contact")) return `/contacts/${attendee.id || slug}`;
  return null;
}

export function AttendeePill({ attendee, onRemove }: { attendee: PreviewAttendee; onRemove?: () => void }) {
  const href = attendeeHref(attendee);
  return (
    <div
      className="linked-record-pill"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "#f7f9fb",
        borderRadius: 6,
        padding: "6px",
        minHeight: 36,
        border: "none",
      }}
    >
      <AttendeeAvatar name={attendee.name} avatar={attendee.avatar} />
      <strong style={{ fontSize: 13, color: "#334155", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{attendee.name}</strong>
      <span style={{ color: "#8a95a8", fontSize: 12, whiteSpace: "nowrap" }}>• {attendee.role}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto", flex: "none" }}>
        <button
          type="button"
          onClick={() => href && window.open(href, "_blank")}
          aria-label={`Open ${attendee.name}`}
          title="Open in new tab"
          className="linked-external-btn"
          style={{ width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: 6, background: "transparent", color: "#6b7a90", cursor: href ? "pointer" : "default" }}
        >
          <ExternalLink size={16} />
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${attendee.name}`}
            style={{ width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: 6, background: "transparent", color: "#94a3b8", cursor: "pointer" }}
          >
            <X size={15} />
          </button>
        )}
        <span className={statusClass[attendee.status]} style={{ marginLeft: 2, flex: "none" }}>{attendee.status}</span>
      </span>
    </div>
  );
}

export function AttendeeList({ attendees, onRemove }: { attendees: PreviewAttendee[]; onRemove?: (name: string) => void }) {
  if (!attendees || attendees.length === 0) return null;
  return (
    <div style={{ display: "grid", gap: 2 }}>
      {attendees.map((a) => (
        <AttendeePill key={a.name} attendee={a} onRemove={onRemove ? () => onRemove(a.name) : undefined} />
      ))}
    </div>
  );
}
