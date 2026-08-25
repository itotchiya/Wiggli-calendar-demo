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
  icsContent: string; // full METHOD:REQUEST calendar body
  icsFilename?: string;
  replyTo?: string;
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
 * Compose the classic invitation MIME structure that maximizes compatibility:
 *
 * multipart/mixed
 * ├── multipart/related              ← HTML + its inline brand images
 * │   ├── multipart/alternative
 * │   │   ├── text/plain
 * │   │   └── text/html              ← branded/custom body (<img src="cid:…">)
 * │   └── image/png ×N               ← Content-ID icons, disposition inline
 * ├── text/calendar; method=REQUEST  ← Apple Mail inline RSVP
 * └── application/ics (attachment)   ← Gmail / Outlook "Add to calendar"
 */
export function buildInviteMime(input: InviteEmailInput): string {
  const altBoundary = `=_wiggli_alt_${randomUUID()}`;
  const relBoundary = `=_wiggli_rel_${randomUUID()}`;
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

  const alternativePart = [
    textPart,
    htmlPart,
    "--" + altBoundary + "--",
  ].join("\r\n");

  const imageParts = (input.inlineImages ?? []).map((img) =>
    [
      `--${relBoundary}`,
      `Content-Type: ${img.contentType}; name="${img.filename}"`,
      `Content-Disposition: inline; filename="${img.filename}"`,
      `Content-ID: <${img.cid}>`,
      "Content-Transfer-Encoding: base64",
      "",
      foldedB64(img.data.toString("base64")),
    ].join("\r\n")
  );

  // related: alternative root + inline leaf images
  const relatedPart = [
    `--${mixedBoundary}`,
    `Content-Type: multipart/related; boundary="${relBoundary}"; type="text/html"`,
    "",
    [
      `--${relBoundary}`,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      "",
      alternativePart,
    ].join("\r\n"),
    ...imageParts,
    "--" + relBoundary + "--",
  ].join("\r\n");

  const calendarInlinePart = [
    `--${mixedBoundary}`,
    'Content-Type: text/calendar; method=REQUEST; charset="UTF-8"',
    `Content-Disposition: inline; filename="${filename}"`,
    "Content-Transfer-Encoding: base64",
    "",
    foldedB64(input.icsContent),
  ].join("\r\n");

  const icsAttachmentPart = [
    `--${mixedBoundary}`,
    'Content-Type: application/ics; name="' + filename + '"',
    `Content-Disposition: attachment; filename="${filename}"`,
    "Content-Transfer-Encoding: base64",
    "",
    foldedB64(input.icsContent),
  ].join("\r\n");

  const headers = [
    `From: ${input.from}`,
    `To: ${input.to.join(", ")}`,
    `Subject: ${encodedSubject(input.subject)}`,
    ...(input.replyTo ? [`Reply-To: ${input.replyTo}`] : []),
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
  ];

  const mime = [
    headers.join("\r\n"),
    "",
    relatedPart,
    calendarInlinePart,
    icsAttachmentPart,
    `--${mixedBoundary}--`,
  ].join("\r\n");

  return mime;
}

/** Deliver via the Gmail API using the organizer's OAuth2 client. */
export async function sendInviteEmail(
  auth: OAuth2Client,
  input: InviteEmailInput
): Promise<{ messageId: string; threadId?: string }> {
  const { google } = await import("googleapis");
  const gmail = google.gmail({ version: "v1", auth });
  const raw = buildInviteMime(input);

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      // base64url per Gmail API requirement
      raw: Buffer.from(raw, "utf8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, ""),
    },
  });

  return {
    messageId: response.data.id ?? "",
    threadId: response.data.threadId ?? undefined,
  };
}
