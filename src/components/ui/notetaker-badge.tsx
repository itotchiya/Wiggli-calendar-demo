import { Mic } from "lucide-react";

/**
 * Small "AI" chip shown wherever a meeting has the Wiggli AI Notetaker enabled.
 * Render it on `<span>`-based surfaces only — global `button { color: inherit }`
 * would eat Tailwind text colors on buttons.
 */
export function NotetakerBadge({ label, title }: { label?: string; title?: string }) {
  return (
    <span
      title={title ?? "Wiggli AI Notetaker is enabled — the bot joins this meeting to record and take notes."}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: 999,
        background: "#e6faf0",
        border: "1px solid #b3f0d2",
        color: "#0a8a54",
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: "nowrap",
        lineHeight: 1.4,
        flex: "none",
      }}
    >
      <Mic size={11} strokeWidth={2.2} />
      {label ?? "AI"}
    </span>
  );
}
