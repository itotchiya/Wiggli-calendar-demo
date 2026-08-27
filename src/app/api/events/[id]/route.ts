import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isGoogleConfigured } from "@/lib/env";
import { db } from "@/lib/prisma";
import { cancelGoogleEvent } from "@/lib/google/calendar";
import { withFreshGoogleClient, AuthExpiredError } from "@/lib/google-auth";

/**
 * Cancel & delete an event: removes it from the organizer's Google Calendar
 * and marks our local row CANCELLED. Per Google docs, events.delete with
 * sendUpdates:"all" emails every guest a METHOD:CANCEL notice — their calendar
 * copies are removed (or shown as cancelled), which is exactly the behaviour
 * of cancelling from Google Calendar itself.
 *
 * DELETE /api/events/:id
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required", code: "AUTH_REQUIRED" }, { status: 401 });
  }
  if (!isGoogleConfigured()) {
    return NextResponse.json({ error: "Google OAuth is not configured." }, { status: 503 });
  }

  const { id } = await params;
  const event = await db.event.findUnique({ where: { id }, include: { attendees: true } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  try {
    await withFreshGoogleClient(session.accessToken!, event.organizerEmail, async (client) => {
      const accessToken = client.credentials.access_token ?? session.accessToken!;
      // Only touch Google when we actually created the remote event.
      if (event.googleEventId) {
        try {
          await cancelGoogleEvent(accessToken, event.googleEventId, "all");
        } catch (err) {
          // A 410 means it's already gone on Google — treat as success.
          const status = (err as { code?: number; response?: { data?: { error?: { code?: number } } } });
          const code = status?.code ?? status?.response?.data?.error?.code;
          if (code !== 404 && code !== 410) throw err;
        }
      }
    });

    await db.event.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ ok: true, status: "CANCELLED" });
  } catch (err) {
    if (err instanceof AuthExpiredError) {
      return NextResponse.json({ error: err.message, code: "AUTH_EXPIRED" }, { status: 401 });
    }
    console.error("[events:delete]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to cancel event" },
      { status: 500 }
    );
  }
}
