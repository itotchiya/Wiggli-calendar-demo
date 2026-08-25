/** Shared date formatting (client + server safe). */
export function formatEventRange(
  startIso: string | Date,
  endIso: string | Date,
  timezone: string,
  locale = "en-US"
): string {
  const start = new Date(startIso);
  const end = new Date(endIso);

  const dateFmt = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: timezone,
  });
  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
    timeZoneName: "short",
  });

  const sameDay =
    dateFmt.format(start) === dateFmt.format(end);

  return sameDay
    ? `${dateFmt.format(start)} · ${timeFmt.format(start)} – ${timeFmt.format(end)}`
    : `${dateFmt.format(start)} ${timeFmt.format(start)} → ${dateFmt.format(end)} ${timeFmt.format(end)}`;
}

export function guessLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
