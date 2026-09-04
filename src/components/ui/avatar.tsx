"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

/** Deterministic avatar color from a name (same palette everywhere). */
export function avatarColor(name: string): string {
  return ["#667eea", "#0f766e", "#c06c84", "#4f7c8d", "#8b6fc0", "#d97757"][name.charCodeAt(0) % 6];
}

export function initialsOf(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

/** Round initials/photo avatar. Missing photo → colored initials. */
export function Avatar({ name, avatar, size = 32 }: { name: string; avatar?: string; size?: number }) {
  const color = avatarColor(name);
  return (
    <span
      style={{
        width: size, height: size, borderRadius: "50%", background: color, color: "#fff",
        display: "grid", placeItems: "center", fontSize: size * 0.38, fontWeight: 400,
        flex: "none", overflow: "hidden", border: "1px solid #e2e8f0",
      }}
    >
      {avatar ? <img src={avatar} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initialsOf(name)}
    </span>
  );
}

/** Overlapping avatar stack with a dark name tooltip on hover (portal-based). */
export function AvatarStack({ names, rowKey, max = 5, size = 32 }: { names: { name: string; avatar?: string }[] | string[]; rowKey: string; max?: number; size?: number }) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const items = names.map((n) => (typeof n === "string" ? { name: n } : n));
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      {items.slice(0, max).map((item, idx) => {
        const key = `${rowKey}-${item.name}-${idx}`;
        return (
          <span
            key={key}
            onMouseEnter={(e) => { setHoverRect((e.currentTarget as HTMLElement).getBoundingClientRect()); setHoverKey(key); }}
            onMouseLeave={() => { setHoverRect(null); setHoverKey(null); }}
            style={{ marginLeft: idx === 0 ? 0 : -8, position: "relative", cursor: "pointer" }}
            data-attendee={item.name}
          >
            <Avatar name={item.name} avatar={item.avatar} size={size} />
            {hoverKey === key && hoverRect && typeof document !== "undefined" && createPortal(
              <span style={{ position: "fixed", left: hoverRect.left + hoverRect.width / 2, top: hoverRect.top - 36, transform: "translateX(-50%)", background: "#0f172a", color: "#fff", padding: "6px 10px", borderRadius: 8, fontSize: 12, whiteSpace: "nowrap", zIndex: 9999, boxShadow: "0 4px 12px rgba(0,0,0,.2)", pointerEvents: "none" }}>
                {item.name}
              </span>, document.body)}
          </span>
        );
      })}
      {items.length > max && <span style={{ marginLeft: 4, fontSize: 12, color: "#64748b" }}>+{items.length - max}</span>}
    </span>
  );
}
