import type { CSSProperties } from "react";

const STATUS_STYLES: Record<string, CSSProperties> = {
  Draft: { border: "1px solid #94a3b8", color: "#475569", background: "#fff" },
  Scheduled: { border: "1px solid #2563eb", color: "#2563eb", background: "#fff" },
  Overdue: { border: "1px solid #dc2626", color: "#dc2626", background: "#fff" },
  Completed: { border: "1px solid #15803d", color: "#15803d", background: "#fff" },
  Canceled: { border: "1px solid #dc2626", color: "#dc2626", background: "#fff" },
};

/** Outline status pill (white bg, colored text + matching border). */
export function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.Draft;
  return (
    <span style={{ ...style, padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", display: "inline-flex" }}>
      {status}
    </span>
  );
}
