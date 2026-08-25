/**
 * Wall-clock ↔ instant conversions for a given IANA timezone.
 * The form collects naive local datetimes ("2026-09-15T14:00") plus a zone;
 * these helpers resolve them to real UTC instants for storage and ICS output.
 */

const WALL_CLOCK_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

/** Offset (ms) of `timeZone` at the given instant. */
function tzOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - instant.getTime();
}

/** Interpret a wall-clock datetime in `timeZone` and return the UTC instant. */
export function zonedWallClockToUtc(wallClock: string, timeZone: string): Date {
  const m = WALL_CLOCK_RE.exec(wallClock.trim());
  if (!m) {
    throw new Error(`Invalid datetime "${wallClock}" (expected YYYY-MM-DDTHH:mm)`);
  }
  const [, y, mo, d, h, mi, s] = m;
  const naiveAsUtc = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s ?? 0)
  );
  const guess = new Date(naiveAsUtc);
  let offset = tzOffsetMs(guess, timeZone);
  // DST edge refinement: re-check offset at the corrected instant.
  const corrected = new Date(naiveAsUtc - offset);
  offset = tzOffsetMs(corrected, timeZone);
  return new Date(naiveAsUtc - offset);
}
