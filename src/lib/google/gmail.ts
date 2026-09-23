import { randomUUID } from "node:crypto";
import type { OAuth2Client } from "google-auth-library";

export type InlineImage = {
  cid: string; // referenced from HTML as <img src="cid:...">
  contentType: string; // e.g. image/png
  filename: string;
  data: Buffer;
};

export type InviteEmailInput = {
  from: string; // the authenticated organizer's Gmail address
  to: string[]; // attendee addresses
  subject: string;
  html: string;
  text: string;
  icsContent: string; // full METHOD:REQUEST (or CANCEL) calendar body
  /** Must match the VCALENDAR METHOD inside icsContent. Defaults to REQUEST. */
  icsMethod?: "REQUEST" | "CANCEL";
  icsFilename?: string;
  replyTo?: string;
  /** Gmail thread to append this message to after the first slot invitation. */
  threadId?: string;
  /** RFC Message-ID for this MIME message and reply threading headers. */
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  /** Optional provider idempotency header (used by Resend SMTP retries). */
  idempotencyKey?: string;
  /** SMTP raw messages need an explicit Date; Gmail API supplies its own. */
  date?: Date;
  /** Small brand icons embedded into the HTML via cid: references. */
  inlineImages?: InlineImage[];
};

function b64(s: string): string {
  return Buffer.from(s, "utf8").toString("base64");
}

function foldedB64(s: string): string {
  // RFC 2045 soft-wraps base64 bodies at 76 chars.
  return b64(s).replace(/(.{76})/g, "$1\r\n");
}

function encodedSubject(subject: string): string {
  // RFC 2047: subjects must be ASCII-safe in raw MIME.
  if (/^[\x20-\x7e\r\n\t]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${b64(subject)}?=`;
}

/**
 * Compose the invitation MIME in the APPLE-CANONICAL structure:
 *
 * multipart/mixed
 * ├── multipart/alternative
 * │   ├── text/plain
 * │   ├── text/calendar; method=REQUEST   ← inline iMIP part (Apple Mail's
 * │   │                                      parser only descends into
 * │   │                                      alternative groups; an extra
 * │   │                                      related wrapper makes it miss
 * │   │                                      the invite and fall back to
 * │   │                                      Siri "found an event" detection)
 * │   └── text/html                       ← branded/custom body
 * └── application/ics                     ← invite.ics attachment (Gmail /
 *                                            Outlook "Add to calendar")
 *
 * No multipart/related layer: cid: embedded images are incompatible with the
 * layout Apple's iMIP recognizer requires, so emails stay image-free.
 */
export function buildInviteMime(input: InviteEmailInput): string {
  const altBoundary = `=_wiggli_alt_${randomUUID()}`;
  const mixedBoundary = `=_wiggli_mixed_${randomUUID()}`;
  const filename = input.icsFilename ?? "invite.ics";

  const textPart = [
    "--" + altBoundary,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    foldedB64(input.text),
  ].join("\r\n");

  const htmlPart = [
    "--" + altBoundary,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    foldedB64(input.html),
  ].join("\r\n");

  // RFC 6047 §2: the METHOD parameter on the calendar body MUST match the
  // VCALENDAR METHOD — Apple checks this pair before engaging its RSVP UI.
  const calendarPart = [
    `--${altBoundary}`,
    `Content-Type: text/calendar; method=${input.icsMethod ?? "REQUEST"}; charset="UTF-8"; component="VEVENT"; name="` + filename + '"',
    "Content-Disposition: inline; filename=\"" + filename + "\"",
    "Content-Transfer-Encoding: base64",
    "",
    foldedB64(input.icsContent),
  ].join("\r\n");

  // Order inside the alternative group matters for some pickers, but every
  // part being siblings in ONE alternative group is what Mail requires.
  const alternativePart = [
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    [textPart, calendarPart, htmlPart, "--" + altBoundary + "--"].join("\r\n"),
  ].join("\r\n");

  const icsAttachmentPart = [
    `--${mixedBoundary}`,
    'Content-Type: application/ics; name="' + filename + '"',
    "Content-Class: urn:content-classes:calendarmessage",
    `Content-Disposition: attachment; filename="${filename}"`,
    "Content-Transfer-Encoding: base64",
    "",
    foldedB64(input.icsContent),
  ].join("\r\n");

  const headers = [
    `From: ${input.from}`,
    `To: ${input.to.join(", ")}`,
    `Subject: ${encodedSubject(input.subject)}`,
    `Message-ID: ${input.messageId ?? `<wiggli-${randomUUID()}@calendar.wiggli.local>`}`,
    ...(input.inReplyTo ? [`In-Reply-To: ${input.inReplyTo}`] : []),
    ...(input.references?.length ? [`References: ${input.references.join(" ")}`] : []),
    ...(input.replyTo ? [`Reply-To: ${input.replyTo}`] : []),
    ...(input.date ? [`Date: ${input.date.toUTCString()}`] : []),
    ...(input.idempotencyKey ? [`Resend-Idempotency-Key: ${input.idempotencyKey}`] : []),
    "MIME-Version: 1.0",
    "Content-Class: urn:content-classes:calendarmessage",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
  ];

  const mime = [
    headers.join("\r\n"),
    "",
    alternativePart,
    icsAttachmentPart,
    `--${mixedBoundary}--`,
  ].join("\r\n");

  return mime;
}

/** Deliver via the Gmail API using the organizer's OAuth2 client. */
export async function sendInviteEmail(
  auth: OAuth2Client,
  input: InviteEmailInput
): Promise<{ messageId: string; rfcMessageId: string; threadId?: string }> {
  const { google } = await import("googleapis");
  const gmail = google.gmail({ version: "v1", auth });
  const rfcMessageId = input.messageId ?? `<wiggli-${randomUUID()}@calendar.wiggli.local>`;
  const raw = buildInviteMime({ ...input, messageId: rfcMessageId });

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      ...(input.threadId ? { threadId: input.threadId } : {}),
      // base64url per Gmail API requirement
      raw: Buffer.from(raw, "utf8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, ""),
    },
  });

  let deliveredRfcMessageId = rfcMessageId;
  // Gmail REGENERATES the Message-ID of outgoing messages (our custom
  // <wiggli-…@calendar.wiggli.local> never survives delivery), so reply
  // chaining must use Gmail's own RFC id. Read it back right after sending.
  try {
    const meta = await gmail.users.messages.get({
      userId: "me",
      id: response.data.id!,
      format: "metadata",
      metadataHeaders: ["Message-ID"],
    });
    const hdr = meta.data.payload?.headers?.find(
      (h) => h.name?.toLowerCase() === "message-id"
    );
    if (hdr?.value) deliveredRfcMessageId = hdr.value;
  } catch {
    // fall back to the id we asked for
  }

  return {
    messageId: response.data.id ?? "",
    rfcMessageId: deliveredRfcMessageId,
    threadId: response.data.threadId ?? undefined,
  };
}
