import { db } from "./prisma";
import { getGoogleClient, createGoogleEvent } from "./google/calendar";
import { sendInviteEmail } from "./google/gmail";
import { buildRequestIcs } from "./ics";
import { buildDefaultInviteHtml, buildDefaultInviteText, buildCleanEmailHtml } from "./email-template";
import { eventTitleForSlot } from "./smart-event-schema";
import { zonedWallClockToUtc } from "./datetime";
import { formatEventRange } from "./format";
import { stripUnknownTokens } from "./invite-variables";
import { buildSmartSlotNoticeText, emailHtmlToPlainText, sanitizeReviewedEmailHtml, withStyledSlotNotice } from "./smart-email-template";
import { buildResendMessageId, sendResendCalendarEmail } from "./resend/calendar-email";
import type { SmartEventDocument } from "./smart-event-schema";
import type { CreateEventInput, EventDto, AttendeeDto, EventPreviewData } from "@/types/event";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validate + normalize the create-event payload (dependency-free). */
export function parseCreateInput(body: unknown): CreateEventInput {
  if (!body || typeof body !== "object") throw new Error("Invalid JSON body");
  const b = body as Record<string, unknown>;

  const summary = String(b.summary ?? "").trim();
  if (!summary) throw new Error("Event title is required");

  const start = String(b.start ?? "");
  const end = String(b.end ?? "");
  const timezone = String(b.timezone ?? "").trim();

  const rawAttendees = Array.isArray(b.attendees) ? b.attendees : [];
  const seen = new Set<string>();
  const attendees: { email: string; name?: string; type?: string }[] = [];
  for (const a of rawAttendees) {
    const email = String((a as { email?: unknown })?.email ?? "")
      .trim()
      .toLowerCase();
    if (!EMAIL_RE.test(email)) throw new Error(`Invalid attendee email: "${email}"`);
    if (seen.has(email)) continue;
    seen.add(email);
    const name = String((a as { name?: unknown })?.name ?? "").trim();
    // Drawer attendee type (candidate/contact/internal/...) — selects the
    // invitation template this person receives.
    const type = String((a as { type?: unknown })?.type ?? "").trim();
    attendees.push({
      email,
      ...(name ? { name } : {}),
      ...(type ? { type } : {}),
    });
  }
  if (attendees.length === 0) throw new Error("At least one attendee is required");

  return {
    summary,
    description: typeof b.description === "string" ? b.description : undefined,
    location: typeof b.location === "string" ? b.location.trim() || undefined : undefined,
    start,
    end,
    timezone,
    attendees,
    emailSubject: typeof b.emailSubject === "string" ? b.emailSubject : undefined,
    emailHtml: typeof b.emailHtml === "string" ? b.emailHtml.trim() || undefined : undefined,
  };
}

type EventRow = {
  id: string;
  googleEventId: string | null;
  source: string;
  iCalUID: string;
  summary: string;
  eventType: string | null;
  description: string | null;
  location: string | null;
  hangoutLink: string | null;
  reminderMinutes: number | null;
  previewData: unknown;
  start: Date;
  end: Date;
  timezone: string;
  organizerEmail: string;
  sequence: number;
  status: string | null;
  createdAt: Date;
  attendees: {
    id: string;
    email: string;
    name: string | null;
    type: string | null;
    rsvp: string;
    comment: string | null;
    respondedAt: Date | null;
  }[];
};

function asPreviewData(value: unknown): EventPreviewData | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as EventPreviewData : null;
}

export type InviteThreadState = {
  threadId?: string;
  rootMessageId: string;
  subject: string;
  /** All RFC Message-IDs sent so far in this thread, for the References chain. */
  references: string[];
};

function toDto(e: EventRow): EventDto {
  return {
    id: e.id,
    googleEventId: e.googleEventId,
    source: e.source === "GOOGLE" ? "GOOGLE" : "WIGGLI",
    iCalUID: e.iCalUID,
    summary: e.summary,
    eventType: e.eventType,
    description: e.description,
    location: e.location,
    hangoutLink: e.hangoutLink,
    reminderMinutes: e.reminderMinutes,
    start: e.start.toISOString(),
    end: e.end.toISOString(),
    timezone: e.timezone,
    organizerEmail: e.organizerEmail,
    previewData: asPreviewData(e.previewData),
    status: (e as { status?: string }).status === "CANCELLED" ? "CANCELLED" : "SCHEDULED",
    createdAt: e.createdAt.toISOString(),
    proposals: ((e as { proposals?: { id: string; attendeeEmail: string; slotLabel: string; note: string | null; status: string; createdAt: Date }[] }).proposals ?? []).map((p) => ({
      id: p.id,
      attendeeEmail: p.attendeeEmail,
      slotLabel: p.slotLabel,
      note: p.note,
      status: (p.status === "ACCEPTED" || p.status === "DISMISSED" ? p.status : "PENDING") as "PENDING" | "ACCEPTED" | "DISMISSED",
      createdAt: p.createdAt.toISOString(),
    })),
    attendees: e.attendees.map<AttendeeDto>((a) => ({
      id: a.id,
      email: a.email,
      name: a.name,
      type: a.type,
      rsvp: a.rsvp as AttendeeDto["rsvp"],
      respondedAt: a.respondedAt ? a.respondedAt.toISOString() : null,
      comment: a.comment,
    })),
  };
}

export async function listEvents(): Promise<EventDto[]> {
  const rows = await db.event.findMany({
    include: { attendees: true, proposals: { orderBy: { createdAt: "desc" } } },
    orderBy: { start: "asc" },
  });
  return rows.map(toDto);
}

