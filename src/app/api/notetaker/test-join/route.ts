import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createNotetakerBot } from "@/lib/recall";

/**
 * POST { meetingUrl }: fire a test bot at any Meet URL right now.
 * No event / DB row needed — pure connectivity test: does Recall join?
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  let body: { meetingUrl?: string };
  try {
    body = (await req.json()) as { meetingUrl?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const meetingUrl = body.meetingUrl?.trim() ?? "";
  if (!/^https:\/\/.+\..+/.test(meetingUrl)) {
    return NextResponse.json({ error: "Paste a full meeting URL starting with https://" }, { status: 400 });
  }
  try {
    const bot = await createNotetakerBot({
      meetingUrl,
      joinAt: new Date().toISOString(),
      eventId: "manual-test",
    });
    return NextResponse.json({ bot }, { status: 201 });
  } catch (err) {
    console.error("[notetaker:test-join]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Test join failed" }, { status: 500 });
  }
}
