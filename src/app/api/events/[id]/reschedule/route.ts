import { NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { withFreshGoogleClient, AuthExpiredError } from "@/lib/google-auth";
import { db } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { buildRequestIcs, buildCancelIcs } from "@/lib/ics";
import { sendInviteEmail } from "@/lib/google/gmail";
import { buildCleanEmailHtml } from "@/lib/email-template";
import { formatEventRange } from "@/lib/format";

/** Minimal HTML-escape for the update note (user text) in the email body. */
function escHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Reschedule ("Update & notify"): moves the event to the new start/end on
 * Google Calendar, then emails every attendee a BRANDED update with an
 * updated METHOD:REQUEST .ics (same iCalUID, sequence+1) so their calendar
 * copies move with it and native Yes/Maybe/No stays intact.
 *
 * We deliberately use `sendUpdates: "none"` on the Google update — just like
 * the create flow uses a silent insert — because Google's own "updated
 * invitation" email is unreliable (and never reaches the organizer). Sending
 * our own branded update guarantees the attendee actually receives the ICS.
 *
 * Also carries the full Google-API-writable field set (summary, location,
 * attendees, reminderMinutes) and marks pending counter-proposals ACCEPTED.
 *
 * PATCH /api/events/[id]/reschedule
 *   { start, end, timezone, note?, summary?, location?, attendees?,
 *     reminderMinutes?, description? }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    start?: string;
    end?: string;
    timezone?: string;
    description?: string;
    note?: string;
    summary?: string;
    location?: string;
    attendees?: { email: string; name?: string; type?: string }[];
    reminderMinutes?: number | null;
  } | null;
  if (!body?.start || !body?.end) {
    return NextResponse.json({ error: "start and end are required" }, { status: 400 });
  }

  const event = await db.event.findUnique({ where: { id }, include: { attendees: true } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.source === "GOOGLE") {
    return NextResponse.json({ error: "Google Calendar events are read-only in Wiggli." }, { status: 403 });
  }
  if (!event.googleEventId) {
    return NextResponse.json({ error: "Event has no Google Calendar counterpart" }, { status: 409 });
  }

  const timezone = body.timezone || event.timezone || "UTC";
  const { zonedWallClockToUtc } = await import("@/lib/datetime");
  let startUtc: Date;
  let endUtc: Date;
  try {
    startUtc = zonedWallClockToUtc(body.start, timezone);
    endUtc = zonedWallClockToUtc(body.end, timezone);
  } catch {
    return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });
  }
  if (endUtc <= startUtc) {
    return NextResponse.json({ error: "End must be after start" }, { status: 400 });
  }

  const finalSummary = body.summary !== undefined ? body.summary.trim() || event.summary : undefined;
  const finalLocation = body.location !== undefined ? body.location.trim() || null : undefined;
  const reminderMinutes = body.reminderMinutes !== undefined ? body.reminderMinutes : undefined;
  const attendeeInput = body.attendees !== undefined ? body.attendees : undefined;
  const nextSequence = event.sequence + 1;

  try {
    const finalDescription = body.description !== undefined ? body.description : event.description;

    const notifyResult = await withFreshGoogleClient(session.accessToken!, event.organizerEmail, async (client) => {
      const accessToken = client.credentials.access_token ?? session.accessToken!;
      const authClient = new google.auth.OAuth2();
      authClient.setCredentials({ access_token: accessToken });
      const calendar = google.calendar({ version: "v3", auth: authClient });

      const remote = await calendar.events.get({
        calendarId: "primary",
        eventId: event.googleEventId!,
      });

      // Full-resource update (update() replaces the whole event), spreading the
      // remote state and overriding only what we own.
      const requestBody: Record<string, unknown> = {
        ...remote.data,
        start: { dateTime: startUtc.toISOString(), timeZone: timezone },
        end: { dateTime: endUtc.toISOString(), timeZone: timezone },
        description: body.note?.trim()
          ? [finalDescription?.replace(/— Update Reason:[\s\S]*$/, "").replace(/— Updated:[\s\S]*$/, "").trim(), `— Update Reason: ${body.note.trim()}`].filter(Boolean).join("\n\n")
          : finalDescription,
      };
      if (finalSummary !== undefined) requestBody.summary = finalSummary;
      if (finalLocation !== undefined) requestBody.location = finalLocation;
      if (reminderMinutes !== undefined) {
        requestBody.reminders =
          reminderMinutes != null
            ? { useDefault: false, overrides: [{ method: "email", minutes: reminderMinutes }, { method: "popup", minutes: reminderMinutes }] }
            : { useDefault: true };
      }
      if (attendeeInput !== undefined) {
        const organizerEmail = event.organizerEmail.toLowerCase();
        const already = new Set(attendeeInput.map((a) => a.email.toLowerCase()));
        requestBody.attendees = [
          ...(already.has(organizerEmail) ? [] : [{ email: event.organizerEmail }]),
          ...attendeeInput.map((a) => ({ email: a.email, ...(a.name ? { displayName: a.name } : {}) })),
        ];
      }

      // Silent Google update — WE deliver the branded update (see below).
      await calendar.events.update({
        calendarId: "primary",
        sendUpdates: "none",
        eventId: event.googleEventId!,
        requestBody,
      });

      // ── Branded update email + updated .ics to every attendee ─────────────
      const organizerEmail = event.organizerEmail;
      const organizerName = session.user?.name?.trim() || organizerEmail.split("@")[0];
      const whenLabel = formatEventRange(startUtc, endUtc, timezone);
      const note = body.note?.trim();
      const attendeesToNotify = attendeeInput ?? event.attendees.map((a) => ({ email: a.email, name: a.name ?? a.email }));

      // ── Attendee diff: invitation vs update vs cancellation ────────────────
      // ADDED   → brand-new METHOD:REQUEST invitation (sequence 0 from their
      //           perspective; same UID keeps replies mapping to this event).
      // KEPT    → METHOD:REQUEST update (sequence+1) so their calendar moves.
      // REMOVED → METHOD:CANCEL so their calendar copies are struck/removed.
      const prevEmails = new Set(event.attendees.map((a) => a.email.toLowerCase()));
      const nextEmails = new Set(attendeesToNotify.map((a) => a.email.toLowerCase()));
      const added = attendeesToNotify.filter((a) => !prevEmails.has(a.email.toLowerCase()));
      const kept = attendeesToNotify.filter((a) => prevEmails.has(a.email.toLowerCase()));
      const removed = event.attendees.filter(
        (a) => !nextEmails.has(a.email.toLowerCase()) && a.email.toLowerCase() !== organizerEmail.toLowerCase()
      );

      const icsLocation = finalLocation ?? event.hangoutLink ?? undefined;
      const icsReminder = reminderMinutes ?? event.reminderMinutes ?? null;
      const attendeesListBlock = `Guests:\n${attendeesToNotify.map((a) => `  - ${a.name ?? a.email}`).join("\n")}`;

      /** Shared REQUEST payload for both added (invite) and kept (update). */
      const requestIcsFor = (sequence: number, extraIntro: string | null) => buildRequestIcs({
        uid: event.iCalUID,
        sequence,
        organizer: { email: organizerEmail, name: organizerName },
        attendees: attendeesToNotify.map((a) => ({ email: a.email, name: a.name })),
        title: finalSummary ?? event.summary,
        description: [
          extraIntro ?? (note ? `Update note: ${note}` : "The schedule for this event was updated."),
          `Event: ${finalSummary ?? event.summary}`,
          `When: ${whenLabel} (${timezone})`,
          `Organizer: ${organizerName} (${organizerEmail})`,
          attendeesListBlock,
          "Please respond with Yes / Maybe / No from your calendar app — your answer syncs to the organizer automatically.",
        ].filter(Boolean).join("\n\n"),
        location: icsLocation,
        startUtc,
        endUtc,
        url: icsLocation,
        reminderMinutes: icsReminder,
      });

      const updateIcs = requestIcsFor(nextSequence, note ? `Update note: ${note}` : null);
      const inviteIcs = requestIcsFor(0, null); // fresh invite: SEQUENCE 0
      const cancelIcs = buildCancelIcs({
        uid: event.iCalUID,
        sequence: nextSequence,
        organizer: { email: organizerEmail, name: organizerName },
        attendees: removed.map((a) => ({ email: a.email, name: a.name ?? a.email })),
        title: finalSummary ?? event.summary,
        location: icsLocation,
        startUtc,
        endUtc,
      });

      let notified = 0;
      const sendErrors: string[] = [];
      const send = async (to: string, ics: string, subject: string, html: string, text: string, filename: string) => {
        try {
          await sendInviteEmail(authClient, { from: organizerEmail, replyTo: organizerEmail, to: [to], subject, html, text, icsContent: ics, icsFilename: filename });
          notified += 1;
        } catch (sendErr) {
          // One attendee's delivery failure must not abort the update — log it
          // and keep the Google event + local state consistent.
          console.error("[events:reschedule] notification email failed for", to, sendErr);
          sendErrors.push(to);
        }
      };

      // REMOVED → cancellation notice (send FIRST so their calendar clears
      // before the new REQUEST replaces the shared UID on remaining clients).
      for (const att of removed) {
        const html = buildCleanEmailHtml(
          `<p><strong>${escHtml(finalSummary ?? event.summary)}</strong> — you have been removed from this event.</p>` +
          `<p>The organizer removed you from the guest list. Your calendar copy has been cancelled.</p>` +
          (note ? `<p>${escHtml(note)}</p>` : ""),
          { organizerEmail, organizerName }
        );
        await send(att.email, cancelIcs, `Cancelled: ${finalSummary ?? event.summary}`, html, `You have been removed from "${finalSummary ?? event.summary}".`, "cancel.ics");
      }

      // ADDED → full invitation (like a brand-new event).
      for (const att of added) {
        const attendeeName = att.name ?? att.email;
        const html = buildCleanEmailHtml(
          `<p>Hi ${escHtml(attendeeName)}, you've been invited.</p>` +
          `<p><strong>${escHtml(finalSummary ?? event.summary)}</strong></p>` +
          `<p><strong>When:</strong> ${escHtml(whenLabel)} (${escHtml(timezone)})</p>` +
          (icsLocation ? `<p><strong>Where:</strong> ${escHtml(icsLocation)}</p>` : "") +
          (note ? `<p>${escHtml(note)}</p>` : ""),
          { organizerEmail, organizerName }
        );
        await send(att.email, inviteIcs, `Invitation: ${finalSummary ?? event.summary}`, html, `You've been invited to "${finalSummary ?? event.summary}".\n\nWhen: ${whenLabel} (${timezone})`, "invite.ics");
      }

      // KEPT → update notification with the new schedule.
      for (const att of kept) {
        if (att.email.toLowerCase() === organizerEmail.toLowerCase()) continue;
        const headline = note ? "The event has been rescheduled." : "The event has been updated.";
        const html = buildCleanEmailHtml(
          `<p>${escHtml(headline)}</p>` +
          `<p><strong>New time:</strong> ${escHtml(whenLabel)} (${escHtml(timezone)})</p>` +
          (note ? `<p>${escHtml(note)}</p>` : ""),
          { organizerEmail, organizerName }
        );
        await send(att.email, updateIcs, `Updated: ${finalSummary ?? event.summary}`, html, `${headline}\n\nNew time: ${whenLabel} (${timezone})` + (note ? `\n\n${note}` : ""), "updated-invite.ics");
      }

      return { notified, failed: sendErrors };
    });

    const transaction: Prisma.PrismaPromise<unknown>[] = [
      db.event.update({
        where: { id },
        data: {
          start: startUtc,
          end: endUtc,
          timezone,
          description: finalDescription,
          rescheduledAt: new Date(),
          rescheduleNote: body.note?.trim() || null,
          status: "SCHEDULED",
          sequence: nextSequence,
          ...(finalSummary !== undefined ? { summary: finalSummary } : {}),
          ...(finalLocation !== undefined ? { location: finalLocation } : {}),
          ...(reminderMinutes !== undefined ? { reminderMinutes } : {}),
        },
      }),
      // Proposals satisfied by the accepted new time.
      db.eventProposal.updateMany({
        where: { eventId: id, status: "PENDING" },
        data: { status: "ACCEPTED" },
      }),
    ];

    if (attendeeInput !== undefined) {
      const emails = attendeeInput.map((a) => a.email.toLowerCase());
      transaction.push(
        db.attendee.deleteMany({ where: { eventId: id, email: { notIn: emails } } })
      );
      for (const a of attendeeInput) {
        const email = a.email.toLowerCase();
        transaction.push(
          db.attendee.upsert({
            where: { eventId_email: { eventId: id, email } },
            create: { eventId: id, email, name: a.name ?? null, type: a.type ?? null },
            update: { name: a.name ?? null, type: a.type ?? null },
          })
        );
      }
    }

    await db.$transaction(transaction);

    const delivery = notifyResult as { notified?: number; failed?: string[] } | undefined;
    if (delivery?.failed?.length) {
      console.warn("[events:reschedule] update emails failed for:", delivery.failed.join(", "));
    }
    return NextResponse.json({
      ok: true,
      start: startUtc.toISOString(),
      end: endUtc.toISOString(),
      notified: delivery?.notified ?? 0,
      notifyFailed: delivery?.failed ?? [],
    });
  } catch (err) {
    if (err instanceof AuthExpiredError) {
      return NextResponse.json({ error: err.message, code: "AUTH_EXPIRED" }, { status: 401 });
    }
    console.error("[events:reschedule]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reschedule" },
      { status: 500 }
    );
  }
}
