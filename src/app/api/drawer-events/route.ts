import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isGoogleConfigured } from "@/lib/env";
import { createEventAndInvite } from "@/lib/events-service";
import { withFreshGoogleClient, AuthExpiredError } from "@/lib/google-auth";
import { parseCreateInput } from "@/lib/events-service";
import type { AttendeeInput } from "@/types/event";

/**
 * Backend glue for the prototype EventDrawer (port of Wiggli-prototype).
 * Receives the drawer's step-2 "Send invitation" payload:
 *   { title, description?, location?, date, start, end, timezone?,
 *     eventType?, attendees: [{ email, name? }] }
 * and runs the REAL pipeline: silent Google Calendar insert → branded
 * METHOD:REQUEST invite per attendee via the organizer's Gmail.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!isGoogleConfigured()) {
    return NextResponse.json({ error: "Google OAuth is not configured." }, { status: 503 });
  }
  if (!session.accessToken) {
    return NextResponse.json({ error: "Missing Google access token — please sign in again." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Drawer sends a single occurrence: { date: "YYYY-MM-DD", start/end: "HH:mm" }
  // in the prototype's UTC+2 convention. Convert to wall-clock + zone for the
  // shared pipeline. The demo keeps the prototype's Europe-paris-style slot
  // semantics by treating drawer times in the ORGANIZER'S selected zone — we use
  // the browser-reported timezone passed through, defaulting to Europe/Paris.
  const timezone = typeof body.timezone === "string" && body.timezone.trim() ? body.timezone.trim() : "Europe/Paris";
  const date = String(body.date ?? "");
  const start = String(body.start ?? "");
  const end = String(body.end ?? "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
    return NextResponse.json(
      { error: "Expected fields: date (YYYY-MM-DD), start (HH:mm), end (HH:mm)." },
      { status: 400 }
    );
  }

  const rawAttendees = Array.isArray(body.attendees) ? body.attendees : [];
  const seen = new Set<string>();
  const attendees: AttendeeInput[] = [];
  for (const a of rawAttendees as { email?: unknown; name?: unknown; type?: unknown }[]) {
    const email = String(a?.email ?? "").trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    const name = String(a?.name ?? "").trim();
    // Keep the drawer attendee type — it selects which invitation template
    // (candidate/contact/internal) this person receives.
    const type = typeof a?.type === "string" && a.type.trim() ? a.type.trim() : undefined;
    attendees.push({ email, ...(name ? { name } : {}), ...(type ? { type } : {}) });
  }
  if (attendees.length === 0) {
    return NextResponse.json({ error: "At least one attendee is required." }, { status: 400 });
  }

  let input;
  try {
    input = parseCreateInput({
      summary: body.title,
      description: body.description,
      location: typeof body.location === "string" && body.location.trim() ? body.location : undefined,
      start: `${date}T${start}`,
      end: `${date}T${end}`,
      timezone,
      attendees,
      emailSubject: `Invitation: ${String(body.title ?? "Event")}`,
      emailHtml: undefined,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const organizerEmail = session.user.email!.toLowerCase();

  try {
    const dto = await withFreshGoogleClient(session.accessToken, organizerEmail, (client) =>
      createEventAndInvite({
        accessToken: client.credentials.access_token ?? session.accessToken!,
        refreshToken: client.credentials.refresh_token ?? null,
        organizerEmail,
        input,
        conference: Boolean(body.conference),
        meetLink: typeof body.meetLink === "string" ? body.meetLink : null,
        reminderMinutes:
          body.reminderMinutes == null ? null : Math.max(0, Number(body.reminderMinutes) || 0),
        eventType: typeof body.eventType === "string" ? body.eventType : undefined,
        organizationName:
          typeof body.organizationName === "string" ? body.organizationName : null,
        linkedTitle: typeof body.linkedTitle === "string" ? body.linkedTitle : null,
        linked:
          body.linked && typeof body.linked === "object"
            ? Object.fromEntries(
                Object.entries(body.linked as Record<string, unknown>)
                  .filter(([, v]) => typeof v === "string" && v.trim())
                  .map(([k, v]) => [k, String(v).trim()])
              )
            : undefined,
        inviteMessages: Array.isArray(body.inviteMessages)
          ? (body.inviteMessages as {
              tab: "candidate" | "contact" | "internal";
              subject?: string;
              body: string;
            }[]).filter((m) => m && typeof m.body === "string" && m.body.trim())
          : undefined,
      })
    );
    return NextResponse.json(dto, { status: 201 });
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
