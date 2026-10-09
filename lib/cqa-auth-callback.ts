import type { SupabaseClient, Session } from "@supabase/supabase-js";

export function authCallbackError(url: URL) {
  const hash = new URLSearchParams(url.hash.slice(1));
  const code = url.searchParams.get("error_code") || hash.get("error_code");
  if (code === "otp_expired") return "This email link has expired or was already used. Request a fresh sign-in, confirmation or password recovery email.";
  return url.searchParams.get("error_description") || hash.get("error_description") || (code || url.searchParams.get("error") || hash.get("error") ? "This email link could not be verified. Request a fresh email." : "");
}

let pending: { key: string; result: Promise<{ session: Session | null; recovery: boolean }> } | undefined;
const recoveryMarkerKey = "cqa-verified-recovery";
let recoveryMarker: { userId: string; expires: number } | undefined;
function rememberRecovery(session: Session | null, recovery: boolean) {
  if (!session || !recovery) return;
  recoveryMarker = { userId: session.user.id, expires: Date.now() + 15 * 60 * 1000 };
  try { window.sessionStorage.setItem(recoveryMarkerKey, JSON.stringify(recoveryMarker)); } catch { /* memory fallback */ }
}
function hasRecoveryMarker(session: Session | null) {
  let marker = recoveryMarker;
  try { marker = JSON.parse(window.sessionStorage.getItem(recoveryMarkerKey) || "null") || marker; } catch { /* memory fallback */ }
  return Boolean(session && marker && marker.userId === session.user.id && marker.expires > Date.now());
}
export async function requireCqaRecoverySession(client: SupabaseClient) {
  const { data, error } = await client.auth.getSession();
  if (error || !hasRecoveryMarker(data.session)) throw new Error("Your recovery session changed or expired. Request a fresh recovery email.");
}
export function clearCqaRecoveryMarker() {
  recoveryMarker = undefined;
  try { window.sessionStorage.removeItem(recoveryMarkerKey); } catch { /* memory fallback */ }
}

// Single-use links must only be exchanged once, including React effect replays.
export function completeCqaAuthCallback(client: SupabaseClient, url: URL) {
  const key = url.href;
  const oneTimeLink = Boolean(url.searchParams.get("code") || url.searchParams.get("token_hash") || url.hash.includes("access_token=") || url.hash.includes("refresh_token="));
  if (oneTimeLink && pending?.key === key) return pending.result;
  const result = (async () => {
    const error = authCallbackError(url);
    if (error) throw new Error(error);
    const hash = new URLSearchParams(url.hash.slice(1));
    let recovery = (url.searchParams.get("type") || hash.get("type")) === "recovery" || url.searchParams.get("flow") === "recovery";
    const code = url.searchParams.get("code");
    const tokenHash = url.searchParams.get("token_hash");
    if (tokenHash) {
      const type = url.searchParams.get("type") || "email";
      if (!["email", "signup", "recovery", "magiclink", "invite", "email_change"].includes(type)) throw new Error("This email link has an unsupported verification type.");
      const { data, error: verificationError } = await client.auth.verifyOtp({ token_hash: tokenHash, type: type as "email" | "signup" | "recovery" | "magiclink" | "invite" | "email_change" });
      if (verificationError) throw verificationError;
      rememberRecovery(data.session, recovery);
      return { session: data.session, recovery };
    }
    if (code) {
      const { data, error: exchangeError } = await client.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
      recovery = recovery || (data as typeof data & { redirectType?: string }).redirectType === "recovery";
      rememberRecovery(data.session, recovery);
      return { session: data.session, recovery };
    }
    if (hash.get("access_token") || hash.get("refresh_token")) {
      const accessToken = hash.get("access_token"), refreshToken = hash.get("refresh_token");
      if (!accessToken || !refreshToken) throw new Error("This email link is incomplete. Request a fresh email.");
      const { data, error: sessionError } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (sessionError) throw sessionError;
      rememberRecovery(data.session, recovery);
      return { session: data.session, recovery };
    }
    const { data, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    if (recovery && !hasRecoveryMarker(data.session)) throw new Error("This recovery session could not be verified. Request a fresh password recovery email.");
    return { session: data.session, recovery };
  })();
  if (oneTimeLink) pending = { key, result };
  return result;
}
