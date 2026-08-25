// Central env access — fail fast with clear messages instead of undefined surprises.
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name} (see .env.example)`);
  return v;
}

export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

export const googleOAuth = {
  clientId: () => required("GOOGLE_CLIENT_ID"),
  clientSecret: () => required("GOOGLE_CLIENT_SECRET"),
  /** Secret used to sign NextAuth sessions/JWTs. */
  secret: () => process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "dev-secret-change-me",
};

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
