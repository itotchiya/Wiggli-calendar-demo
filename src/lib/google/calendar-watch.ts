import { randomBytes, randomUUID } from "node:crypto";
import { google } from "googleapis";
import { db } from "../prisma";
import { appUrl } from "../env";
import type { getGoogleClient } from "./calendar";

type GoogleClient = ReturnType<typeof getGoogleClient>;

/**
 * Google Calendar push notifications (events.watch).
 * Google POSTs to our HTTPS webhook whenever the organizer's primary calendar
 * changes — e.g. a candidate clicks Yes on one slot's Gmail card. The ping has
 * no payload; the webhook pulls the recent changes itself.
 *
 * Channels live at most 7 days and cannot be renewed in place, so a new one
 * is opened when the stored channel is within a day of expiring.
 */
const RENEW_BEFORE_MS = 24 * 60 * 60_000;

/** Public HTTPS address Google should call; null when unreachable (plain localhost). */
export function calendarWebhookAddress(): string | null {
  const explicit = process.env.GOOGLE_CALENDAR_WEBHOOK_URL?.trim();
  if (explicit) return explicit;
  const base = appUrl();
  if (!base.startsWith("https://")) return null;
  return `${base}/api/google/calendar-webhook`;
}

export async function ensureCalendarWatch(client: GoogleClient, organizerEmail: string): Promise<void> {
  const address = calendarWebhookAddress();
  if (!address) return;
  const email = organizerEmail.toLowerCase();
  const account = await db.organizerAccount.findUnique({ where: { email } });
  if (
    account?.calendarChannelId &&
    account.calendarChannelAddress === address &&
    account.calendarChannelExpiresAt &&
    account.calendarChannelExpiresAt.getTime() - Date.now() > RENEW_BEFORE_MS
  ) {
    return;
  }

  const calendar = google.calendar({ version: "v3", auth: client });
  const id = randomUUID();
  const token = randomBytes(24).toString("hex");
  const response = await calendar.events.watch({
    calendarId: "primary",
    requestBody: { id, type: "web_hook", address, token },
  });
  const expiresAt = response.data.expiration ? new Date(Number(response.data.expiration)) : null;

  await db.organizerAccount.upsert({
    where: { email },
    update: {
      calendarChannelId: id,
      calendarChannelResourceId: response.data.resourceId ?? null,
      calendarChannelToken: token,
      calendarChannelAddress: address,
      calendarChannelExpiresAt: expiresAt,
    },
    create: {
      email,
      calendarChannelId: id,
      calendarChannelResourceId: response.data.resourceId ?? null,
      calendarChannelToken: token,
      calendarChannelAddress: address,
      calendarChannelExpiresAt: expiresAt,
    },
  });

  // Stop the channel being replaced so Google does not ping us twice.
  if (account?.calendarChannelId && account.calendarChannelResourceId) {
    await calendar.channels
      .stop({ requestBody: { id: account.calendarChannelId, resourceId: account.calendarChannelResourceId } })
      .catch(() => undefined);
  }
}
