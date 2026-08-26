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

export type ResendCalendarConfig = {
  apiKey: string;
  calendarDomain: string;
  fromName: string;
};

/** Server-only Resend settings. Never expose the API key to client code. */
export function resendCalendarConfig(): ResendCalendarConfig {
  const calendarDomain = required("RESEND_CALENDAR_DOMAIN")
    .trim()
    .toLowerCase()
    .replace(/^@/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(calendarDomain)) {
    throw new Error("RESEND_CALENDAR_DOMAIN must be a valid verified domain");
  }
  const fromName = required("RESEND_FROM_NAME").trim();
  if (!fromName) throw new Error("RESEND_FROM_NAME must not be empty");
  return {
    apiKey: required("RESEND_API_KEY"),
    calendarDomain,
    fromName,
  };
}

export function resendWebhookSecret(): string {
  return required("RESEND_WEBHOOK_SECRET");
}

export function isResendCalendarConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY &&
    process.env.RESEND_CALENDAR_DOMAIN &&
    process.env.RESEND_FROM_NAME
  );
}
