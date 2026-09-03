import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const note = await db.meetingNote.findUnique({
      where: { id },
      include: { event: { include: { attendees: true } }, insights: true, actions: true },
    });
    if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ note });
  } catch (err) {
    console.error("[notetaker:get]", err);
    return NextResponse.json({ error: "Failed to load note" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await db.meetingNote.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[notetaker:delete]", err);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
