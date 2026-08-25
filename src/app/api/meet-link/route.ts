import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { google } from "googleapis";
import { db } from "@/lib/prisma";

/**
 * Instantly provisions a REAL Google Meet conference space.
 * Called by the drawer the moment the user selects Google Meet as provider,
 * so the actual meet.google.com link is visible (and copyable) before send.
 *
 * Uses the Google Meet REST API (meet.googleapis.com) — spaces are created
 * standalone and later bound to the calendar event via its conferenceData.
 * POST {} → { meetingLink }
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.email || !session.accessToken) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const tryCreate = async (accessToken: string) => {
    const authClient = new google.auth.OAuth2();
    authClient.setCredentials({ access_token: accessToken });
    // The Meet API is exposed through discovery; call it directly via fetch
    // for a stable, minimal payload.
    const res = await fetch("https://meet.googleapis.com/v2/spaces", {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw Object.assign(new Error(`Meet API ${res.status}: ${detail.slice(0, 200)}`), {
        status: res.status,
      });
    }
    const data = (await res.json()) as { meetingUri?: string; name?: string };
    if (!data.meetingUri) throw new Error("Meet API returned no meetingUri");
    return { meetingLink: data.meetingUri, spaceName: data.name ?? null };
  };

  // Friendlier message for the most common setup issue.
  const explain = (err: unknown): Error => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("has not been used in project") || msg.includes("is disabled")) {
      return new Error(
        "The Google Meet API is disabled on your Cloud project. Enable it at console.cloud.google.com → APIs & Services → Library → 'Google Meet API', then retry."
      );
    }
    return err instanceof Error ? err : new Error(msg);
  };

  try {
    return NextResponse.json(await tryCreate(session.accessToken));
  } catch (err) {
    const status =
      typeof err === "object" && err !== null && "status" in err
        ? Number((err as { status?: unknown }).status)
        : undefined;

    // Access token expired → transparent refresh-token fallback.
    if (status === 401 || status === 403) {
      const account = await db.organizerAccount.findUnique({
        where: { email: session.user.email.toLowerCase() },
      });
      if (account?.refreshToken) {
        try {
          const oauth2 = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
          );
          oauth2.setCredentials({ refresh_token: account.refreshToken });
          const { token } = await oauth2.getAccessToken();
          if (token) {
            return NextResponse.json(await tryCreate(token));
          }
        } catch (refreshErr) {
          console.error("[meet-link] refresh path failed:", refreshErr);
        }
      }
      return NextResponse.json(
        { error: "Google session expired — sign out and sign in again." },
        { status: 401 }
      );
    }

    console.error("[meet-link]", err);
    return NextResponse.json({ error: explain(err).message }, { status: 500 });
  }
}
