import type { SmartAudience, SmartEventDocument, SmartEventSlot } from "./smart-event-schema";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function greetingVariable(audience: SmartAudience): string {
  if (audience === "contact") return "[Contact.First_name]";
  if (audience === "internal") return "[Internal.First_name]";
  return "[Candidate.First_name]";
}

function whereLine(document: SmartEventDocument): string | null {
  const location = document.event.location;
  if (location.type === "online") return `<li>Where: Online - [Meeting.Link]</li>`;
  if (location.type === "company") return `<li>Where: Company address - [Event.Location]</li>`;
  if (location.type === "custom") return `<li>Where: Other location - [Event.Location]</li>`;
  return null;
}

export function buildSmartSlotNoticeHtml(document: SmartEventDocument): string {
  if (document.event.slots.length <= 1) return "";
  const options = document.event.slots
    .map(
      (_, index) =>
        `<li>Slot ${index + 1}: [Slot.${index + 1}.Date] - [Slot.${index + 1}.Start_time] to [Slot.${index + 1}.End_time]</li>`
    )
    .join("");
  return [
    `<div data-smart-block="multi-slot-note" style="margin:16px 0;font-size:13px;line-height:1.6;color:#334155;">`,
    `<p style="margin:0 0 6px;font-weight:600;color:#1e293b;">You will receive ${document.event.slots.length} calendar invitations — one for each proposed slot:</p>`,
    `<ul style="margin:0 0 8px;padding-left:18px;">${options}</ul>`,
    `<p style="margin:6px 0 0;">Please reply <strong>Yes</strong> only to the slot that suits you, and <strong>No</strong> to all others. Your answers let us pick the time that works for you.</p>`,
    `</div>`,
  ].join("");
}

export function buildSmartSlotNoticeText(document: SmartEventDocument): string {
  if (document.event.slots.length <= 1) return "";
  const options = document.event.slots
    .map((slot, index) => `Slot ${index + 1}: ${slot.date} - ${slot.startTime} to ${slot.endTime}`)
    .join("\n");
  return [
    `AVAILABILITY — please choose your slot`,
    `You will receive ${document.event.slots.length} separate calendar invitations (one per option). Reply YES only to the slot that suits you and NO to all the others.`,
    options,
    `Your answers show us everyone's availability so we can confirm the final time that works for all attendees.`,
  ].join("\n");
}

/**
 * Ensure the reviewed email HTML carries the CURRENT styled multi-slot note.
 * Drafts created before a styling change embed an older, unstyled copy of the
 * block — this upserts (replaces any existing block, or appends one after the
 * last top-level element) so every sent email matches the live template.
 */
export function withStyledSlotNotice(reviewedHtml: string, document: SmartEventDocument): string {
  const notice = buildSmartSlotNoticeHtml(document);
  if (!notice) {
    // Single-slot: strip any stale note block.
    return reviewedHtml.replace(/<div[^>]*data-smart-block="multi-slot-note"[\s\S]*?<\/div>\s*/gi, "");
  }
  const blockRe = /<div[^>]*data-smart-block="multi-slot-note"[\s\S]*?<\/div>/i;
  if (blockRe.test(reviewedHtml)) return reviewedHtml.replace(blockRe, notice);
  // No embedded note: append before the RSVP note/signature if present, else at end.
  const anchorRe = /(<div[^>]*data-smart-block="(rsvp-note|signature)")/i;
  if (anchorRe.test(reviewedHtml)) return reviewedHtml.replace(anchorRe, `${notice}$1`);
  return `${reviewedHtml}${notice}`;
}

export function slotNoticeText(slots: SmartEventSlot[], activeIndex: number): string {
  if (slots.length <= 1) return "";
  return [
    "Availability options",
    `This invitation is for Slot ${activeIndex + 1} of ${slots.length}. You will receive one calendar invitation for each option. Please accept the option that works best for you and decline the others.`,
    slots.map((slot, index) => `Slot ${index + 1}: ${slot.date} - ${slot.startTime} to ${slot.endTime}`).join("\n"),
  ].join("\n");
}

export const DEFAULT_SMART_SIGNATURE_HTML = [
  "<p>Best regards,</p>",
  "<p><strong>Mustapha Boufous</strong><br/>",
  '<a href="tel:+212636857897">+212636857897</a><br/>',
  '<a href="mailto:toozmust@gmail.com">toozmust@gmail.com</a></p>',
  "<p><strong>The Wiggli Team</strong></p>",
].join("");

export function buildSmartInvitationHtml(
  document: SmartEventDocument,
  audience: SmartAudience,
  contextParagraph: string
): string {
  const description = document.event.description
    ? `<li>Description: [Event.Description]</li>`
    : "";
  const where = whereLine(document) ?? "";
  const slotNotice = buildSmartSlotNoticeHtml(document);
  // Only one supporting text at the bottom: multi-slot uses slotNotice's wording, single uses rsvp-note
  const rsvpNote = slotNotice
    ? ""
    : `<div data-smart-block="rsvp-note"><p>Please reply with <strong>Yes</strong>, <strong>Maybe</strong>, or <strong>No</strong> to confirm your attendance. Your response will be recorded automatically.</p></div>`;
  return [
    `<div data-smart-block="greeting"><p>Hello ${greetingVariable(audience)},</p></div>`,
    `<div data-smart-block="ai-context"><p>${escapeHtml(contextParagraph)}</p></div>`,
    `<div data-smart-block="event-details">`,
    `<p><strong>Event details</strong></p>`,
    `<ul>`,
    `<li>Title: [Event.Title]</li>`,
    description,
    `<li>When: [Event.Date] - [Event.Start_time] to [Event.End_time]</li>`,
    where,
    `<li>Organizer: [Organizer.Name] ([Organizer.Email])</li>`,
    `<li>Guests:<br/>[Attendees.List]</li>`,
    `</ul>`,
    `</div>`,
    slotNotice,
    rsvpNote,
  ].join("");
}

/** Minimal server-side sanitizer for the controlled rich editor output. */
export function sanitizeReviewedEmailHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form)[^>]*\/?\s*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
}

export function emailHtmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
