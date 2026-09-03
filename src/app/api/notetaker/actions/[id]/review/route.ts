import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

/** POST { decision: "CREATED_TASK" | "IGNORED" }: human review of a suggested action. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await ctx.params;
  let body: { decision?: string };
  try {
    body = (await req.json()) as { decision?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.decision !== "CREATED_TASK" && body.decision !== "IGNORED") {
    return NextResponse.json({ error: "decision must be CREATED_TASK or IGNORED" }, { status: 400 });
  }
  try {
    // v1 records the decision; wiring into a real Tasks table is a later step.
    const action = await db.noteAction.update({ where: { id }, data: { reviewStatus: body.decision } });
    return NextResponse.json({ action });
  } catch (err) {
    console.error("[notetaker:action-review]", err);
    return NextResponse.json({ error: "Failed to review action" }, { status: 500 });
  }
}
