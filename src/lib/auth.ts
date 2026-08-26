import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";
import { googleOAuth } from "@/lib/env";

// Requested scopes: full calendar access (create events / read RSVP statuses),
// gmail.send (deliver invites), gmail.readonly (ingest Outlook/Apple replies), and
// meetings.space.created (provision real Google Meet links instantly).
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/meetings.space.created",
];

async function refreshGoogleAccessToken(token: JWT): Promise<JWT> {
  if (!token.refreshToken) {
    return { ...token, accessToken: undefined, error: "RefreshAccessTokenError" };
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });
    const refreshed = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!response.ok || !refreshed.access_token) {
      throw new Error(refreshed.error_description || refreshed.error || "Google token refresh failed");
    }
    return {
      ...token,
      accessToken: refreshed.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + Math.max(60, refreshed.expires_in ?? 3600),
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch (error) {
    console.error("[auth] Google access-token refresh failed:", error);
    return { ...token, accessToken: undefined, error: "RefreshAccessTokenError" };
  }
}

// NOTE: creds fall back to "unset" so `next build` succeeds without secrets;
// sign-in actions guard on isGoogleConfigured() and surface a helpful error.
export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: googleOAuth.secret(),
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "unset",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "unset",
      authorization: {
        params: {
          scope: SCOPES.join(" "),
          access_type: "offline", // refresh token so we can act later
          prompt: "consent select_account",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token ?? token.refreshToken;
        token.expiresAt = account.expires_at;
        token.error = undefined;
        return token;
      }
      if (token.error) return token;
      if (
        token.accessToken &&
        token.expiresAt &&
        Date.now() < token.expiresAt * 1000 - 60_000
      ) {
        return token;
      }
      return refreshGoogleAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = typeof token.accessToken === "string" ? token.accessToken : undefined;
      session.error = typeof token.error === "string" ? token.error : undefined;
      return session;
    },
    async signIn({ user, account }) {
      // Persist the offline refresh token so API routes can self-heal expired
      // access tokens later (see lib/google-auth.ts).
      if (account?.provider === "google" && account.refresh_token && user.email) {
        try {
          const { db } = await import("@/lib/prisma");
          await db.organizerAccount.upsert({
            where: { email: user.email.toLowerCase() },
            update: { refreshToken: account.refresh_token },
            create: { email: user.email.toLowerCase(), refreshToken: account.refresh_token },
          });
        } catch (err) {
          console.warn("[auth] could not persist refresh token:", err);
        }
      }
      return true;
    },
  },
});
