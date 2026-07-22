import crypto from "node:crypto";

const AUTHORIZE_URL = "https://auth.fanvue.com/oauth2/auth";
const TOKEN_URL = "https://auth.fanvue.com/oauth2/token";
const API_BASE_URL = "https://api.fanvue.com";

export const FANVUE_SESSION_COOKIE = "cqa_fanvue_session";
export const FANVUE_FLOW_COOKIE = "cqa_fanvue_flow";

export type FanvueTokenSet = {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  scope?: string;
  expiresAt: number;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required Fanvue environment variable: ${name}`);
  return value;
}

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

function encryptionKey(): Buffer {
  return crypto.createHash("sha256").update(required("FANVUE_SESSION_SECRET")).digest();
}

export function seal(value: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [base64url(iv), base64url(tag), base64url(ciphertext)].join(".");
}

export function unseal<T>(token?: string): T | null {
  if (!token) return null;
  try {
    const [ivPart, tagPart, dataPart] = token.split(".");
    if (!ivPart || !tagPart || !dataPart) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext) as T;
  } catch {
    return null;
  }
}

export function generatePkce() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function getFanvueRedirectUri(): string {
  return required("FANVUE_REDIRECT_URI");
}

export function createAuthorizeUrl(state: string, challenge: string): string {
  const scopes = process.env.FANVUE_SCOPES || "read:self";
  const params = new URLSearchParams({
    response_type: "code",
    client_id: required("FANVUE_CLIENT_ID"),
    redirect_uri: getFanvueRedirectUri(),
    scope: `openid offline_access offline ${scopes}`,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string, verifier: string): Promise<FanvueTokenSet> {
  const clientId = required("FANVUE_CLIENT_ID");
  const clientSecret = required("FANVUE_CLIENT_SECRET");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getFanvueRedirectUri(),
    client_id: clientId,
    code_verifier: verifier,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Fanvue token exchange failed (${response.status})`);
  const token = await response.json() as {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    scope?: string;
    expires_in: number;
  };

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    tokenType: token.token_type,
    scope: token.scope,
    expiresAt: Date.now() + token.expires_in * 1000,
  };
}

export async function getFanvueUser(session: FanvueTokenSet | null) {
  if (!session?.accessToken || Date.now() >= session.expiresAt) return null;
  const response = await fetch(`${API_BASE_URL}/users/me`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json();
}
