import { db } from "./prisma";
import { getGoogleClient } from "./google/calendar";

/**
 * Returns a valid Google OAuth2 client for the organizer.
 * Strategy:
 *  1. Try the session access token (fast path).
 *  2. On auth failure (401/403), fall back to the stored refresh token from
 *     OrganizerAccount — transparent to the caller.
 *  3. If both fail, throw AuthExpiredError prompting re-sign-in.
 */

export class AuthExpiredError extends Error {
  constructor() {
    super("Your Google session expired. Please sign out and sign in again.");
    this.name = "AuthExpiredError";
  }
}

type RetryFn<T> = (client: ReturnType<typeof getGoogleClient>) => Promise<T>;

export async function withFreshGoogleClient<T>(
  sessionAccessToken: string | undefined,
  organizerEmail: string,
  fn: RetryFn<T>
): Promise<T> {
  // Fast path: current access token
  if (sessionAccessToken) {
    try {
      const client = getGoogleClient(sessionAccessToken);
      return await fn(client);
    } catch (err: unknown) {
      const status =
        typeof err === "object" && err !== null && "status" in err
          ? Number((err as { status?: unknown }).status)
          : undefined;
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? Number((err as { code?: unknown }).code)
          : undefined;
      if (!(status === 401 || code === 401 || status === 403)) throw err;
      console.warn("[auth] access token rejected, trying stored refresh token…");
    }
  }

  // Fallback: stored offline refresh token
  const account = await db.organizerAccount.findUnique({ where: { email: organizerEmail } });
  if (account?.refreshToken) {
    try {
      const { google } = await import("googleapis");
      const oauth2 = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      oauth2.setCredentials({ refresh_token: account.refreshToken });
      return await fn(oauth2);
    } catch (err) {
      console.error("[auth] refresh-token path also failed:", err);
    }
  }

  throw new AuthExpiredError();
}
