/**
 * Minimal, spec-focused iCalendar (RFC 5545) builder for EVENT invitations.
 * Hand-rolled so we control exactly what invitation-sensitive clients care
 * about: METHOD, UID, SEQUENCE, ORGANIZER, ATTENDEE;RSVP=TRUE, DTSTAMP.
 *
 * Times are emitted as UTC (trailing Z) so no VTIMEZONE block is required;
 * the human-facing timezone lives on the Google event and in the email body.
 */

export type IcsAttendee = { email: string; name?: string };

export type IcsInput = {
  uid: string; // MUST match the Google event's iCalUID so replies map back
  sequence: number;
  organizer: { email: string; name?: string };
  attendees: IcsAttendee[];
  title: string;
  description?: string;
  location?: string;
  startUtc: Date;
  endUtc: Date;
  url?: string;
  /** Minutes before start for the built-in reminder alarm; null = none. */
  reminderMinutes?: number | null;
};

/** RFC 5545 §3.3.11 TEXT escaping. */
function esc(v: string): string {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function utcStamp(d: Date): string {
  const p = (n: number, len = 2) => String(n).padStart(len, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T` +
    `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

/** RFC 5545 §3.1 — fold lines longer than 75 octets with CRLF + space.
 * Prefers breaking after ';' (parameter boundaries) so invitation-critical
 * params like RSVP=TRUE never split mid-token, even with very long CN values. */
function fold(line: string): string {
  const octets = Buffer.from(line, "utf8");
  if (octets.length <= 75) return line;
  const chunks: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < octets.length) {
    let take = Math.min(limit, octets.length - start);
    // never split a UTF-8 multi-byte sequence
    while (take > 0 && (octets[start + take] & 0xc0) === 0x80) {
      take--;
    }
    if (start + take < octets.length) {
      // prefer a break right after a ';' within the chunk (min 15 octets in)
      const seg = octets.subarray(start, start + take);
      const lastSemi = seg.lastIndexOf(0x3b);
      if (lastSemi >= 15) take = lastSemi + 1;
    }
    chunks.push(octets.subarray(start, start + take).toString("utf8"));
    start += take;
    limit = 74; // continuation lines carry a leading space
  }
  return chunks.join("\r\n ");
}

function attendeeLine(a: IcsAttendee): string {
  // Minimal param set keeps the pre-CN block short; CN goes last.
  const params = [
    "ROLE=REQ-PARTICIPANT",
    "PARTSTAT=NEEDS-ACTION",
    "RSVP=TRUE",
    a.name ? `CN=${esc(a.name)}` : null,
  ]
    .filter(Boolean)
    .join(";");
  return fold(`ATTENDEE;${params}:mailto:${a.email.toLowerCase()}`);
}

export function buildRequestIcs(input: IcsInput): string {
  const now = new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wiggli//Calendar Invite Demo//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    fold(`UID:${input.uid}`),
    `SEQUENCE:${input.sequence}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(input.startUtc)}`,
    `DTEND:${utcStamp(input.endUtc)}`,
    fold(`SUMMARY:${esc(input.title)}`),
    `STATUS:CONFIRMED`,
    `TRANSP:OPAQUE`,
    fold(
      `ORGANIZER;CN=${esc(input.organizer.name ?? input.organizer.email)}:mailto:${input.organizer.email.toLowerCase()}`
    ),
    ...input.attendees.map(attendeeLine),
  ];

  if (input.description) lines.push(fold(`DESCRIPTION:${esc(input.description)}`));
  if (input.location) lines.push(fold(`LOCATION:${esc(input.location)}`));
  if (input.url) lines.push(fold(`URL:${input.url}`));

  // Built-in reminder so the invite carries its own alarm in every client.
  if (input.reminderMinutes != null && input.reminderMinutes >= 0) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      fold(`DESCRIPTION:${esc(input.title)} — starts in ${input.reminderMinutes} min`),
      `TRIGGER:-PT${Math.round(input.reminderMinutes)}M`,
      "END:VALARM"
    );
  }
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n") + "\r\n";
}
