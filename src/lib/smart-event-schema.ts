export type SmartAudience = "candidate" | "contact" | "internal";
export type SmartAttendeeType = SmartAudience | "freelancer";
export type SmartLinkedType = "Candidate" | "Contact" | "Job" | "Opportunity" | "Organization";

export type SmartLinkedRecord = {
  type: SmartLinkedType;
  id: string;
  label: string;
  variable: string;
};

export type SmartEventSlot = {
  date: string;
  startTime: string;
  endTime: string;
};

export type SmartEventDocument = {
  schemaVersion: 1;
  event: {
    title: string;
    type: { id?: string; name: string; context: string };
    description?: string;
    date: string;
    startTime: string;
    endTime: string;
    slots: SmartEventSlot[];
    timezone: string;
    location: {
      type: "none" | "online" | "company" | "custom";
      label: string;
      provider?: string;
      value?: string | null;
      generatedOnCreate?: boolean;
    };
    reminderMinutes?: number | null;
  };
  organizer: {
    fullName: string;
    email: string;
    phone?: string;
  };
  linkedTo: SmartLinkedRecord[];
  attendees: {
    id: string;
    type: SmartAttendeeType;
    fullName: string;
    email: string;
  }[];
  audiences: {
    type: SmartAudience;
    allowedContextVariables: string[];
  }[];
};

export const LINKED_VARIABLE_BY_TYPE: Record<SmartLinkedType, string> = {
  Candidate: "[Linked.Candidate]",
  Contact: "[Linked.Contact]",
  Job: "[Linked.Job]",
  Opportunity: "[Linked.Opportunity]",
  Organization: "[Linked.Organization]",
};

