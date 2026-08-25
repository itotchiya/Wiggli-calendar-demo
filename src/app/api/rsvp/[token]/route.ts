import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import {
  RSVP_ACTIONS,
  verifyRsvpToken,
  type RsvpAction,
} from "@/lib/rsvp-token";
import { syncRsvpToGoogleBestEffort } from "@/lib/events-service";
import { formatEventRange } from "@/lib/format";

type Params = { params: Promise<{ token: string }> };

const ACTION_TO_STATUS = {
  yes: "ACCEPTED",
  maybe: "TENTATIVE",
  no: "DECLINED",
} as const;

const ACTION_LABEL = { yes: "Yes", maybe: "Maybe", no: "No" } as const;

type RsvpFailure = { ok: false; error: string; status: 400 | 404 };
type RsvpSuccess = {
  ok: true;
  title: string;
  when: string;
  location: string | null;
  attendeeEmail: string;
  actionLabel: string;
  status: "ACCEPTED" | "TENTATIVE" | "DECLINED";
  googleSynced: boolean;
};

async function processRsvp(
  tokenStr: string,
  actionParam: string | null
): Promise<RsvpFailure | RsvpSuccess> {
  const payload = verifyRsvpToken(tokenStr);
  if (!payload) {
    return { ok: false, error: "Invalid or tampered RSVP link.", status: 400 };
  }

  const action = (
    RSVP_ACTIONS.includes(actionParam as RsvpAction) ? actionParam : null
  ) as RsvpAction | null;
  if (!action) {
    return { ok: false, error: "Missing or invalid ?action= (yes|maybe|no).", status: 400 };
  }

  const event = await db.event.findUnique({
    where: { id: payload.e },
    include: { attendees: true },
  });
  if (!event) return { ok: false, error: "Event not found.", status: 404 };

  const attendeeEmail = payload.a.toLowerCase();
  const attendee = event.attendees.find((a) => a.email === attendeeEmail);
  if (!attendee) {
    return { ok: false, error: "Attendee not found for this invitation.", status: 404 };
  }

  const status = ACTION_TO_STATUS[action];

  // 1. local record
  await db.attendee.update({
    where: { id: attendee.id },
    data: { rsvp: status, respondedAt: new Date() },
  });

  // 2. audit log
  await db.rsvpTokenLog.create({
    data: {
      token: tokenStr,
      eventId: event.id,
      attendeeEmail,
      action,
      receivedAt: new Date(),
    },
  });

  // 3. best-effort push into organizer's Google Calendar (offline refresh token)
  const synced = await syncRsvpToGoogleBestEffort(
    event.organizerEmail,
    event.googleEventId,
    attendeeEmail,
    status
  );

  return {
    ok: true,
    title: event.summary,
    when: formatEventRange(event.start, event.end, event.timezone),
    location: event.location,
    attendeeEmail,
    actionLabel: ACTION_LABEL[action],
    status,
    googleSynced: synced,
  };
}

function confirmationHtml(r: RsvpSuccess): string {
  const color =
    r.status === "ACCEPTED" ? "#0f9d76" : r.status === "TENTATIVE" ? "#eab308" : "#ef4444";
  const label =
    r.status === "ACCEPTED" ? "Yes" : r.status === "TENTATIVE" ? "Maybe" : "No";
  return `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>RSVP recorded</title></head>
<body style="margin:0;padding:0;background:#f2f7f4;font-family:'Inter',-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
<div style="max-width:480px;margin:48px auto;background:#ffffff;border:1px solid #e3ece7;border-radius:16px;padding:36px;text-align:center;">
  <div style="width:56px;height:56px;line-height:56px;margin:0 auto 16px;border-radius:16px;background:${color};color:#fff;font-size:24px;font-weight:700;">${r.status === "DECLINED" ? "✕" : "✓"}</div>
  <h1 style="margin:0 0 6px;font-size:21px;color:#1c2b25;letter-spacing:-.01em;">Response recorded: ${label}</h1>
  <p style="margin:0;color:#8a948f;font-size:14px;">for <strong style="color:#1c2b25;">${r.title}</strong></p>
  <div style="margin:22px 0;padding:16px;background:#effaf4;border-radius:12px;font-size:14px;color:#1c2b25;text-align:left;">
    <span style="color:#8a948f;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">When</span><br/>${r.when}<br/><br/>
    ${r.location ? `<span style="color:#8a948f;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Where</span><br/>${r.location}<br/><br/>` : ""}
    <span style="color:#8a948f;font-size:11px;text-transform:uppercase;letter-spacing:.08em;">Responding as</span><br/>${r.attendeeEmail}
  </div>
  <p style="margin:0;font-size:12px;color:#8a948f;">
    Your response was saved${r.googleSynced ? " and synced to the organizer's Google Calendar" : ""}.
  </p>
</div></body></html>`;
}

export async function GET(req: Request, { params }: Params): Promise<Response> {
  const { token } = await params;
  const url = new URL(req.url);
  const result = await processRsvp(token, url.searchParams.get("action"));

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return new Response(confirmationHtml(result), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function POST(req: Request, { params }: Params): Promise<Response> {
  const { token } = await params;
  let action: string | null = null;
  try {
    const body = (await req.json()) as { action?: string };
    action = body.action ?? null;
  } catch {
    action = new URL(req.url).searchParams.get("action");
  }

  const result = await processRsvp(token, action);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
