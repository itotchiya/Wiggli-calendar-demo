import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { askOverTranscript } from "@/lib/notetaker";

/** POST { question }: Ask AI over this meeting's transcript + summary. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await ctx.params;
  let body: { question?: string };
  try {
    body = (await req.json()) as { question?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.question?.trim()) return NextResponse.json({ error: "question required" }, { status: 400 });
  try {
    const note = await db.meetingNote.findUnique({ where: { id } });
    if (!note || !note.transcriptText) return NextResponse.json({ error: "No transcript for this meeting yet" }, { status: 400 });
    const answer = await askOverTranscript({ question: body.question.trim(), transcriptText: note.transcriptText, summary: note.summary });
    return NextResponse.json({ answer });
  } catch (err) {
    console.error("[notetaker:ask]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Ask failed" }, { status: 500 });
  }
}
