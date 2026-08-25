import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { googleOAuth } from "@/lib/env";

// Requested scopes: full calendar access (create events / read RSVP statuses),
// gmail.send (deliver invites from the user's own mailbox) and
// meetings.space.created (provision real Google Meet links instantly).
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/meetings.space.created",
];

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
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }
      return token;
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
