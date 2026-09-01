/**
 * Minimal, spec-focused iCalendar (RFC 5545) builder for EVENT invitations.
 * Hand-rolled so we control exactly what invitation-sensitive clients care
 * about: METHOD, UID, SEQUENCE, ORGANIZER, ATTENDEE;RSVP=TRUE, DTSTAMP.
 *
 * Times are emitted as UTC (trailing Z) so no VTIMEZONE block is required;
 * the human-facing timezone lives on the Google event and in the email body.
 */

export type IcsAttendee = {
  email: string;
  name?: string;
  /** Defaults to NEEDS-ACTION. The human organizer is explicitly ACCEPTED. */
  partstat?: "NEEDS-ACTION" | "ACCEPTED" | "TENTATIVE" | "DECLINED";
  /** Defaults to true only for NEEDS-ACTION invitees. */
  rsvp?: boolean;
  /** Existing Gmail invites retain this extension; Resend's minimal form omits it. */
  includeGuestCount?: boolean;
};

export type IcsInput = {
  prodId?: string;
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

/** RFC 5545 quoted parameter value: separators are legal inside quotes. */
function param(v: string): string {
  return v.replace(/[\r\n]+/g, " ").replace(/"/g, "'");
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
  const partstat = a.partstat ?? "NEEDS-ACTION";
  const rsvp = a.rsvp ?? partstat === "NEEDS-ACTION";
  // Minimal param set keeps the pre-CN block short; CN goes last.
  const params = [
    "CUTYPE=INDIVIDUAL",
    "ROLE=REQ-PARTICIPANT",
    `PARTSTAT=${partstat}`,
    rsvp ? "RSVP=TRUE" : null,
    a.includeGuestCount === false ? null : "X-NUM-GUESTS=0",
    a.name ? `CN="${param(a.name)}"` : null,
  ]
    .filter(Boolean)
    .join(";");
  return fold(`ATTENDEE;${params}:mailto:${a.email.toLowerCase()}`);
}

function veventLines(input: IcsInput, now: Date): string[] {
  const lines: string[] = [
    "BEGIN:VEVENT",
    fold(`UID:${input.uid}`),
    `SEQUENCE:${input.sequence}`,
    `DTSTAMP:${utcStamp(now)}`,
    `CREATED:${utcStamp(now)}`,
    `LAST-MODIFIED:${utcStamp(now)}`,
    `DTSTART:${utcStamp(input.startUtc)}`,
    `DTEND:${utcStamp(input.endUtc)}`,
    fold(`SUMMARY:${esc(input.title)}`),
    `STATUS:CONFIRMED`,
    `TRANSP:OPAQUE`,
    `CLASS:PUBLIC`,
    `PRIORITY:5`,
    // Outlook-specific busy hints supplement (never replace) RFC 5545 fields.
    `X-MICROSOFT-CDO-BUSYSTATUS:BUSY`,
    `X-MICROSOFT-CDO-INTENDEDSTATUS:BUSY`,
    fold(
      `ORGANIZER;CN="${param(input.organizer.name ?? input.organizer.email)}":mailto:${input.organizer.email.toLowerCase()}`
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
  lines.push("END:VEVENT");
  return lines;
}

export function buildRequestIcs(input: IcsInput): string {
  const now = new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${input.prodId ?? "-//Wiggli//Calendar Invite Demo//EN"}`,
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    ...veventLines(input, now),
    "END:VCALENDAR",
  ];

  return lines.join("\r\n") + "\r\n";
}

/**
 * METHOD:CANCEL — RFC 5546 §3.2.5. Sent to attendees REMOVED from an event so
 * their calendar copies are removed. Same UID + bumped SEQUENCE as the last
 * REQUEST; STATUS:CANCELLED tells clients to strike the event, not add it.
 */
export function buildCancelIcs(input: IcsInput): string {
  const now = new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${input.prodId ?? "-//Wiggli//Calendar Invite Demo//EN"}`,
    "CALSCALE:GREGORIAN",
    "METHOD:CANCEL",
    ...veventLines(input, now).map((line) =>
      line === "STATUS:CONFIRMED" ? "STATUS:CANCELLED" : line
    ),
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

export function buildMultiRequestIcs(inputs: IcsInput[]): string {
  if (inputs.length === 0) throw new Error("At least one ICS input is required");
  if (inputs.length === 1) return buildRequestIcs(inputs[0]!);
  const now = new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${inputs[0]!.prodId ?? "-//Wiggli//Calendar Invite Demo//EN"}`,
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    ...inputs.flatMap((input) => veventLines(input, now)),
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
