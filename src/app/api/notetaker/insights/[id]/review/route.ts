import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

/** POST { decision: "ACCEPTED" | "IGNORED" }: human review of a suggested insight. */
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
  if (body.decision !== "ACCEPTED" && body.decision !== "IGNORED") {
    return NextResponse.json({ error: "decision must be ACCEPTED or IGNORED" }, { status: 400 });
  }
  try {
    const insight = await db.insight.update({ where: { id }, data: { reviewStatus: body.decision } });
    return NextResponse.json({ insight });
  } catch (err) {
    console.error("[notetaker:insight-review]", err);
    return NextResponse.json({ error: "Failed to review insight" }, { status: 500 });
  }
}