/** Pending counter-proposals for one event (for the preview dialog). */
export async function listEventProposals(eventId: string) {
  return db.eventProposal.findMany({
    where: { eventId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * The heart of the demo:
 * 1. resolve wall-clock times → UTC instants
 * 2. insert the Google Calendar event — always SILENT (sendUpdates:"none");
 *    (Google emails the native Yes/No/Maybe card); other flows use "none"
 * 3. persist event + attendees (sharing Google's iCalUID)
 * 4. build METHOD:REQUEST .ics around that UID
 * 5. email each attendee their own branded invite (personal RSVP links)
 */
export async function createEventAndInvite(opts: {
  accessToken: string;
  refreshToken?: string | null;
  organizerEmail: string;
  input: CreateEventInput;
  /** Provision a real Google Meet conference for this event. */
  conference?: boolean;
  /** Reminder minutes before start; null/undefined = calendar default. */
  reminderMinutes?: number | null;
  /** Drawer event type (used in variable resolution). */
  eventType?: string;
  organizationName?: string | null;
  linkedTitle?: string | null;
  /** Linked-to record values for the [Linked.*] variables. */
  linked?: {
    candidate?: string | null;
    contact?: string | null;
    job?: string | null;
    opportunity?: string | null;
    organization?: string | null;
  };
  /** Canonical Step 1 source used by AI, email, calendar, and ICS. */
  smartDocument?: SmartEventDocument;
  /** Per-attendee-type AI/user templates from the drawer's step 2. */
  inviteMessages?: {
    tab: "candidate" | "contact" | "internal";
    subject?: string;
    body?: string;
    /** Styled HTML from the rich editor (chips already converted to [Tokens]). */
    bodyHtml?: string;
  }[];
  /** Shared per-recipient state used to group multi-slot emails in one Gmail thread. */
  emailThreads?: Map<string, InviteThreadState>;
  /** Pre-provisioned Google Meet link (created instantly in the drawer). */
  meetLink?: string | null;
}): Promise<EventDto> {
  const { accessToken, refreshToken, organizerEmail, input } = opts;

  const startUtc = zonedWallClockToUtc(input.start, input.timezone);
  const endUtc = zonedWallClockToUtc(input.end, input.timezone);
  const smartSlots = opts.smartDocument?.event.slots ?? [{
    date: input.start.slice(0, 10),
    startTime: input.start.slice(11, 16),
    endTime: input.end.slice(11, 16),
  }];
  const activeSlotIndex = Math.max(
    0,
    smartSlots.findIndex(
      (slot) => slot.date === input.start.slice(0, 10) && slot.startTime === input.start.slice(11, 16) && slot.endTime === input.end.slice(11, 16)
    )
  );
  if (endUtc <= startUtc) throw new Error("End must be after start");
  if (endUtc.getTime() - startUtc.getTime() < 15 * 60_000) {
    throw new Error("Meetings must be at least 15 minutes long.");
  }
  // Small grace window so a slot chosen moments ago doesn't fail on submit lag.
  if (startUtc.getTime() < Date.now() - 60_000) {
    throw new Error("Start time must be in the future.");
  }

  // 2. Google Calendar — created SILENT (sendUpdates:"none"): Google must NOT
  //    email its own native invitation. The single invitation is the branded
  //    Smart Event email below (its METHOD:REQUEST ICS gives Gmail the native
  //    Yes/No/Maybe card). Sending "all" here duplicated every invite
  //    (one Google-native + one Smart email). The Native creator mode is the
  //    explicit choice for Google-only invitations (/api/native-events).
  const g = await createGoogleEvent(accessToken, {
    summary: input.summary,
    // Calendar description stays clean: the availability-options notice
    // belongs in the invitation EMAIL only, not on the calendar event.
    description: input.description?.trim() || undefined,
    // When a Meet room is requested, let GOOGLE provision it — don't pre-fill
    // location with a separately-created link (that produced two different
    // links: one in Location, one in Google's conference slot).
    location: input.location,
    startIso: startUtc.toISOString(), // full RFC 3339 — Google rejects bare "HH:mm"
    endIso: endUtc.toISOString(),
    timezone: input.timezone,
    attendees: input.attendees.map((a) => ({ email: a.email, name: a.name })),
    conference: opts.conference,
    reminderMinutes: opts.reminderMinutes ?? null,
    sendUpdates: "none",
  });

  // Single authoritative Meet link — the one Google provisioned on create.
  const hangoutLink = g.hangoutLink;
  const organizerName = opts.smartDocument?.organizer.fullName || organizerEmail.split("@")[0];
  const smartLocation = opts.smartDocument?.event.location;
  const previewData = {
    organizerName,
    ...(opts.smartDocument?.organizer.avatar ? { organizerAvatar: opts.smartDocument.organizer.avatar } : {}),
    attendeeAvatars: Object.fromEntries(
      (opts.smartDocument?.attendees ?? []).filter((attendee) => attendee.avatar).map((attendee) => [attendee.email.toLowerCase(), attendee.avatar!])
    ),
    linkedTo: (opts.smartDocument?.linkedTo ?? []).map((record) => ({ type: record.type, label: record.label, ...(record.avatar ? { avatar: record.avatar } : {}) })),
    locations: smartLocation && smartLocation.type !== "none" && smartLocation.type !== "online" && smartLocation.value
      ? [{ label: smartLocation.value, type: smartLocation.type === "company" ? "Company office" : "Another location" }]
      : [],
    meetingLinks: hangoutLink
      ? [{ provider: "Google Meet", url: hangoutLink }]
      : smartLocation?.type === "online" && smartLocation.value
        ? [{ provider: smartLocation.provider || "Meeting", url: smartLocation.value }]
        : [],
  };

  // 3. Local persistence
  const event = await db.event.create({
    data: {
      googleEventId: g.id,
      iCalUID: g.iCalUID,
      summary: input.summary,
      eventType: opts.eventType ?? null,
      description: input.description ?? null,
      location: hangoutLink ?? input.location ?? null,
      hangoutLink,
      reminderMinutes: opts.reminderMinutes ?? null,
      previewData,
      start: startUtc,
      end: endUtc,
      timezone: input.timezone,
      emailSubject: input.emailSubject ?? null,
      emailHtml: input.emailHtml ?? null,
      organizerEmail,
      sequence: 0,
      attendees: {
        create: input.attendees.map((a) => ({ email: a.email, name: a.name, type: (a as { type?: string }).type ?? null })),
      },
    },
    include: { attendees: true },
  });

  // Keep the organizer's refresh token so RSVP clicks can sync later, offline.
  if (refreshToken) {
    await db.organizerAccount.upsert({
      where: { email: organizerEmail },
      update: { refreshToken },
      create: { email: organizerEmail, refreshToken },
    });
  }

  const authClient = getGoogleClient(accessToken);

  // 4+5. one personalized invite per attendee
  const subject = input.emailSubject?.trim() || `Invitation: ${input.summary}`;
  const eventTitle = opts.smartDocument?.event.title ?? input.summary;
  const typeByEmail = new Map(
    input.attendees.map((a) => [a.email, (a as { type?: string }).type ?? ""])
  );
  const attendeeList = event.attendees.map((a) => ({
    name: a.name ?? a.email,
    email: a.email,
    role: a.email === organizerEmail ? "Organizer" : "Attendee",
    type: typeByEmail.get(a.email) ?? "",
  }));
  const reminderLabel =
    opts.reminderMinutes != null
      ? `${opts.reminderMinutes} minutes before`
      : null;
  const organizerPhone = opts.smartDocument?.organizer.phone ?? "";

  const whenLabel = formatEventRange(startUtc, endUtc, input.timezone);
  const locationType = opts.smartDocument?.event.location.type;
  const meetingLink = hangoutLink ?? (locationType === "online" ? opts.smartDocument?.event.location.value : null);
  const whereValue = meetingLink ?? opts.smartDocument?.event.location.value ?? input.location ?? "—";
  const whereLabel =
    locationType === "online"
      ? `Online - ${whereValue}`
      : locationType === "company"
        ? `Company address - ${whereValue}`
        : locationType === "custom"
          ? `Other location - ${whereValue}`
          : whereValue;
  const bullets = (names: string[]) =>
    names.length ? names.map((n) => `• ${n}`).join("\n") : "";
  const groupNames = (predicate: (t: string) => boolean) =>
    attendeeList.filter((a) => predicate(a.type)).map((a) => a.name);
  const candidatesNames = groupNames((t) => t === "candidate");
  const contactsNames = groupNames((t) => t === "contact");
  const internalsNames = groupNames((t) => t === "internal");

  /**
   * The event facts that USED to be an HTML block in the email now live in the
   * iCalendar DESCRIPTION — so every calendar app (Gmail/Outlook/Apple) shows
   * them in its native event UI, and the email stays a clean personal message.
   */
  const icsDescription = [
    input.description?.trim() || null,
    [
      `Event: ${input.summary}`,
      `Type: ${opts.eventType ?? "—"}`,
      `When: ${whenLabel} (${input.timezone})`,
      `Where: ${whereLabel}`,
      `Organizer: ${organizerName} (${organizerEmail})`,
      `Guests:\n${attendeeList.map((a) => `  - ${a.name} (${a.email})`).join("\n")}`,
      reminderLabel ? `Reminder: ${reminderLabel}.` : null,
      "Please respond with Yes / Maybe / No from your calendar app — your answer syncs to the organizer automatically.",
    ]
      .filter(Boolean)
      .join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");

  /** Drawer-provided AI/user templates keyed by attendee type (candidate/contact/internal). */
  const templatesByTab = new Map<string, { subject?: string; body?: string; bodyHtml?: string }>();
  for (const m of opts.inviteMessages ?? []) {
    if (m?.tab && (m.bodyHtml || m.body)) {
      templatesByTab.set(m.tab, { subject: m.subject, bodyHtml: m.bodyHtml, body: m.body });
    }
  }
  const tabForType = (type?: string): "candidate" | "contact" | "internal" =>
    type === "contact" ? "contact" : type === "internal" ? "internal" : "candidate";

  /** Resolve [Variables] for a specific recipient.
   *  When `bold` is true (the HTML path), resolved values are wrapped in <strong>. */
  const resolveVars = (text: string, recipientName: string, recipientEmail: string, bold = false) => {
    const firstName = recipientName.split(" ")[0] || recipientName;
    const fullName = recipientName;
    const dateLong = new Intl.DateTimeFormat("en", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: input.timezone,
    }).format(startUtc);
    const timeFmt = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: input.timezone,
    });
    const esc = (value: string) => value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    const b = (v: string) => (bold ? `<strong>${esc(v)}</strong>` : v);
    const linked = opts.linked ?? {};
    const organizationName = linked.organization || opts.organizationName || "";
    const jobTitle = linked.job || opts.linkedTitle || "";
    // Keep attendee emails as plain text; only attendee names are emphasized.
    const attendeesList = attendeeList
      .map((a) => `- ${a.name} (${a.email})`)
      .join("\n");
    const attendeesValue = bold
      ? attendeeList
        .map((a) => `- <strong>${esc(a.name)}</strong> (${esc(a.email)})`)
        .join("<br/>")
      : attendeesList;
    const linkedEmail = (value: string) => bold
      ? `<a href="mailto:${encodeURIComponent(value)}"><strong>${esc(value)}</strong></a>`
      : value;
    const linkedPhone = (value: string) => bold
      ? `<a href="tel:${encodeURIComponent(value)}"><strong>${esc(value)}</strong></a>`
      : value;
    const slotDateLong = (slot: (typeof smartSlots)[number]) => new Intl.DateTimeFormat("en", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: input.timezone,
    }).format(zonedWallClockToUtc(`${slot.date}T${slot.startTime}`, input.timezone));
    let resolved = text
        .replaceAll("[Candidate.First_name]", b(firstName))
        .replaceAll("[Contact.First_name]", b(firstName))
        .replaceAll("[Internal.First_name]", b(firstName))
        .replaceAll("[Candidate.Full_name]", b(fullName))
        .replaceAll("[Contact.Full_name]", b(fullName))
        .replaceAll("[Internal.Full_name]", b(fullName))
        .replaceAll("[Attendees.List]", attendeesValue)
        .replaceAll("[Attendees.Candidates]", b(bullets(candidatesNames)))
        .replaceAll("[Attendees.Contacts]", b(bullets(contactsNames)))
        .replaceAll("[Attendees.Internals]", b(bullets(internalsNames)))
        .replaceAll("[Linked.Candidate]", b(linked.candidate ?? ""))
        .replaceAll("[Linked.Contact]", b(linked.contact ?? ""))
        .replaceAll("[Linked.Job]", b(jobTitle))
        .replaceAll("[Linked.Opportunity]", b(linked.opportunity ?? ""))
        .replaceAll("[Linked.Organization]", b(organizationName))
        .replaceAll("[Organizer.Name]", b(organizerName))
        .replaceAll("[Organizer.Email]", linkedEmail(organizerEmail))
        .replaceAll("[Organizer.Phone]", linkedPhone(organizerPhone))
        .replaceAll("[Event.Title]", b(eventTitle))
        .replaceAll("[Event.Type]", b(opts.eventType ?? ""))
        .replaceAll("[Event.Date]", b(dateLong))
        .replaceAll("[Event.Start_time]", b(timeFmt.format(startUtc)))
        .replaceAll("[Event.End_time]", b(timeFmt.format(endUtc)))
        .replaceAll("[Event.Description]", b(input.description ?? ""))
        .replaceAll("[Event.Location]", b(opts.smartDocument?.event.location.value ?? input.location ?? ""))
        .replaceAll("[Event.Reminder]", b(reminderLabel ?? "None"))
         .replaceAll(
           "[Meeting.Link]",
           b(meetingLink ?? "(the meeting link is generated with the event)")
         )
         .replaceAll("[Slot.Number]", b(String(activeSlotIndex + 1)))
         .replaceAll("[Slot.Total]", b(String(smartSlots.length)))
         // Legacy aliases
         .replaceAll("[Organization.Name]", b(organizationName))
         .replaceAll("[Job.Title]", b(jobTitle));
     for (const [index, slot] of smartSlots.entries()) {
       const number = index + 1;
       const slotInstant = zonedWallClockToUtc(`${slot.date}T${slot.startTime}`, input.timezone);
       const slotEndInstant = zonedWallClockToUtc(`${slot.date}T${slot.endTime}`, input.timezone);
       resolved = resolved
         .replaceAll(`[Slot.${number}.Date]`, b(slotDateLong(slot)))
         .replaceAll(`[Slot.${number}.Start_time]`, b(timeFmt.format(slotInstant)))
         .replaceAll(`[Slot.${number}.End_time]`, b(timeFmt.format(slotEndInstant)));
     }
     return stripUnknownTokens(resolved);
  };

  for (const attendee of event.attendees) {
    const displayName = attendee.name ?? attendee.email;
    const drawerType = input.attendees.find((a) => a.email === attendee.email)?.type;
    const tab = tabForType(drawerType);
    const tpl = templatesByTab.get(tab);
    const emailThread = opts.emailThreads?.get(attendee.email);

    const inviteCtx = {
      event: {
        summary: eventTitle,
        description: input.description,
        location: hangoutLink ?? input.location,
        startUtc,
        endUtc,
        timezone: input.timezone,
      },
      attendeeNameOrEmail: displayName,
      organizerEmail,
      attendees: attendeeList.filter((a) => a.email !== attendee.email),
      meetUrl: hangoutLink,
      reminderLabel,
    };

    let html: string;
    let text: string;
    let finalSubject: string;
    if (tpl?.bodyHtml || tpl?.body) {
      // Clean email: exactly what the user styled in the editor + signature.
      // Event facts (title/date/where/attendees/reminder) are NOT repeated in
      // the email — they live in the attached iCalendar so every calendar app
      // shows them in its native event card with the built-in RSVP buttons.
       const rawHtml = sanitizeReviewedEmailHtml(
         tpl.bodyHtml ?? `<p>${(tpl.body ?? "").replace(/\n/g, "<br/>")}</p>`
       );
       const reviewedHtml = opts.smartDocument
         ? withStyledSlotNotice(rawHtml, opts.smartDocument)
         : rawHtml;
       const styled = resolveVars(reviewedHtml, displayName, attendee.email, true);
       const resolvedPlain = resolveVars(emailHtmlToPlainText(reviewedHtml), displayName, attendee.email);
      html = buildCleanEmailHtml(styled, {
        organizerEmail,
        organizerName,
        includeSignature: true,
      });
      text = resolvedPlain.trim();
       const resolvedSubject = (tpl.subject ?? subject).includes("[")
         ? resolveVars(tpl.subject ?? subject, displayName, attendee.email)
         : tpl.subject ?? subject;
       finalSubject = emailThread?.subject ?? resolvedSubject;
    } else {
      // No drawer template → default branded invite (create-page flow).
      html = buildDefaultInviteHtml(inviteCtx);
      text = buildDefaultInviteText(inviteCtx);
      finalSubject = emailThread?.subject ?? subject;
    }

    const icsContent = buildRequestIcs({
      uid: g.iCalUID,
      sequence: event.sequence,
      organizer: { email: organizerEmail, name: organizerName },
      attendees: input.attendees.map((a) => ({ email: a.email, name: a.name })),
      title: input.summary,
      // Full event details ride in the ICS DESCRIPTION — this is what the
      // calendar app renders in its native event UI (with Yes/Maybe/No RSVP).
      description: icsDescription,
      location: meetingLink ?? input.location,
      startUtc,
      endUtc,
      url: meetingLink ?? undefined,
      reminderMinutes: opts.reminderMinutes ?? null,
    });

    const sent = await sendInviteEmail(authClient, {
      from: organizerEmail,
      replyTo: organizerEmail,
      to: [attendee.email],
      subject: finalSubject,
      html,
      text,
      icsContent,
      icsFilename: "invite.ics",
      threadId: emailThread?.threadId,
      inReplyTo: emailThread?.rootMessageId,
      references: emailThread ? [emailThread.rootMessageId] : undefined,
    });
    if (!emailThread) {
      opts.emailThreads?.set(attendee.email, {
        threadId: sent.threadId,
        rootMessageId: sent.rfcMessageId,
        subject: finalSubject,
        references: [sent.rfcMessageId],
      });
    }
  }

  return toDto(event);
}

/**
 * Multi-slot Smart Event: creates one Google event per slot (sendUpdates
 * controls native cards) and sends ONE EMAIL PER SLOT per attendee, each
 * carrying its own single-VEVENT METHOD:REQUEST ICS. Gmail renders at most
 * one card per message and only the first VEVENT of a multi-VEVENT ICS, so
 * the only way to show a Yes/No/Maybe button for every slot is one message
 * per slot. Shared subject + In-Reply-To/References/threadId chain all of an
 * attendee's messages into one Gmail conversation: one inbox row when
 * collapsed, all N RSVP cards stacked at thread top when expanded.
 *
 * Single-slot callers should continue to use createEventAndInvite.
 */
export async function createSmartMultiSlotEventsAndInvite(opts: {
  accessToken: string;
  refreshToken?: string | null;
  organizerEmail: string;
  inputs: CreateEventInput[];
  slotDocuments: SmartEventDocument[];
  baseDocument: SmartEventDocument;
  conference?: boolean;
  reminderMinutes?: number | null;
  eventType?: string;
  organizationName?: string | null;
  linkedTitle?: string | null;
  linked?: {
    candidate?: string | null;
    contact?: string | null;
    job?: string | null;
    opportunity?: string | null;
    organization?: string | null;
  };
  inviteMessages?: {
    tab: "candidate" | "contact" | "internal";
    subject?: string;
    body?: string;
    bodyHtml?: string;
  }[];
  /** Shared per-recipient state used to chain the per-slot emails into one
   *  Gmail thread (root message id + subject seeded on first send). */
  emailThreads?: Map<string, InviteThreadState>;
  /** For multi-slot single-email, Google invites are suppressed so the
   *  branded multi-VEVENT ICS is the single source of calendar cards.
   *  Set to "all" only if you explicitly want duplicate Google-native
   *  invites alongside the branded multi-VEVENT email. */
  googleSendUpdates?: "none" | "all";
  /** Existing Smart delivery stays on Gmail; the comparison mode uses Resend. */
  deliveryMode?: "gmail" | "resend";
  /** Required for Resend: professional iMIP ORGANIZER / reply address. */
  organizerAlias?: string;
}): Promise<EventDto[]> {
  const {
    accessToken,
    refreshToken,
    organizerEmail,
    inputs,
    slotDocuments,
    baseDocument,
  } = opts;
  if (inputs.length !== slotDocuments.length || inputs.length === 0) {
    throw new Error("Inputs and slot documents must have the same non-empty length");
  }
  if (inputs.length === 1 && opts.deliveryMode !== "resend") {
    // Degenerate to single-slot path to avoid duplicating logic.
    return [
      await createEventAndInvite({
        accessToken,
        refreshToken,
        organizerEmail,
        input: inputs[0]!,
        conference: opts.conference,
        reminderMinutes: opts.reminderMinutes,
        eventType: opts.eventType,
        organizationName: opts.organizationName,
        linkedTitle: opts.linkedTitle,
        linked: opts.linked,
        smartDocument: slotDocuments[0],
        inviteMessages: opts.inviteMessages,
      }),
    ];
  }

  // Validate all slots up front so we don't create half the Google events.
  const parsedSlots = inputs.map((input) => {
    const startUtc = zonedWallClockToUtc(input.start, input.timezone);
    const endUtc = zonedWallClockToUtc(input.end, input.timezone);
    if (endUtc <= startUtc) throw new Error("End must be after start");
    if (endUtc.getTime() - startUtc.getTime() < 15 * 60_000) {
      throw new Error("Meetings must be at least 15 minutes long.");
    }
    if (startUtc.getTime() < Date.now() - 60_000) {
      throw new Error("Start time must be in the future.");
    }
    return { input, startUtc, endUtc };
  });

  const googleSendUpdates = opts.googleSendUpdates ?? "none";
  const deliveryMode = opts.deliveryMode ?? "gmail";
  if (deliveryMode === "resend" && !opts.organizerAlias) {
    throw new Error("A professional organizer alias is required for Resend RSVP delivery");
  }
  const baseTitle = baseDocument.event.title;
  const slotCount = inputs.length;

  // 2. Create all Google events first (silent when googleSendUpdates === "none").
  const createdEvents: (EventRow & { hangoutLink: string | null })[] = [];
  const googleResults: { id: string; iCalUID: string; hangoutLink: string | null }[] = [];
  for (const [index, { input }] of parsedSlots.entries()) {
    const slotTitle = eventTitleForSlot(baseTitle, index, slotCount);
    const g = await createGoogleEvent(accessToken, {
      summary: slotTitle,
      // Calendar description stays clean: the availability-options notice
      // belongs in the invitation EMAIL only, not on the calendar event.
      description: input.description?.trim() || undefined,
      location: input.location,
      startIso: parsedSlots[index]!.startUtc.toISOString(),
      endIso: parsedSlots[index]!.endUtc.toISOString(),
      timezone: input.timezone,
      attendees: input.attendees.map((a) => ({ email: a.email, name: a.name })),
      conference: opts.conference,
      reminderMinutes: opts.reminderMinutes ?? null,
      sendUpdates: googleSendUpdates,
    });
    googleResults.push(g);
    const hangoutLink = g.hangoutLink;
    const event = await db.event.create({
      data: {
        googleEventId: g.id,
        iCalUID: g.iCalUID,
        summary: slotTitle,
        eventType: opts.eventType ?? null,
        description: input.description ?? null,
        location: hangoutLink ?? input.location ?? null,
        hangoutLink,
        reminderMinutes: opts.reminderMinutes ?? null,
        start: parsedSlots[index]!.startUtc,
        end: parsedSlots[index]!.endUtc,
        timezone: input.timezone,
        emailSubject: input.emailSubject ?? null,
        emailHtml: input.emailHtml ?? null,
        organizerEmail,
        sequence: 0,
        attendees: {
          create: input.attendees.map((a) => ({
            email: a.email,
            name: a.name,
            type: (a as { type?: string }).type ?? null,
          })),
        },
      },
      include: { attendees: true },
    });
    createdEvents.push({ ...event, hangoutLink } as EventRow & { hangoutLink: string | null });
  }

  if (refreshToken) {
    await db.organizerAccount.upsert({
      where: { email: organizerEmail },
      update: { refreshToken },
      create: { email: organizerEmail, refreshToken },
    });
  }

  const authClient = getGoogleClient(accessToken);

  // Build a representative event for email scaffolding (first slot) — the
  // per-slot VEVENTs carry their own times/titles, the email body uses the
  // first slot as the "When" anchor and the slotNotice lists all options.
  const firstParsed = parsedSlots[0]!;
  const firstEvent = createdEvents[0]!;
  const firstGoogle = googleResults[0]!;
  const representativeHangout = firstGoogle.hangoutLink;
  const subjectSeed = inputs[0]!.emailSubject?.trim() || `Invitation: ${baseTitle}`;

  // Reuse the single-slot attendee/variable scaffolding but anchored to the
  // first slot's time — the ICS multi-VEVENT carries per-slot times.
  const typeByEmail = new Map(
    inputs[0]!.attendees.map((a) => [a.email, (a as { type?: string }).type ?? ""])
  );
  const attendeeList = firstEvent.attendees.map((a) => ({
    name: a.name ?? a.email,
    email: a.email,
    role: a.email === organizerEmail ? "Organizer" : "Attendee",
    type: typeByEmail.get(a.email) ?? "",
  }));
  const reminderLabel =
    opts.reminderMinutes != null ? `${opts.reminderMinutes} minutes before` : null;
  const organizerName = baseDocument.organizer.fullName || organizerEmail.split("@")[0];
  const organizerPhone = baseDocument.organizer.phone ?? "";
  const locationType = baseDocument.event.location.type;
  const meetingLink =
    representativeHangout ?? (locationType === "online" ? baseDocument.event.location.value : null);
  const whereValue = meetingLink ?? baseDocument.event.location.value ?? inputs[0]!.location ?? "—";
  const whereLabel =
    locationType === "online"
      ? `Online - ${whereValue}`
      : locationType === "company"
        ? `Company address - ${whereValue}`
        : locationType === "custom"
          ? `Other location - ${whereValue}`
          : whereValue;
  const bullets = (names: string[]) => (names.length ? names.map((n) => `• ${n}`).join("\n") : "");
  const groupNames = (predicate: (t: string) => boolean) =>
    attendeeList.filter((a) => predicate(a.type)).map((a) => a.name);
  const candidatesNames = groupNames((t) => t === "candidate");
  const contactsNames = groupNames((t) => t === "contact");
  const internalsNames = groupNames((t) => t === "internal");

  const icsDescriptionForSlot = (slotIndex: number) => {
    const slotParsed = parsedSlots[slotIndex]!;
    const slotLabel = formatEventRange(slotParsed.startUtc, slotParsed.endUtc, inputs[slotIndex]!.timezone);
    const slotTitle = eventTitleForSlot(baseTitle, slotIndex, slotCount);
    return [
      inputs[slotIndex]!.description?.trim() || null,
      [
        `Event: ${slotTitle}`,
        `Type: ${opts.eventType ?? "—"}`,
        `When: ${slotLabel} (${inputs[slotIndex]!.timezone})`,
        `Where: ${whereLabel}`,
        `Organizer: ${organizerName} (${organizerEmail})`,
        `Guests:\n${attendeeList.map((a) => `  - ${a.name} (${a.email})`).join("\n")}`,
        reminderLabel ? `Reminder: ${reminderLabel}.` : null,
        "Please respond with Yes / Maybe / No from your calendar app — your answer syncs to the organizer automatically.",
      ]
        .filter(Boolean)
        .join("\n"),
    ]
      .filter(Boolean)
      .join("\n\n");
  };

  const templatesByTab = new Map<string, { subject?: string; body?: string; bodyHtml?: string }>();
  for (const m of opts.inviteMessages ?? []) {
    if (m?.tab && (m.bodyHtml || m.body)) {
      templatesByTab.set(m.tab, { subject: m.subject, bodyHtml: m.bodyHtml, body: m.body });
    }
  }
  const tabForType = (type?: string): "candidate" | "contact" | "internal" =>
    type === "contact" ? "contact" : type === "internal" ? "internal" : "candidate";

  // Per-slot variable resolution: each slot's email anchors [Event.*] to its
  // own time and [Slot.Number] to its own index.
  const firstStartUtc = firstParsed.startUtc;
  const resolveVars = (
    text: string,
    recipientName: string,
    recipientEmail: string,
    bold = false,
    anchor?: { startUtc: Date; endUtc: Date; number: number }
  ) => {
    const aStart = anchor?.startUtc ?? firstStartUtc;
    const aEnd = anchor?.endUtc ?? firstParsed.endUtc;
    const firstName = recipientName.split(" ")[0] || recipientName;
    const fullName = recipientName;
    const dateLong = new Intl.DateTimeFormat("en", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: inputs[0]!.timezone,
    }).format(aStart);
    const timeFmt = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: inputs[0]!.timezone,
    });
    const escHtml = (value: string) =>
      value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const b = (v: string) => (bold ? `<strong>${escHtml(v)}</strong>` : v);
    const linked = opts.linked ?? {};
    const organizationName = linked.organization || opts.organizationName || "";
    const jobTitle = linked.job || opts.linkedTitle || "";
    const attendeesList = attendeeList.map((a) => `- ${a.name} (${a.email})`).join("\n");
    const attendeesValue = bold
      ? attendeeList.map((a) => `- <strong>${escHtml(a.name)}</strong> (${escHtml(a.email)})`).join("<br/>")
      : attendeesList;
    const linkedEmail = (value: string) =>
      bold ? `<a href="mailto:${encodeURIComponent(value)}"><strong>${escHtml(value)}</strong></a>` : value;
    const linkedPhone = (value: string) =>
      bold ? `<a href="tel:${encodeURIComponent(value)}"><strong>${escHtml(value)}</strong></a>` : value;
    const slotDateLong = (slot: (typeof baseDocument.event.slots)[number]) =>
      new Intl.DateTimeFormat("en", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: inputs[0]!.timezone,
      }).format(zonedWallClockToUtc(`${slot.date}T${slot.startTime}`, inputs[0]!.timezone));
    let resolved = text
      .replaceAll("[Candidate.First_name]", b(firstName))
      .replaceAll("[Contact.First_name]", b(firstName))
      .replaceAll("[Internal.First_name]", b(firstName))
      .replaceAll("[Candidate.Full_name]", b(fullName))
      .replaceAll("[Contact.Full_name]", b(fullName))
      .replaceAll("[Internal.Full_name]", b(fullName))
      .replaceAll("[Attendees.List]", attendeesValue)
      .replaceAll("[Attendees.Candidates]", b(bullets(candidatesNames)))
      .replaceAll("[Attendees.Contacts]", b(bullets(contactsNames)))
      .replaceAll("[Attendees.Internals]", b(bullets(internalsNames)))
      .replaceAll("[Linked.Candidate]", b(linked.candidate ?? ""))
      .replaceAll("[Linked.Contact]", b(linked.contact ?? ""))
      .replaceAll("[Linked.Job]", b(jobTitle))
      .replaceAll("[Linked.Opportunity]", b(linked.opportunity ?? ""))
      .replaceAll("[Linked.Organization]", b(organizationName))
      .replaceAll("[Organizer.Name]", b(organizerName))
      .replaceAll("[Organizer.Email]", linkedEmail(organizerEmail))
      .replaceAll("[Organizer.Phone]", linkedPhone(organizerPhone))
      .replaceAll("[Event.Title]", b(baseTitle))
      .replaceAll("[Event.Type]", b(opts.eventType ?? ""))
      .replaceAll("[Event.Date]", b(dateLong))
      .replaceAll("[Event.Start_time]", b(timeFmt.format(aStart)))
      .replaceAll("[Event.End_time]", b(timeFmt.format(aEnd)))
      .replaceAll("[Event.Description]", b(inputs[0]!.description ?? ""))
      .replaceAll("[Event.Location]", b(baseDocument.event.location.value ?? inputs[0]!.location ?? ""))
      .replaceAll("[Event.Reminder]", b(reminderLabel ?? "None"))
      .replaceAll("[Meeting.Link]", b(meetingLink ?? "(the meeting link is generated with the event)"))
      .replaceAll("[Slot.Number]", b(String(anchor?.number ?? 1)))
      .replaceAll("[Slot.Total]", b(String(slotCount)))
      // Legacy aliases
      .replaceAll("[Organization.Name]", b(organizationName))
      .replaceAll("[Job.Title]", b(jobTitle));
    for (const [index, slot] of baseDocument.event.slots.entries()) {
      const number = index + 1;
      const slotInstant = zonedWallClockToUtc(`${slot.date}T${slot.startTime}`, inputs[0]!.timezone);
      const slotEndInstant = zonedWallClockToUtc(`${slot.date}T${slot.endTime}`, inputs[0]!.timezone);
      resolved = resolved
        .replaceAll(`[Slot.${number}.Date]`, b(slotDateLong(slot)))
        .replaceAll(`[Slot.${number}.Start_time]`, b(timeFmt.format(slotInstant)))
        .replaceAll(`[Slot.${number}.End_time]`, b(timeFmt.format(slotEndInstant)));
    }
    return stripUnknownTokens(resolved);
  };

  // Per-slot single-VEVENT ICS inputs (same shape as the single-slot path).
  const slotIcsInputs = parsedSlots.map((slotParsed, index) => {
    const slotTitle = eventTitleForSlot(baseTitle, index, slotCount);
    // Per-slot Meet link if any.
    const slotHangout = googleResults[index]?.hangoutLink ?? null;
    const slotMeetingLink =
      slotHangout ?? (locationType === "online" ? baseDocument.event.location.value : null);
    const slotWhere = slotMeetingLink ?? baseDocument.event.location.value ?? slotParsed.input.location;
    return {
      prodId: deliveryMode === "resend" ? "-//Wiggli//Resend RSVP//EN" : undefined,
      uid: googleResults[index]!.iCalUID,
      sequence: 0,
      organizer: {
        email: deliveryMode === "resend" ? opts.organizerAlias! : organizerEmail,
        name: organizerName,
      },
      attendees: deliveryMode === "resend"
        ? [
            ...slotParsed.input.attendees
              .filter((a) => a.email.toLowerCase() !== organizerEmail.toLowerCase())
              .map((a) => ({
                email: a.email,
                name: a.name,
                partstat: "NEEDS-ACTION" as const,
                rsvp: true,
                includeGuestCount: false,
              })),
            {
              email: organizerEmail,
              name: organizerName,
              partstat: "ACCEPTED" as const,
              rsvp: false,
              includeGuestCount: false,
            },
          ]
        : slotParsed.input.attendees.map((a) => ({ email: a.email, name: a.name })),
      title: slotTitle,
      description: icsDescriptionForSlot(index),
      location: slotWhere ?? undefined,
      startUtc: slotParsed.startUtc,
      endUtc: slotParsed.endUtc,
      url: slotMeetingLink ?? undefined,
      reminderMinutes: opts.reminderMinutes ?? null,
    };
  });

  // One Gmail thread per attendee, ONE shared subject, N emails with native
  // RSVP cards: the first email opens the conversation; each subsequent
  // email joins it via Gmail's server-side threadId plus RFC chaining
  // headers pointing at the DELIVERED Message-ID (Gmail regenerates authored
  // ones). The single-subject rule is what collapses them into one inbox
  // row; expanding shows every slot's Yes/No/Maybe card in sequence.
  for (const attendee of firstEvent.attendees) {
    const displayName = attendee.name ?? attendee.email;
    const drawerType = inputs[0]!.attendees.find((a) => a.email === attendee.email)?.type;
    const tab = tabForType(drawerType);
    const tpl = templatesByTab.get(tab);
    const firstAnchor = {
      startUtc: parsedSlots[0]!.startUtc,
      endUtc: parsedSlots[0]!.endUtc,
      number: 1,
    };
    const resendSubject = tpl?.subject
      ? resolveVars(tpl.subject, displayName, attendee.email, false, firstAnchor)
      : subjectSeed;
    const rootMessageId = deliveryMode === "resend"
      ? buildResendMessageId({
          eventId: firstEvent.id,
          recipientEmail: attendee.email,
          sequence: firstEvent.sequence,
        })
      : undefined;

    // Thread state per attendee — seeded by whichever email sends first.
    let thread = opts.emailThreads?.get(attendee.email);
    if (!thread) {
      thread = { rootMessageId: "", subject: resendSubject, references: [] };
      opts.emailThreads?.set(attendee.email, thread);
    }

    for (const [slotIndex, slotParsed] of parsedSlots.entries()) {
      const anchor = {
        startUtc: slotParsed.startUtc,
        endUtc: slotParsed.endUtc,
        number: slotIndex + 1,
      };

      let html: string;
      let text: string;
      if (tpl?.bodyHtml || tpl?.body) {
        const rawHtml = sanitizeReviewedEmailHtml(
          tpl.bodyHtml ?? `<p>${(tpl.body ?? "").replace(/\n/g, "<br/>")}</p>`
        );
        // Always upsert the CURRENT styled multi-slot note: drafts reviewed
        // before a styling change embed a stale copy of the block.
        const withNotice = withStyledSlotNotice(rawHtml, baseDocument);
        const styled = resolveVars(withNotice, displayName, attendee.email, true, anchor);
        const resolvedPlain = resolveVars(emailHtmlToPlainText(withNotice), displayName, attendee.email, false, anchor);
        html = buildCleanEmailHtml(styled, {
          organizerEmail,
          organizerName,
          includeSignature: true,
        });
        text = resolvedPlain.trim();
      } else {
        const inviteCtx = {
          event: {
            summary: eventTitleForSlot(baseTitle, slotIndex, slotCount),
            description: inputs[0]!.description,
            location: googleResults[slotIndex]?.hangoutLink ?? inputs[0]!.location,
            startUtc: slotParsed.startUtc,
            endUtc: slotParsed.endUtc,
            timezone: inputs[0]!.timezone,
          },
          attendeeNameOrEmail: displayName,
          organizerEmail,
          attendees: attendeeList.filter((a) => a.email !== attendee.email),
          meetUrl: googleResults[slotIndex]?.hangoutLink ?? undefined,
          reminderLabel,
        };
        html = buildDefaultInviteHtml(inviteCtx);
        text = buildDefaultInviteText(inviteCtx);
      }

      if (deliveryMode === "resend") {
        const slotEvent = createdEvents[slotIndex]!;
        const messageId = buildResendMessageId({
          eventId: slotEvent.id,
          recipientEmail: attendee.email,
          sequence: slotEvent.sequence,
        });
        await sendResendCalendarEmail({
          organizerAlias: opts.organizerAlias!,
          to: attendee.email,
          subject: resendSubject,
          html,
          text,
          icsContent: buildRequestIcs(slotIcsInputs[slotIndex]!),
          filename: `invite-slot-${slotIndex + 1}.ics`,
          messageId,
          idempotencyKey: `calendar/${slotEvent.id}/${attendee.id}/${slotEvent.sequence}`,
          ...(slotIndex > 0 && rootMessageId
            ? { inReplyTo: rootMessageId, references: [rootMessageId] }
            : {}),
        });
      } else {
        // Gmail delivery — ONE shared subject per attendee, chained into a
        // single conversation via threadId + delivered-Message-ID references.
        const sent = await sendInviteEmail(authClient, {
          from: organizerEmail,
          replyTo: organizerEmail,
          to: [attendee.email],
          subject: thread.subject,
          html,
          text,
          icsContent: buildRequestIcs(slotIcsInputs[slotIndex]!),
          icsFilename: "invite.ics",
          ...(thread.rootMessageId
            ? {
                threadId: thread.threadId,
                inReplyTo: thread.rootMessageId,
                references: [...thread.references, thread.rootMessageId],
              }
            : {}),
        });
        if (!thread.rootMessageId) {
          // First slot email opens the thread — capture Gmail's server-side
          // threadId and the DELIVERED RFC Message-ID for all follow-ups.
          thread.rootMessageId = sent.rfcMessageId;
          thread.threadId = sent.threadId;
        }
        thread.references.push(sent.rfcMessageId);
      }
    }
  }

  return createdEvents.map(toDto);
}

