import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateSmartContextParagraphs } from "@/lib/gemini";
import { parseSmartEventDocument } from "@/lib/smart-event-schema";

/** Generate only the Smart Event context paragraph for every attendee audience. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: { document?: unknown; instruction?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const document = parseSmartEventDocument(body.document);
    // Session identity is authoritative at this public HTTP boundary.
    document.organizer.email = session.user.email.toLowerCase();
    document.organizer.fullName =
      session.user.name?.trim() || document.organizer.fullName || session.user.email.split("@")[0];
    const instruction = typeof body.instruction === "string" ? body.instruction.trim() || undefined : undefined;
    return NextResponse.json(await generateSmartContextParagraphs(document, instruction));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Smart Event generation failed" },
      { status: 400 }
    );
  }
}
