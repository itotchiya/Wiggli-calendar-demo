import { formatEventRange } from "./format";

/** Minimal email-safe wrapper: user-styled body + organizer signature.
 *  No branded frame — basic HTML only (bold variables, bulleted details). */
export function buildCleanEmailHtml(
  styledBodyHtml: string,
  opts: { organizerEmail: string; organizerName?: string; signatureHtml?: string }
): string {
  const name = opts.organizerName ?? opts.organizerEmail.split("@")[0];
  const sig =
    opts.signatureHtml ??
    `<div style="margin-top:22px;padding-top:14px;border-top:1px solid #e5e7eb;color:#374151;font-size:13px;line-height:1.5;">
       <div style="font-weight:600;">${name}</div>
       <div style="color:#6b7280;">BE +324****5992</div>
       <div style="color:#6b7280;">${opts.organizerEmail}</div>
     </div>`;
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#ffffff;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;
            font-family:'Inter',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
            color:#1f2937;font-size:15px;line-height:1.65;">
${styledBodyHtml}
${sig}
</div>
</body></html>`;
}

/**
 * Default branded HTML invite — clean mint design with emoji accents.
 * No embedded images (Gmail-safe), no custom RSVP buttons: attendees respond
 * with their calendar app's NATIVE Yes/Maybe/No on the attached METHOD:REQUEST
 * invite, and those responses auto-sync into the app (see lib/sync-service).
 *
 * Client-safe: no node imports (the live preview renders the real thing).
 */

export const MINT = {
  700: "#0b7a5e",
  600: "#0f9d76",
  500: "#14b88a",
  100: "#d8f3e6",
  50: "#effaf4",
} as const;

function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type InviteContext = {
  event: {
    summary: string;
    description?: string | null;
    location?: string | null;
    startUtc: Date;
    endUtc: Date;
    timezone: string;
  };
  attendeeNameOrEmail: string;
  organizerEmail: string;
  /** Everyone invited, so recipients know who else is coming. */
  attendees: { name: string; email: string; role?: string }[];
  /** Real Google Meet URL when a conference was provisioned. */
  meetUrl?: string | null;
  /** Reminder label like "15 minutes before" (null = no reminder). */
  reminderLabel?: string | null;
  /** When set, this AI/user-crafted text is shown as the email's message body. */
  customBodyText?: string;
};

/**
 * The full default branded email body.
 * `preview: true` is accepted for parity with the live preview (no-op here).
 */
export function buildDefaultInviteHtml(
  ctx: InviteContext,
  _opts: { preview?: boolean } = {}
): string {
  const e = ctx.event;
  const when = formatEventRange(e.startUtc, e.endUtc, e.timezone);
  const meetUrl = ctx.meetUrl ?? null;

  /** Bulleted detail row: mint dot + value (label woven in). */
  const bulletRow = (valueHtml: string) => `
    <tr><td colspan="2" style="padding:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="width:18px;vertical-align:top;padding:5px 8px 0 2px;">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${MINT[500]};"></span>
        </td>
        <td style="vertical-align:top;">
          <div style="color:#1c2b25;font-size:15px;line-height:1.55;">${valueHtml}</div>
        </td>
      </tr></table>
    </td></tr>`;

  const attendeesBullets = ctx.attendees
    .map(
      (a) =>
        `<li style="margin:3px 0;color:#1c2b25;font-size:14px;">${esc(a.name)}${
          a.role === "Organizer"
            ? ` <span style="color:#8a948f;font-size:12px;">· organizer</span>`
            : ""
        }</li>`
    )
    .join("");

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f2f7f4;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;
            font-family:'Inter',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#ffffff;border:1px solid #e3ece7;border-radius:16px;overflow:hidden;">
    <tr>
      <td style="background:linear-gradient(135deg,${MINT[600]},${MINT[500]});padding:22px 28px;">
        <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-.01em;">Wiggli</span>
        <span style="color:rgba(255,255,255,.75);font-size:13px;font-weight:500;">&nbsp;&nbsp;·&nbsp;&nbsp;Invitation</span>
      </td>
    </tr>
    <tr><td style="padding:28px;">
      <p style="margin:0 0 6px;color:#8a948f;font-size:13px;">Hi ${esc(ctx.attendeeNameOrEmail)}, you've been invited</p>
      <h1 style="margin:0 0 20px;color:#1c2b25;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-.01em;">${esc(e.summary)}</h1>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${bulletRow(`<strong>When:</strong> ${esc(when)}`)}
        ${meetUrl ? bulletRow(`<strong>Join:</strong> <a href="${esc(meetUrl)}" style="color:${MINT[600]};font-weight:600;">${esc(meetUrl)}</a>`) : e.location ? bulletRow(`<strong>Where:</strong> ${esc(e.location)}`) : ""}
        ${bulletRow(`<strong>Organizer:</strong> ${esc(ctx.organizerEmail)}`)}
        ${
          ctx.attendees.length > 0
            ? bulletRow(
                `<strong>Attendees (${ctx.attendees.length}):</strong><ul style="margin:4px 0 0;padding-left:18px;">${attendeesBullets}</ul>`
              )
            : ""
        }
      </table>

      ${
        ctx.customBodyText
          ? `<div style="margin-top:18px;padding:16px 18px;background:${MINT[50]};border-radius:12px;
             color:#1c2b25;font-size:14px;line-height:1.6;white-space:pre-wrap;">${esc(ctx.customBodyText)}</div>`
          : e.description
            ? `<div style="margin-top:18px;padding:14px 16px;background:${MINT[50]};border-radius:12px;
               color:#1c2b25;font-size:14px;line-height:1.55;">
               <span style="display:block;color:#8a948f;font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">Details</span>
               ${esc(e.description).replace(/\n/g, "<br/>")}</div>`
            : ""
      }

      <div style="margin-top:22px;padding:14px 16px;background:${MINT[100]};border-radius:12px;text-align:center;">
        <span style="color:${MINT[700]};font-size:14px;font-weight:600;">
          ✅ Yes&nbsp;&nbsp;&nbsp;🤔 Maybe&nbsp;&nbsp;&nbsp;❌ No
        </span><br/>
        <span style="display:block;margin-top:6px;color:#5f6b66;font-size:13px;">
          Respond right from the calendar invitation above (or the attached file) —<br/>
          your answer syncs to the organizer automatically.
        </span>
        ${ctx.reminderLabel ? `<span style="display:block;margin-top:8px;color:#5f6b66;font-size:12px;">⏰ Reminder set: ${esc(ctx.reminderLabel)}.</span>` : ""}
      </div>
    </td></tr>
  </table>

  <p style="text-align:center;color:#9aa5a0;font-size:11px;margin-top:16px;">
    Sent with Wiggli · powered by your own Gmail account
  </p>
</div></body></html>`;
}

/** Plain-text fallback (deliverability + accessibility). */
export function buildDefaultInviteText(ctx: InviteContext): string {
  const e = ctx.event;
  const when = formatEventRange(e.startUtc, e.endUtc, e.timezone);
  return [
    `Hi ${ctx.attendeeNameOrEmail},`,
    "",
    `You've been invited to "${e.summary}".`,
    `When: ${when}`,
    ctx.meetUrl ? `Join: ${ctx.meetUrl}` : e.location ? `Where: ${e.location}` : null,
    `Organizer: ${ctx.organizerEmail}`,
    ctx.attendees.length > 0
      ? `Attendees:\n${ctx.attendees.map((a) => `  • ${a.name} <${a.email}>${a.role ? ` — ${a.role}` : ""}`).join("\n")}`
      : null,
    e.description ? `\nDetails:\n${e.description}` : null,
    ctx.reminderLabel ? `\nReminder: ${ctx.reminderLabel}.` : null,
    "",
    "Please respond using the calendar invitation (Yes / Maybe / No) —",
    "your response syncs to the organizer automatically.",
  ]
    .filter((x): x is string => x !== null)
    .join("\n");
}
