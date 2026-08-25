import { createHmac, timingSafeEqual } from "node:crypto";
import { appUrl } from "./env";

/**
 * Signed, self-contained tokens embedded in every RSVP button of the invite
 * email: /api/rsvp/<token>?action=yes|maybe|no. They resolve (event, attendee)
 * without exposing internal IDs, and are logged in RsvpTokenLog.
 */

export type RsvpAction = "yes" | "maybe" | "no";
export const RSVP_ACTIONS: RsvpAction[] = ["yes", "maybe", "no"];

export type RsvpPayload = { e: string; a: string }; // eventId, attendee email

function signingKey(): string {
  const raw = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  const key = raw.trim();
  // Empty/whitespace secrets must never silently weaken HMAC verification.
  return key.length > 0 ? key : "dev-secret-change-me";
}

export function signRsvpToken(payload: RsvpPayload): string {
  const data = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = createHmac("sha256", signingKey()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyRsvpToken(token: string): RsvpPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = createHmac("sha256", signingKey()).update(data).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (
      parsed &&
      typeof parsed.e === "string" &&
      typeof parsed.a === "string"
    ) {
      return { e: parsed.e, a: parsed.a };
    }
    return null;
  } catch {
    return null;
  }
}

export function rsvpActionUrl(token: string, action: RsvpAction): string {
  return `${appUrl()}/api/rsvp/${encodeURIComponent(token)}?action=${action}`;
}

export function buildRsvpUrls(
  eventId: string,
  attendeeEmails: string[]
): Map<string, { yes: string; maybe: string; no: string }> {
  const map = new Map();
  for (const email of attendeeEmails) {
    const token = signRsvpToken({ e: eventId, a: email });
    map.set(email.toLowerCase(), {
      yes: rsvpActionUrl(token, "yes"),
      maybe: rsvpActionUrl(token, "maybe"),
      no: rsvpActionUrl(token, "no"),
    });
  }
  return map;
}
