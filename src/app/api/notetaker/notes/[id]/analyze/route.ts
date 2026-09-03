import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { runAnalysis } from "@/lib/notetaker-pipeline";

/** POST: (re-)run the AI analysis on the saved transcript. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const { templateUsed } = await runAnalysis(id);
    const note = await db.meetingNote.findUnique({
      where: { id },
      include: { event: { include: { attendees: true } }, insights: true, actions: true },
    });
    return NextResponse.json({ note, templateUsed });
  } catch (err) {
    console.error("[notetaker:analyze]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Analysis failed" }, { status: 500 });
  }
}
