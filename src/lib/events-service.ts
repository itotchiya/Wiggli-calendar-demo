import { db } from "./prisma";
import { getGoogleClient, createGoogleEvent } from "./google/calendar";
import { sendInviteEmail } from "./google/gmail";
import { buildRequestIcs } from "./ics";
import { buildDefaultInviteHtml, buildDefaultInviteText, buildCleanEmailHtml } from "./email-template";
import { zonedWallClockToUtc } from "./datetime";
import { formatEventRange } from "./format";
import { stripUnknownTokens } from "./invite-variables";
import type { OAuth2Client } from "google-auth-library";
import type { CreateEventInput, EventDto, AttendeeDto } from "@/types/event";

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
  iCalUID: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: Date;
  end: Date;
  timezone: string;
  organizerEmail: string;
  sequence: number;
  createdAt: Date;
  attendees: {
    id: string;
    email: string;
    name: string | null;
    rsvp: string;
    respondedAt: Date | null;
  }[];
};

function toDto(e: EventRow): EventDto {
  return {
    id: e.id,
    googleEventId: e.googleEventId,
    iCalUID: e.iCalUID,
    summary: e.summary,
    description: e.description,
    location: e.location,
    start: e.start.toISOString(),
    end: e.end.toISOString(),
    timezone: e.timezone,
    organizerEmail: e.organizerEmail,
    createdAt: e.createdAt.toISOString(),
    attendees: e.attendees.map<AttendeeDto>((a) => ({
      id: a.id,
      email: a.email,
      name: a.name,
      rsvp: a.rsvp as AttendeeDto["rsvp"],
      respondedAt: a.respondedAt ? a.respondedAt.toISOString() : null,
    })),
  };
}

export async function listEvents(): Promise<EventDto[]> {
  const rows = await db.event.findMany({
    include: { attendees: true },
    orderBy: { start: "asc" },
  });
  return rows.map(toDto);
}

