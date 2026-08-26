import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isGoogleConfigured, isResendCalendarConfigured } from "@/lib/env";
import { createSmartMultiSlotEventsAndInvite, parseCreateInput } from "@/lib/events-service";
import { withFreshGoogleClient, AuthExpiredError } from "@/lib/google-auth";
import { getOrCreateCalendarAlias } from "@/lib/resend/calendar-email";
import { eventTitleForSlot, parseSmartEventDocument } from "@/lib/smart-event-schema";

/**
 * Resend RSVP comparison path.
 *
 * It intentionally accepts the same reviewed Smart Event document as the
 * existing drawer endpoint. Google creates Calendar/Meet records silently;
 * only Resend SMTP delivers the Workable-style iMIP messages.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required", code: "AUTH_REQUIRED" }, { status: 401 });
  }
  if (!isGoogleConfigured()) {
    return NextResponse.json({ error: "Google OAuth is not configured." }, { status: 503 });
  }
  if (!isResendCalendarConfigured()) {
    return NextResponse.json(
      { error: "Resend RSVP is not configured. Add the RESEND_* server environment variables." },
      { status: 503 }
    );
  }
  if (!session.accessToken) {
    return NextResponse.json(
      { error: "Your Google session expired. Reconnect Google and try again.", code: "AUTH_EXPIRED" },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const organizerEmail = session.user.email.toLowerCase();
  let smartDocument;
  try {
    smartDocument = parseSmartEventDocument(body.smartDocument);
    smartDocument.organizer.email = organizerEmail;
    smartDocument.organizer.fullName =
      session.user.name?.trim() || smartDocument.organizer.fullName || organizerEmail.split("@")[0];
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  const slotDocuments = smartDocument.event.slots.map((slot) => ({
    ...smartDocument,
    event: {
      ...smartDocument.event,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
    },
  }));

  let inputs: ReturnType<typeof parseCreateInput>[];
  try {
    inputs = slotDocuments.map((document, index) =>
      parseCreateInput({
        summary: eventTitleForSlot(document.event.title, index, slotDocuments.length),
        description: document.event.description,
        location:
          document.event.location.type === "online" && document.event.location.provider === "google"
            ? undefined
            : document.event.location.value ?? undefined,
        start: `${document.event.date}T${document.event.startTime}`,
        end: `${document.event.date}T${document.event.endTime}`,
        timezone: document.event.timezone,
        attendees: document.attendees.map((attendee) => ({
          email: attendee.email,
          name: attendee.fullName,
          type: attendee.type,
        })),
        emailSubject: `Invitation: ${document.event.title}`,
      })
    );
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  const linked = Object.fromEntries(
    smartDocument.linkedTo.map((record) => [record.type.toLowerCase(), record.label])
  );
  const inviteMessages = Array.isArray(body.inviteMessages)
    ? (body.inviteMessages as {
        tab: "candidate" | "contact" | "internal";
        subject?: string;
        body?: string;
        bodyHtml?: string;
      }[]).filter(
        (message) =>
          message &&
          ["candidate", "contact", "internal"].includes(message.tab) &&
          Boolean(message.bodyHtml?.trim() || message.body?.trim())
      )
    : [];
  const messageTabs = new Set(inviteMessages.map((message) => message.tab));
  const missingAudience = smartDocument.audiences.find((audience) => !messageTabs.has(audience.type));
  if (missingAudience) {
    return NextResponse.json(
      { error: `Missing reviewed ${missingAudience.type} invitation.` },
      { status: 400 }
    );
  }

  try {
    const organizerAlias = await getOrCreateCalendarAlias(organizerEmail);
    const dtos = await withFreshGoogleClient(session.accessToken, organizerEmail, (client) =>
      createSmartMultiSlotEventsAndInvite({
        accessToken: client.credentials.access_token ?? session.accessToken!,
        refreshToken: client.credentials.refresh_token ?? null,
        organizerEmail,
        organizerAlias,
        deliveryMode: "resend",
        inputs,
        slotDocuments,
        baseDocument: smartDocument,
        conference:
          smartDocument.event.location.type === "online" &&
          smartDocument.event.location.provider === "google",
        reminderMinutes: smartDocument.event.reminderMinutes ?? null,
        eventType: smartDocument.event.type.name,
        organizationName: linked.organization ?? null,
        linkedTitle: linked.job ?? linked.opportunity ?? null,
        linked,
        inviteMessages,
        // Critical: Google stores the real events but must not send a second
        // invitation. Resend is the sole delivery transport for this mode.
        googleSendUpdates: "none",
      })
    );
    return NextResponse.json({ ...dtos[0], events: dtos, count: dtos.length }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthExpiredError) {
      return NextResponse.json({ error: error.message, code: "AUTH_EXPIRED" }, { status: 401 });
    }
    console.error("[resend-events:create]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create Resend RSVP event" },
      { status: 500 }
    );
  }
}
