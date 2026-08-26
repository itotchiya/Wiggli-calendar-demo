export const ICAL_REPLY_STATUSES = [
  "ACCEPTED",
  "TENTATIVE",
  "DECLINED",
] as const;

export type IcalReplyStatus = (typeof ICAL_REPLY_STATUSES)[number];

export type IcalReply = {
  uid: string;
  organizerEmail: string;
  attendeeEmail: string;
  status: IcalReplyStatus;
  sequence?: number;
};

export class IcalReplyParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IcalReplyParseError";
  }
}

type ContentLine = {
  name: string;
  params: Map<string, string>;
  value: string;
};

function splitOutsideQuotes(value: string, delimiter: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '"' && value[index - 1] !== "\\") {
      quoted = !quoted;
    } else if (value[index] === delimiter && !quoted) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(value.slice(start));
  return parts;
}

function parseContentLine(line: string): ContentLine | null {
  let separator = -1;
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"' && line[index - 1] !== "\\") {
      quoted = !quoted;
    } else if (line[index] === ":" && !quoted) {
      separator = index;
      break;
    }
  }

  if (separator < 0) return null;

  const [rawName, ...rawParams] = splitOutsideQuotes(
    line.slice(0, separator),
    ";"
  );
  const name = rawName.trim().toUpperCase();
  if (!name) return null;

  const params = new Map<string, string>();
  for (const rawParam of rawParams) {
    const equals = rawParam.indexOf("=");
    if (equals < 0) continue;

    const paramName = rawParam.slice(0, equals).trim().toUpperCase();
    let paramValue = rawParam.slice(equals + 1).trim();
    if (paramValue.startsWith('"') && paramValue.endsWith('"')) {
      paramValue = paramValue.slice(1, -1);
    }
    if (paramName) params.set(paramName, paramValue);
  }

  return { name, params, value: line.slice(separator + 1) };
}

function unfoldContentLines(ics: string): string[] {
  const physicalLines = ics
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");
  const lines: string[] = [];

  for (const line of physicalLines) {
    if (/^[ \t]/.test(line) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }

  return lines;
}

function parseEmail(value: string, propertyName: string): string {
  const email = value.trim().replace(/^mailto:/i, "").trim();
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
    throw new IcalReplyParseError(
      `${propertyName} must contain a valid email address.`
    );
  }
  return email.toLowerCase();
}

export function parseIcalReply(ics: string): IcalReply {
  if (typeof ics !== "string" || !ics.trim()) {
    throw new IcalReplyParseError("iCalendar content is required.");
  }

  const properties = unfoldContentLines(ics)
    .map(parseContentLine)
    .filter((property): property is ContentLine => property !== null);

  const method = properties.find((property) => property.name === "METHOD");
  if (method?.value.trim().toUpperCase() !== "REPLY") {
    throw new IcalReplyParseError("iCalendar METHOD must be REPLY.");
  }

  const uid = properties.find((property) => property.name === "UID")?.value.trim();
  if (!uid) {
    throw new IcalReplyParseError("iCalendar reply is missing UID.");
  }

  const organizer = properties.find(
    (property) => property.name === "ORGANIZER"
  );
  if (!organizer) {
    throw new IcalReplyParseError("iCalendar reply is missing ORGANIZER.");
  }

  const attendee = properties.find(
    (property) => property.name === "ATTENDEE"
  );
  if (!attendee) {
    throw new IcalReplyParseError("iCalendar reply is missing ATTENDEE.");
  }

  const rawStatus = attendee.params.get("PARTSTAT")?.trim().toUpperCase();
  if (!rawStatus) {
    throw new IcalReplyParseError(
      "iCalendar ATTENDEE is missing PARTSTAT."
    );
  }
  if (!ICAL_REPLY_STATUSES.includes(rawStatus as IcalReplyStatus)) {
    throw new IcalReplyParseError(
      `Unsupported iCalendar PARTSTAT: ${rawStatus}.`
    );
  }

  const rawSequence = properties.find((property) => property.name === "SEQUENCE")?.value.trim();
  const sequence = rawSequence === undefined ? undefined : Number(rawSequence);
  if (sequence !== undefined && (!Number.isInteger(sequence) || sequence < 0)) {
    throw new IcalReplyParseError("iCalendar SEQUENCE must be a non-negative integer.");
  }

  return {
    uid,
    organizerEmail: parseEmail(organizer.value, "ORGANIZER"),
    attendeeEmail: parseEmail(attendee.value, "ATTENDEE"),
    status: rawStatus as IcalReplyStatus,
    ...(sequence !== undefined ? { sequence } : {}),
  };
}
