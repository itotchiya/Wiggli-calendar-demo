import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isGoogleConfigured } from "@/lib/env";
import { createEventAndInvite, listEvents, parseCreateInput } from "@/lib/events-service";

export async function GET() {
  try {
    return NextResponse.json(await listEvents());
  } catch (err) {
    console.error("[events:list]", err);
    return NextResponse.json({ error: "Failed to list events" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required", code: "AUTH_REQUIRED" }, { status: 401 });
  }
  if (!isGoogleConfigured()) {
    return NextResponse.json(
      { error: "Google OAuth is not configured. Add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET to .env." },
      { status: 503 }
    );
  }
  if (!session.accessToken) {
    return NextResponse.json(
      { error: "Your Google session expired. Reconnect Google and try again.", code: "AUTH_EXPIRED" },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let input;
  try {
    input = parseCreateInput(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  try {
    const dto = await createEventAndInvite({
      accessToken: session.accessToken,
      refreshToken: null, // NextAuth v5 beta: refresh token stays in the JWT
      organizerEmail: session.user.email.toLowerCase(),
      input,
    });
    return NextResponse.json(dto, { status: 201 });
  } catch (err) {
    console.error("[events:create]", err);
    const message = err instanceof Error ? err.message : "Failed to create event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
