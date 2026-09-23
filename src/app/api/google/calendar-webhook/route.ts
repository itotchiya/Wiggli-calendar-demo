import { after, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { syncGoogleCalendar } from "@/lib/sync-service";
import { withFreshGoogleClient } from "@/lib/google-auth";
import { resolveAcceptedSlotGroups } from "@/lib/slot-groups";

/**
 * Google Calendar push notification receiver (events.watch channel).
 * Google sends headers only; we verify the channel token, answer 200 at once
 * and, after the response, pull the last few minutes of changes with the
 * organizer's stored refresh token and cancel sibling slots of any accepted
 * multi-slot invite.
 */
export const maxDuration = 60;

const LOOKBACK_MS = 10 * 60_000;

export async function POST(req: Request) {
  const channelId = req.headers.get("x-goog-channel-id");
  const token = req.headers.get("x-goog-channel-token");
  const state = req.headers.get("x-goog-resource-state");
  if (!channelId || !token) return new NextResponse(null, { status: 400 });

  const account = await db.organizerAccount.findUnique({ where: { calendarChannelId: channelId } });
  // Unknown or stale channel: 200 without work so Google stops retrying it.
  if (!account || account.calendarChannelToken !== token) return new NextResponse(null, { status: 200 });
  if (state === "sync") return new NextResponse(null, { status: 200 });

  after(async () => {
    try {
      const since = new Date(Date.now() - LOOKBACK_MS);
      await syncGoogleCalendar(undefined, account.email, undefined, since);
      const slots = await withFreshGoogleClient(undefined, account.email, (client) =>
        resolveAcceptedSlotGroups(client, account.email)
      );
      if (slots.cancelledSlots || slots.errors.length) console.info("[calendar-webhook]", account.email, slots);
    } catch (error) {
      console.error("[calendar-webhook]", error);
    }
  });
  return new NextResponse(null, { status: 200 });
}
