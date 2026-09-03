import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { getRecordingVideoUrl } from "@/lib/recall";

/** GET: fresh playable video URL for this note (Recall signs URLs ~5h — never cached). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const note = await db.meetingNote.findUnique({ where: { id } });
    if (!note?.recallRecordingId) return NextResponse.json({ error: "No recording for this meeting yet" }, { status: 404 });
    const url = await getRecordingVideoUrl(note.recallRecordingId);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[notetaker:video]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Video unavailable" }, { status: 502 });
  }
}
