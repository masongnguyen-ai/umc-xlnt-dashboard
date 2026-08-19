/**
 * Google OAuth trực tiếp (Web client trên Google Cloud) — server-only.
 * Khác service account dùng để ghi Sheet.
 *
 * Redirect URI cần khai trên Google Cloud:
 *   {origin}/api/auth/callback/google
 * Local: http://localhost:8080/api/auth/callback/google
 */
export function googleOAuthCreds(): { clientId: string; clientSecret: string } | null {
  const clientId = (process.env.GOOGLE_CLIENT_ID ?? process.env.GOOGLE_OAUTH_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET ?? process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "").trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