export function eventTitleForSlot(title: string, slotIndex: number, slotCount: number): string {
  return slotCount > 1 ? `${title} (Slot ${slotIndex + 1})` : title;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const AUDIENCES: SmartAudience[] = ["candidate", "contact", "internal"];
const LINKED_TYPES: SmartLinkedType[] = ["Candidate", "Contact", "Job", "Opportunity", "Organization"];

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isAudience(value: unknown): value is SmartAudience {
  return typeof value === "string" && AUDIENCES.includes(value as SmartAudience);
}

function isLinkedType(value: unknown): value is SmartLinkedType {
  return typeof value === "string" && LINKED_TYPES.includes(value as SmartLinkedType);
}

function parseEventSlots(eventRaw: Record<string, unknown>, fallback: SmartEventSlot): SmartEventSlot[] {
  const rawSlots = Array.isArray(eventRaw.slots) ? eventRaw.slots : [fallback];
  const seen = new Set<string>();
  const slots = rawSlots.map((value) => {
    if (!value || typeof value !== "object") throw new Error("Invalid Smart Event slot.");
    const raw = value as Record<string, unknown>;
    const date = requiredString(raw.date, "Event slot date");
    const startTime = requiredString(raw.startTime, "Event slot start time");
    const endTime = requiredString(raw.endTime, "Event slot end time");
    if (!DATE_RE.test(date) || !TIME_RE.test(startTime) || !TIME_RE.test(endTime) || endTime <= startTime) {
      throw new Error("Invalid Smart Event slot date/time format.");
    }
    const key = `${date}T${startTime}-${endTime}`;
    if (seen.has(key)) throw new Error("Smart Event slots must be unique.");
    seen.add(key);
    return { date, startTime, endTime };
  });

  return slots.sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
}

export function audienceForAttendeeType(type: SmartAttendeeType): SmartAudience {
  return type === "freelancer" ? "candidate" : type;
}

export function allowedLinkedRecordsForAudience(
  audience: SmartAudience,
  linkedTo: SmartLinkedRecord[]
): SmartLinkedRecord[] {
  return linkedTo.filter((record) => {
    if (audience === "candidate" && record.type === "Candidate") return false;
    if (audience === "contact" && record.type === "Contact") return false;
    return true;
  });
}

export function buildSmartAudiences(
  attendees: SmartEventDocument["attendees"],
  linkedTo: SmartLinkedRecord[]
): SmartEventDocument["audiences"] {
  const present = new Set(attendees.map((attendee) => audienceForAttendeeType(attendee.type)));
  return AUDIENCES.filter((audience) => present.has(audience)).map((type) => ({
    type,
    allowedContextVariables: allowedLinkedRecordsForAudience(type, linkedTo).map((record) => record.variable),
  }));
}

/** Server boundary validation for the canonical Step 1 JSON document. */
export function parseSmartEventDocument(value: unknown): SmartEventDocument {
  if (!value || typeof value !== "object") throw new Error("Smart Event document is required.");
  const root = value as Record<string, unknown>;
  const eventRaw = root.event as Record<string, unknown> | undefined;
  const organizerRaw = root.organizer as Record<string, unknown> | undefined;
  if (!eventRaw || !organizerRaw) throw new Error("Smart Event event and organizer are required.");

  const typeRaw = eventRaw.type as Record<string, unknown> | undefined;
  const locationRaw = eventRaw.location as Record<string, unknown> | undefined;
  if (!typeRaw || !locationRaw) throw new Error("Smart Event type and location are required.");

  const date = requiredString(eventRaw.date, "Event date");
  const startTime = requiredString(eventRaw.startTime, "Event start time");
  const endTime = requiredString(eventRaw.endTime, "Event end time");
  if (!DATE_RE.test(date) || !TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
    throw new Error("Invalid Smart Event date/time format.");
  }
  const slots = parseEventSlots(eventRaw, { date, startTime, endTime });

  const locationType = locationRaw.type;
  if (!["none", "online", "company", "custom"].includes(String(locationType))) {
    throw new Error("Invalid Smart Event location type.");
  }

  const organizerEmail = requiredString(organizerRaw.email, "Organizer email").toLowerCase();
  if (!EMAIL_RE.test(organizerEmail)) throw new Error("Invalid organizer email.");

  const linkedTo: SmartLinkedRecord[] = (Array.isArray(root.linkedTo) ? root.linkedTo : []).map((item) => {
    const record = item as Record<string, unknown>;
    if (!isLinkedType(record.type)) throw new Error("Invalid linked record type.");
    const expectedVariable = LINKED_VARIABLE_BY_TYPE[record.type];
    return {
      type: record.type,
      id: requiredString(record.id, "Linked record id"),
      label: requiredString(record.label, "Linked record label"),
      variable: expectedVariable,
    };
  });

  const attendees = (Array.isArray(root.attendees) ? root.attendees : []).map((item) => {
    const attendee = item as Record<string, unknown>;
    const type = attendee.type;
    if (!["candidate", "freelancer", "contact", "internal"].includes(String(type))) {
      throw new Error("Invalid attendee type.");
    }
    const email = requiredString(attendee.email, "Attendee email").toLowerCase();
    if (!EMAIL_RE.test(email)) throw new Error(`Invalid attendee email: ${email}`);
    return {
      id: requiredString(attendee.id, "Attendee id"),
      type: type as SmartAttendeeType,
      fullName: requiredString(attendee.fullName, "Attendee name"),
      email,
    };
  });
  if (attendees.length === 0) throw new Error("At least one Smart Event attendee is required.");

  const audiences = buildSmartAudiences(attendees, linkedTo);
  const suppliedAudiences = Array.isArray(root.audiences) ? root.audiences : [];
  for (const supplied of suppliedAudiences) {
    const audience = supplied as Record<string, unknown>;
    if (!isAudience(audience.type)) throw new Error("Invalid Smart Event audience.");
  }

  return {
    schemaVersion: 1,
    event: {
      title: requiredString(eventRaw.title, "Event title"),
      type: {
        id: optionalString(typeRaw.id),
        name: requiredString(typeRaw.name, "Event type name"),
        context: requiredString(typeRaw.context, "Event type context"),
      },
      description: optionalString(eventRaw.description),
      date,
      startTime,
      endTime,
      slots,
      timezone: requiredString(eventRaw.timezone, "Event timezone"),
      location: {
        type: locationType as SmartEventDocument["event"]["location"]["type"],
        label: requiredString(locationRaw.label, "Location label"),
        provider: optionalString(locationRaw.provider),
        value: optionalString(locationRaw.value) ?? null,
        generatedOnCreate: Boolean(locationRaw.generatedOnCreate),
      },
      reminderMinutes:
        eventRaw.reminderMinutes == null
          ? null
          : Math.max(0, Number(eventRaw.reminderMinutes) || 0),
    },
    organizer: {
      fullName: requiredString(organizerRaw.fullName, "Organizer name"),
      email: organizerEmail,
      phone: optionalString(organizerRaw.phone),
    },
    linkedTo,
    attendees,
    audiences,
  };
}