/**
 * Offline RSVP sync (legacy one-click endpoint support).
 * Uses the stored organizer refresh token — no active browser session needed.
 * Best-effort: failures never block the attendee's confirmation page.
 */
export async function syncRsvpToGoogleBestEffort(
  organizerEmail: string,
  googleEventId: string | null,
  attendeeEmail: string,
  status: "ACCEPTED" | "TENTATIVE" | "DECLINED"
): Promise<boolean> {
  if (!googleEventId) return false;
  try {
    const account = await db.organizerAccount.findUnique({ where: { email: organizerEmail } });
    if (!account?.refreshToken) return false;

    const { google } = await import("googleapis");
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2.setCredentials({ refresh_token: account.refreshToken });

    const calendar = google.calendar({ version: "v3", auth: oauth2 });
    const remote = await calendar.events.get({
      calendarId: "primary",
      eventId: googleEventId,
    });
    const attendees = (remote.data.attendees ?? []).map((attendee) =>
      attendee.email?.toLowerCase() === attendeeEmail.toLowerCase()
        ? { ...attendee, responseStatus: status.toLowerCase() }
        : attendee
    );
    await calendar.events.patch({
      calendarId: "primary",
      eventId: googleEventId,
      sendUpdates: "none", // our app already notified everyone
      requestBody: {
        attendees,
      },
    });
    return true;
  } catch (err) {
    console.error("[rsvp] google sync failed:", err);
    return false;
  }
}

/** Human-readable range used by confirmation pages. */
export function describeEventRange(e: { start: Date; end: Date; timezone: string }): string {
  return formatEventRange(e.start, e.end, e.timezone);
}
