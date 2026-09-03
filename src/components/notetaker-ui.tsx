"use client";

const STATUS_STYLE: Record<string, { background: string; color: string }> = {
  CREATED: { background: "#f1f5f9", color: "#64748b" },
  JOINING: { background: "#e8f1fd", color: "#2f6fed" },
  RECORDING: { background: "#fdecec", color: "#d92d20" },
  TRANSCRIBED: { background: "#f1eafe", color: "#7a5af8" },
  PROCESSING: { background: "#fff7e6", color: "#b97f0f" },
  READY: { background: "#e9f6f6", color: "#178f84" },
  FAILED: { background: "#fdecec", color: "#d92d20" },
};

export function StatusChip({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.CREATED;
  return (
    <span
      className="inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-bold"
      style={status === "RECORDING" ? { ...style, animation: "ntk-pulse 1.6s infinite" } : style}
    >
      <style>{`@keyframes ntk-pulse{0%,100%{opacity:1}50%{opacity:.55}}`}</style>
      {status === "RECORDING" ? "● " : ""}{status}
    </span>
  );
}

/** "[00:21:14] …" or "00:21:14" → seconds. Null when unparseable. */
export function timestampToSeconds(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = value.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const parts = m[0].split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + parts[1];
}