/**
 * The heart of the demo:
 * 1. resolve wall-clock times → UTC instants
 * 2. insert the Google Calendar event with sendUpdates:"none"
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
  /** Per-attendee-type AI/user templates from the drawer's step 2. */
  inviteMessages?: {
    tab: "candidate" | "contact" | "internal";
    subject?: string;
    body?: string;
    /** Styled HTML from the rich editor (chips already converted to [Tokens]). */
    bodyHtml?: string;
  }[];
  /** Pre-provisioned Google Meet link (created instantly in the drawer). */
  meetLink?: string | null;
}): Promise<EventDto> {
  const { accessToken, refreshToken, organizerEmail, input } = opts;

  const startUtc = zonedWallClockToUtc(input.start, input.timezone);
  const endUtc = zonedWallClockToUtc(input.end, input.timezone);

  if (endUtc <= startUtc) throw new Error("End must be after start");
  if (endUtc.getTime() - startUtc.getTime() < 15 * 60_000) {
    throw new Error("Meetings must be at least 15 minutes long.");
  }
  // Small grace window so a slot chosen moments ago doesn't fail on submit lag.
  if (startUtc.getTime() < Date.now() - 60_000) {
    throw new Error("Start time must be in the future.");
  }

  // 2. Google Calendar (suppresses Google's own invitation emails)
  const g = await createGoogleEvent(accessToken, {
    summary: input.summary,
    description: input.description,
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
  });

  // Single authoritative Meet link — the one Google provisioned on create.
  const hangoutLink = g.hangoutLink;

  // 3. Local persistence
  const event = await db.event.create({
    data: {
      googleEventId: g.id,
      iCalUID: g.iCalUID,
      summary: input.summary,
      description: input.description ?? null,
      location: hangoutLink ?? input.location ?? null,
      hangoutLink,
      reminderMinutes: opts.reminderMinutes ?? null,
      start: startUtc,
      end: endUtc,
      timezone: input.timezone,
      emailSubject: input.emailSubject ?? null,
      emailHtml: input.emailHtml ?? null,
      organizerEmail,
      sequence: 0,
      attendees: {
        create: input.attendees.map((a) => ({ email: a.email, name: a.name })),
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

  const whenLabel = formatEventRange(startUtc, endUtc, input.timezone);
  const whereLabel = hangoutLink ?? input.location ?? "—";
  const bullets = (names: string[]) =>
    names.length ? names.map((n) => `• ${n}`).join("\n") : "";
  const groupNames = (predicate: (t: string) => boolean) =>
    attendeeList.filter((a) => predicate(a.type)).map((a) => a.name);
  const candidatesNames = groupNames((t) => t === "candidate" || t === "freelancer");
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
      `Organizer: ${organizerEmail}`,
      `Attendees:\n${attendeeList.map((a) => `  - ${a.name}${a.role === "Organizer" ? " (organizer)" : ""}`).join("\n")}`,
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
    }).format(startUtc);
    const timeFmt = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: input.timezone,
    });
    const b = (v: string) => (bold ? `<strong>${v}</strong>` : v);
    const linked = opts.linked ?? {};
    const organizationName = linked.organization || opts.organizationName || "";
    const jobTitle = linked.job || opts.linkedTitle || "";
    // Bullet list of everyone attending (used by [Attendees.List]).
    const attendeesList = attendeeList
      .map((a) => `• ${a.name}${a.role === "Organizer" ? " (Organizer)" : ""}`)
      .join("\n");
    return stripUnknownTokens(
      text
        .replaceAll("[Candidate.First_name]", b(firstName))
        .replaceAll("[Contact.First_name]", b(firstName))
        .replaceAll("[Internal.First_name]", b(firstName))
        .replaceAll("[Candidate.Full_name]", b(fullName))
        .replaceAll("[Contact.Full_name]", b(fullName))
        .replaceAll("[Internal.Full_name]", b(fullName))
        .replaceAll("[Attendees.List]", b(attendeesList))
        .replaceAll("[Attendees.Candidates]", b(bullets(candidatesNames)))
        .replaceAll("[Attendees.Contacts]", b(bullets(contactsNames)))
        .replaceAll("[Attendees.Internals]", b(bullets(internalsNames)))
        .replaceAll("[Linked.Candidate]", b(linked.candidate ?? ""))
        .replaceAll("[Linked.Contact]", b(linked.contact ?? ""))
        .replaceAll("[Linked.Job]", b(jobTitle))
        .replaceAll("[Linked.Opportunity]", b(linked.opportunity ?? ""))
        .replaceAll("[Linked.Organization]", b(organizationName))
        .replaceAll("[Organizer.Name]", b(organizerEmail.split("@")[0]))
        .replaceAll("[Event.Title]", b(input.summary))
        .replaceAll("[Event.Type]", b(opts.eventType ?? ""))
        .replaceAll("[Event.Date]", b(dateLong))
        .replaceAll("[Event.Start_time]", b(timeFmt.format(startUtc)))
        .replaceAll("[Event.End_time]", b(timeFmt.format(endUtc)))
        .replaceAll("[Event.Description]", b(input.description ?? ""))
        .replaceAll("[Event.Location]", b(input.location ?? ""))
        .replaceAll("[Event.Reminder]", b(reminderLabel ?? "None"))
        .replaceAll(
          "[Meeting.Link]",
          b(hangoutLink ?? "(the Google Meet link is generated with the event)")
        )
        // Legacy aliases
        .replaceAll("[Organization.Name]", b(organizationName))
        .replaceAll("[Job.Title]", b(jobTitle))
    );
  };

  for (const attendee of event.attendees) {
    const displayName = attendee.name ?? attendee.email;
    const drawerType = input.attendees.find((a) => a.email === attendee.email)?.type;
    const tab = tabForType(drawerType);
    const tpl = templatesByTab.get(tab);

    const inviteCtx = {
      event: {
        summary: input.summary,
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
      const rawHtml = tpl.bodyHtml ?? `<p>${(tpl.body ?? "").replace(/\n/g, "<br/>")}</p>`;
      const styled = resolveVars(rawHtml, displayName, attendee.email, true);
      const plainSource = (tpl.body ?? rawHtml.replace(/<[^>]+>/g, " "));
      const resolvedPlain = resolveVars(
        plainSource.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n"),
        displayName,
        attendee.email
      );
      html = buildCleanEmailHtml(styled, {
        organizerEmail,
        organizerName: organizerEmail.split("@")[0],
      });
      text = resolvedPlain.trim();
      finalSubject = (tpl.subject ?? subject).includes("[")
        ? resolveVars(tpl.subject ?? subject, displayName, attendee.email)
        : tpl.subject ?? subject;
    } else {
      // No drawer template → default branded invite (create-page flow).
      html = buildDefaultInviteHtml(inviteCtx);
      text = buildDefaultInviteText(inviteCtx);
      finalSubject = subject;
    }

    const icsContent = buildRequestIcs({
      uid: g.iCalUID,
      sequence: event.sequence,
      organizer: { email: organizerEmail },
      attendees: input.attendees.map((a) => ({ email: a.email, name: a.name })),
      title: input.summary,
      // Full event details ride in the ICS DESCRIPTION — this is what the
      // calendar app renders in its native event UI (with Yes/Maybe/No RSVP).
      description: icsDescription,
      location: hangoutLink ?? input.location,
      startUtc,
      endUtc,
      url: hangoutLink ?? undefined,
      reminderMinutes: opts.reminderMinutes ?? null,
    });

    await sendInviteEmail(authClient, {
      from: organizerEmail,
      replyTo: organizerEmail,
      to: [attendee.email],
      subject: finalSubject,
      html,
      text,
      icsContent,
      icsFilename: "invite.ics",
    });
  }

  return toDto(event);
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
    await calendar.events.patch({
      calendarId: "primary",
      eventId: googleEventId,
      sendUpdates: "none", // our app already notified everyone
      requestBody: {
        attendees: [{ email: attendeeEmail, responseStatus: status.toLowerCase() }],
      },
      // note: patch merges attendees by email
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
