import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isGoogleConfigured } from "@/lib/env";
import {
  createEventAndInvite,
  createSmartMultiSlotEventsAndInvite,
  parseCreateInput,
  type InviteThreadState,
} from "@/lib/events-service";
import { withFreshGoogleClient, AuthExpiredError } from "@/lib/google-auth";
import { eventTitleForSlot, parseSmartEventDocument } from "@/lib/smart-event-schema";

/**
 * Backend glue for the prototype EventDrawer (port of Wiggli-prototype).
 * Receives the drawer's reviewed Smart Event document, including one or more
 * date/time slots, and runs the real pipeline once per slot: silent Google
 * Calendar insert → branded METHOD:REQUEST invite per attendee.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required", code: "AUTH_REQUIRED" }, { status: 401 });
  }
  if (!isGoogleConfigured()) {
    return NextResponse.json({ error: "Google OAuth is not configured." }, { status: 503 });
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

  const organizerEmail = session.user.email!.toLowerCase();
  let smartDocument;
  try {
    smartDocument = parseSmartEventDocument(body.smartDocument);
    smartDocument.organizer.email = organizerEmail;
    smartDocument.organizer.fullName =
      session.user.name?.trim() || smartDocument.organizer.fullName || organizerEmail.split("@")[0];
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
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
  let inputs: ReturnType<typeof parseCreateInput>[] = [];
  try {
    inputs = slotDocuments.map((document, index) => parseCreateInput({
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
    }));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
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
      }[]).filter((message) =>
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
    const dtos = await withFreshGoogleClient(session.accessToken, organizerEmail, async (client) => {
      // Multi-slot: N emails (one per slot, each with its own single-VEVENT
      // ICS) chained into ONE Gmail thread — one inbox row in collapsed
      // view, all N native Yes/No/Maybe cards stacked when expanded.
      if (inputs.length > 1) {
        const emailThreads = new Map<string, InviteThreadState>();
        return createSmartMultiSlotEventsAndInvite({
          accessToken: client.credentials.access_token ?? session.accessToken!,
          refreshToken: client.credentials.refresh_token ?? null,
          organizerEmail,
          inputs,
          slotDocuments,
          baseDocument: smartDocument,
          conference:
            smartDocument.event.location.type === "online" && smartDocument.event.location.provider === "google",
          reminderMinutes: smartDocument.event.reminderMinutes ?? null,
          eventType: smartDocument.event.type.name,
          organizationName: linked.organization ?? null,
          linkedTitle: linked.job ?? linked.opportunity ?? null,
          linked,
          inviteMessages,
          emailThreads,
          googleSendUpdates: "none",
        });
      }
      const created: Awaited<ReturnType<typeof createEventAndInvite>>[] = [];
      const emailThreads = new Map<string, InviteThreadState>();
      for (const [index, input] of inputs.entries()) {
        created.push(await createEventAndInvite({
          accessToken: client.credentials.access_token ?? session.accessToken!,
          refreshToken: client.credentials.refresh_token ?? null,
          organizerEmail,
          input,
          conference:
            smartDocument.event.location.type === "online" && smartDocument.event.location.provider === "google",
          meetLink: null,
          reminderMinutes: smartDocument.event.reminderMinutes ?? null,
          eventType: smartDocument.event.type.name,
          organizationName: linked.organization ?? null,
          linkedTitle: linked.job ?? linked.opportunity ?? null,
          smartDocument: slotDocuments[index],
          linked,
          inviteMessages,
          emailThreads,
        }));
      }
      return created;
    });
    return NextResponse.json({ ...dtos[0], events: dtos, count: dtos.length }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthExpiredError) {
      return NextResponse.json({ error: err.message, code: "AUTH_EXPIRED" }, { status: 401 });
    }
    console.error("[drawer-events:create]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create event" },
      { status: 500 }
    );
  }
}
