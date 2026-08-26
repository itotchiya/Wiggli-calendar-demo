import { createHash } from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";
import { db } from "@/lib/prisma";
import { buildInviteMime } from "@/lib/google/gmail";
import { resendCalendarConfig } from "@/lib/env";

export type ResendCalendarEmail = {
  organizerAlias: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  icsContent: string;
  filename: string;
  messageId: string;
  idempotencyKey: string;
  inReplyTo?: string;
  references?: string[];
};

let transport: Transporter | null = null;

function smtpTransport(): Transporter {
  if (transport) return transport;
  const config = resendCalendarConfig();
  transport = nodemailer.createTransport({
    host: "smtp.resend.com",
    port: 465,
    secure: true,
    auth: { user: "resend", pass: config.apiKey },
    // Calendar batches are intentionally sequential to preserve thread order.
    pool: true,
    maxConnections: 1,
  });
  return transport;
}

function safeDisplayName(value: string): string {
  return value.replace(/[\r\n]/g, " ").replace(/\\/g, "\\\\").replace(/"/g, '\\"').trim();
}

/**
 * Assign one stable organizer address on the verified receiving subdomain.
 * The human organizer remains an ACCEPTED ATTENDEE in the ICS; this alias is
 * the iMIP ORGANIZER so Apple/Google/Outlook replies return through Resend.
 */
export async function getOrCreateCalendarAlias(organizerEmail: string): Promise<string> {
  const { calendarDomain } = resendCalendarConfig();
  const normalizedEmail = organizerEmail.trim().toLowerCase();
  const account = await db.organizerAccount.upsert({
    where: { email: normalizedEmail },
    update: {},
    create: { email: normalizedEmail },
    select: { id: true, calendarAlias: true },
  });
  if (account.calendarAlias) return account.calendarAlias;

  const localPart = `organizer-${account.id.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  const calendarAlias = `${localPart}@${calendarDomain}`;
  const updated = await db.organizerAccount.update({
    where: { id: account.id },
    data: { calendarAlias },
    select: { calendarAlias: true },
  });
  return updated.calendarAlias!;
}

export function buildResendMessageId(input: {
  eventId: string;
  recipientEmail: string;
  sequence: number;
}): string {
  const { calendarDomain } = resendCalendarConfig();
  const digest = createHash("sha256")
    .update(`${input.eventId}:${input.recipientEmail.toLowerCase()}:${input.sequence}`)
    .digest("hex")
    .slice(0, 32);
  return `<wiggli-${digest}@${calendarDomain}>`;
}

/** Send a fully composed raw MIME message; no Gmail account is used here. */
export async function sendResendCalendarEmail(input: ResendCalendarEmail) {
  const { fromName } = resendCalendarConfig();
  const from = `"${safeDisplayName(fromName)}" <${input.organizerAlias}>`;
  const raw = buildInviteMime({
    from,
    replyTo: input.organizerAlias,
    to: [input.to],
    subject: input.subject.replace(/[\r\n]+/g, " ").trim(),
    html: input.html,
    text: input.text,
    icsContent: input.icsContent,
    icsFilename: input.filename,
    messageId: input.messageId,
    inReplyTo: input.inReplyTo,
    references: input.references,
    idempotencyKey: input.idempotencyKey,
    date: new Date(),
  });

  return smtpTransport().sendMail({
    envelope: { from: input.organizerAlias, to: [input.to] },
    raw,
  });
}
