export const GOOGLE_SESSION_EXPIRED_EVENT = "wiggli:google-session-expired";

type ApiErrorBody = {
  error?: unknown;
  code?: unknown;
};

export function notifyIfGoogleSessionExpired(response: Response, body: unknown): boolean {
  if (response.status !== 401 || typeof window === "undefined") return false;
  const apiError = body && typeof body === "object" ? body as ApiErrorBody : {};
  const message = typeof apiError.error === "string" && apiError.error.trim()
    ? apiError.error.trim()
    : "Your Google session expired. Reconnect Google and try again.";
  window.dispatchEvent(new CustomEvent(GOOGLE_SESSION_EXPIRED_EVENT, { detail: { message } }));
  return true;
}
