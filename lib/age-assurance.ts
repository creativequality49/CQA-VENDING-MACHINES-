import crypto from "node:crypto";

export const AGE_COOKIE = "cqa_age_verified";
const VERSION = "v1";

function secret() {
  return process.env.AGE_GATE_SECRET || "";
}

export function createAgeToken(ttlSeconds = 60 * 60 * 24 * 30) {
  const key = secret();
  if (!key) throw new Error("AGE_GATE_SECRET is not configured");
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${VERSION}.${exp}`;
  const sig = crypto.createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyAgeToken(token?: string | null) {
  if (!token) return false;
  const key = secret();
  if (!key) return false;
  const [version, expRaw, sig] = token.split(".");
  if (version !== VERSION || !expRaw || !sig) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return false;
  const payload = `${version}.${expRaw}`;
  const expected = crypto.createHmac("sha256", key).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
