// Isolated test infrastructure. No production deployment or live credentials.
// Stripe cannot carry a Vercel bypass header; this signature-verifying receiver
// adds the header server-side without putting that secret in Stripe's URL.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

const testProjectOrigin = "https://ndzmlywsuywkhgqdbzft.supabase.co";
const maxBodyBytes = 1024 * 1024;
const previewOriginPattern = /^https:\/\/cqa-vending-machines-[a-z0-9-]+-creativequality\.vercel\.app$/;
const destinations = {
  platform: "/api/stripe/webhook",
  connect: "/api/marketplace/stripe-webhook"
} as const;
type Route = keyof typeof destinations;

function answer(status: number, message: string) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...(status === 405 ? { Allow: "POST" } : {}) } });
}

class BodyLimitError extends Error {}
async function readBoundedBody(request: Request | Response, maximum: number): Promise<Uint8Array> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maximum)) throw new BodyLimitError();
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) {
        await reader.cancel();
        throw new BodyLimitError();
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function parseSignature(header: string | null) {
  if (!header || header.length > 4096) return null;
  const timestamps: string[] = [];
  const signatures: string[] = [];
  for (const entry of header.split(",")) {
    const pair = entry.trim().split("=");
    if (pair.length !== 2) return null;
    if (pair[0] === "t") timestamps.push(pair[1]);
    if (pair[0] === "v1") {
      if (!/^[0-9a-f]{64}$/i.test(pair[1])) return null;
      signatures.push(pair[1]);
    }
  }
  if (timestamps.length !== 1 || !/^\d{1,12}$/.test(timestamps[0]) || !signatures.length || signatures.length > 16) return null;
  const timestamp = Number(timestamps[0]);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return null;
  return { timestamp: timestamps[0], signatures };
}

async function validSignature(body: Uint8Array, parsed: NonNullable<ReturnType<typeof parseSignature>>, secret: string) {
  const prefix = new TextEncoder().encode(`${parsed.timestamp}.`);
  const signed = new Uint8Array(prefix.length + body.length);
  signed.set(prefix); signed.set(body, prefix.length);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  // WebCrypto performs cryptographic verification; never compare HMAC strings.
  const checks = await Promise.all(parsed.signatures.map(hex => {
    const signature = Uint8Array.from(hex.match(/../g) || [], byte => parseInt(byte, 16));
    return crypto.subtle.verify("HMAC", key, signature, signed);
  }));
  return checks.some(Boolean);
}

export async function handleTestWebhook(request: Request): Promise<Response> {
  if (request.method !== "POST") return answer(405, "Method not allowed");
  const url = new URL(request.url);
  // Accept only the function gateway path and direct path used by the Edge
  // runtime. No wildcard suffixes, query controls or caller-selected targets.
  const route = (Object.keys(destinations) as Route[]).find(name =>
    url.pathname === `/functions/v1/cqa-test-webhook/${name}` || url.pathname === `/cqa-test-webhook/${name}`);
  if (!route || url.search) return answer(404, "Not found");
  const projectUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (![testProjectOrigin, `${testProjectOrigin}/`].includes(projectUrl || "") || !serviceRoleKey?.trim()) return answer(503, "Relay unavailable");
  const signature = request.headers.get("stripe-signature");
  const parsed = parseSignature(signature);
  if (!parsed) return answer(401, "Invalid signature");
  let body: Uint8Array;
  try { body = await readBoundedBody(request, maxBodyBytes); }
  catch (failure) { return answer(failure instanceof BodyLimitError ? 413 : 400, "Invalid request"); }
  try {
    const response = await fetch(`${testProjectOrigin}/rest/v1/rpc/cqa_test_webhook_config`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(5000),
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_route: route }), cache: "no-store"
    });
    if (!response.ok) { await response.body?.cancel(); return answer(503, "Relay unavailable"); }
    const config = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await readBoundedBody(response, 16 * 1024)));
    const origin = config?.preview_origin;
    const bypass = config?.protection_bypass;
    const secret = config?.stripe_signing_secret;
    if (typeof origin !== "string" || !previewOriginPattern.test(origin) || origin !== origin.trim() ||
        typeof bypass !== "string" || !/^[A-Za-z0-9]{32,256}$/.test(bypass) || bypass !== bypass.trim() ||
        typeof secret !== "string" || !/^whsec_[A-Za-z0-9]{16,256}$/.test(secret) || secret !== secret.trim()) return answer(503, "Relay unavailable");
    if (!(await validSignature(body, parsed, secret))) return answer(401, "Invalid signature");
    // Even a mistakenly configured live endpoint must never reach the test app.
    let event: { livemode?: unknown };
    try { event = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)); }
    catch { return answer(400, "Invalid request"); }
    if (!event || event.livemode !== false) return answer(400, "Invalid request");
    const forwarded = await fetch(`${origin}${destinations[route]}`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(10000), cache: "no-store",
      headers: { "Content-Type": "application/json", "stripe-signature": signature!, "x-vercel-protection-bypass": bypass },
      body: new Uint8Array(body).buffer
    });
    // Do not relay app bodies, locations, cookies or provider diagnostics.
    await forwarded.body?.cancel();
    return forwarded.ok ? new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } }) : answer(502, "Webhook delivery failed");
  } catch { return answer(502, "Webhook delivery failed"); }
}

Deno.serve(handleTestWebhook);
