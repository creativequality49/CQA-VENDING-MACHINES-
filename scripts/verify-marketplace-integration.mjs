import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

export const TEST_PROJECT = "ndzmlywsuywkhgqdbzft";
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const digest = value => createHash("sha256").update(value).digest("hex");
class ProbeError extends Error {
  constructor(code, status = "failed") { super(code); this.code = code; this.status = status; }
}
const assert = (condition, code, status) => { if (!condition) throw new ProbeError(code, status); };
const unverified = ["signup", "private-upload-persistence", "bucket-public-configuration", "payment-to-download", "signature-verified-webhook", "durable-entitlement-once", "refund-revocation", "cancellation-revocation", "business-terms", "production-release"];

function origin(value, kind) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new ProbeError(`invalid-${kind}`, "blocked"); }
  assert(parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.port &&
    parsed.pathname === "/" && !parsed.search && !parsed.hash, `invalid-${kind}`, "blocked");
  return parsed;
}

export function configuration(env, expiryOnly = false) {
  const required = ["CQA_TEST_BASE_URL", "CQA_TEST_SUPABASE_URL", "CQA_TEST_CANDIDATE_SHA", "CQA_TEST_ISOLATION_ACK", "CQA_TEST_R2_ACCOUNT_ID", "CQA_TEST_R2_BUCKET", "CQA_TEST_BUSINESS_ID", "CQA_TEST_OFFER_ID", "CQA_TEST_ORDER_ID", "CQA_TEST_ASSET_SHA256"];
  if (!expiryOnly) required.push("CQA_TEST_SUPABASE_ANON_KEY", "CQA_TEST_OWNER_TOKEN", "CQA_TEST_BUYER_A_TOKEN", "CQA_TEST_BUYER_B_TOKEN");
  const missing = required.filter(key => !env[key]);
  if (missing.length) return { report: { status: "blocked", code: "missing-configuration", missing } };
  try {
    const base = origin(env.CQA_TEST_BASE_URL, "preview-origin");
    assert(/^cqa-vending-machines-[a-z0-9-]+-creativequality\.vercel\.app$/.test(base.hostname), "preview-origin-not-allowed", "blocked");
    const supabase = origin(env.CQA_TEST_SUPABASE_URL, "test-project-origin");
    assert(supabase.hostname === `${TEST_PROJECT}.supabase.co` && env.CQA_TEST_ISOLATION_ACK === TEST_PROJECT, "test-project-not-confirmed", "blocked");
    assert(/^[a-f0-9]{40}$/.test(env.CQA_TEST_CANDIDATE_SHA), "invalid-candidate-sha", "blocked");
    assert(/^[a-f0-9]{32}$/.test(env.CQA_TEST_R2_ACCOUNT_ID) && /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(env.CQA_TEST_R2_BUCKET), "invalid-storage-scope", "blocked");
    for (const key of ["CQA_TEST_BUSINESS_ID", "CQA_TEST_OFFER_ID", "CQA_TEST_ORDER_ID"]) assert(uuid.test(env[key]), "invalid-fixture-reference", "blocked");
    assert(/^[a-f0-9]{64}$/.test(env.CQA_TEST_ASSET_SHA256), "invalid-fixture-digest", "blocked");
    if (!expiryOnly) {
      for (const key of ["CQA_TEST_OWNER_TOKEN", "CQA_TEST_BUYER_A_TOKEN", "CQA_TEST_BUYER_B_TOKEN"]) {
        let claims;
        try { claims = JSON.parse(Buffer.from(env[key].split(".")[1], "base64url").toString()); } catch { throw new ProbeError("invalid-fixture-token", "blocked"); }
        assert(env[key].length < 12000 && claims.iss === `${supabase.origin}/auth/v1` && uuid.test(claims.sub), "fixture-token-project-mismatch", "blocked");
      }
      assert(!env.CQA_TEST_SUPABASE_ANON_KEY.startsWith("sb_secret_"), "admin-key-not-accepted", "blocked");
      try {
        const keyClaims = JSON.parse(Buffer.from(env.CQA_TEST_SUPABASE_ANON_KEY.split(".")[1], "base64url").toString());
        assert(keyClaims.role === "anon", "admin-key-not-accepted", "blocked");
      } catch (error) {
        if (error instanceof ProbeError) throw error;
        assert(env.CQA_TEST_SUPABASE_ANON_KEY.startsWith("sb_publishable_"), "publishable-key-required", "blocked");
      }
    }
    return { config: {
      base: base.origin, supabase: supabase.origin, candidateSha: env.CQA_TEST_CANDIDATE_SHA,
      publicKey: env.CQA_TEST_SUPABASE_ANON_KEY,
      tokens: [env.CQA_TEST_OWNER_TOKEN, env.CQA_TEST_BUYER_A_TOKEN, env.CQA_TEST_BUYER_B_TOKEN],
      account: env.CQA_TEST_R2_ACCOUNT_ID, bucket: env.CQA_TEST_R2_BUCKET,
      business: env.CQA_TEST_BUSINESS_ID, offer: env.CQA_TEST_OFFER_ID,
      order: env.CQA_TEST_ORDER_ID, assetDigest: env.CQA_TEST_ASSET_SHA256,
    }, report: { status: "preflight-ready", code: "configuration-present-not-provider-proof" } };
  } catch (error) { return { report: { status: "blocked", code: error instanceof ProbeError ? error.code : "invalid-configuration" } }; }
}

async function boundedBody(response, maxBytes) {
  assert(response.body, "empty-provider-response");
  const reader = response.body.getReader();
  const chunks = []; let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      assert(length <= maxBytes, "oversized-provider-response");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks);
}

export function validateSignedUrl(value, config) {
  let url;
  try { url = new URL(value); } catch { throw new ProbeError("invalid-download-url"); }
  assert(url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash &&
    url.hostname === `${config.account}.r2.cloudflarestorage.com`, "download-origin-mismatch");
  const prefix = `/${config.bucket}/marketplace/${config.business}/${config.offer}/`;
  assert(url.pathname.startsWith(prefix) && /^[a-f0-9-]{36}\.(pdf|zip|png|jpg|txt)$/.test(url.pathname.slice(prefix.length)), "download-object-scope-mismatch");
  const params = url.searchParams;
  assert(params.get("X-Amz-Algorithm") === "AWS4-HMAC-SHA256" && params.get("X-Amz-Expires") === "600" &&
    /^[a-f0-9]{64}$/.test(params.get("X-Amz-Signature") || ""), "invalid-download-signature-metadata");
  for (const key of params.keys()) assert(params.getAll(key).length === 1, "duplicate-signature-parameter");
  const date = params.get("X-Amz-Date");
  assert(/^\d{8}T\d{6}Z$/.test(date || ""), "invalid-signature-date");
  const time = Date.parse(`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}T${date.slice(9,11)}:${date.slice(11,13)}:${date.slice(13,15)}Z`);
  assert(Number.isFinite(time), "invalid-signature-date");
  return { url, expiresAt: time + 600000 };
}

function reportFor(config, mode) {
  return { schemaVersion: 1, observedAt: new Date().toISOString(), mode,
    candidateSha: config?.candidateSha || null, releaseStatus: "NOT_READY", checks: [],
    unverified: [...unverified], limitation: "Configured candidate SHA and isolation acknowledgement require independent deployment/environment evidence; this runner does not certify release readiness." };
}

async function privateTempRoot() {
  const root = await fs.realpath(os.tmpdir());
  const repository = await fs.realpath(repositoryRoot);
  const relative = path.relative(repository, root);
  assert(relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative), "private-state-root-inside-repository", "blocked");
  return root;
}

async function privateState(config, signed, now) {
  const dir = await fs.mkdtemp(path.join(await privateTempRoot(), "cqa-integration-"));
  await fs.chmod(dir, 0o700);
  const file = path.join(dir, "expiry.json");
  await fs.writeFile(file, JSON.stringify({ schemaVersion: 1, id: randomUUID(), candidateSha: config.candidateSha,
    base: config.base, order: config.order, assetDigest: config.assetDigest,
    url: signed.url.href, urlDigest: digest(signed.url.href), expiresAt: signed.expiresAt,
    successfulDownloadAt: now }), { mode: 0o600, flag: "wx" });
  return file;
}

export async function verifyReadOnly(config, { fetchImpl = fetch, now = () => Date.now() } = {}) {
  const report = reportFor(config, "verify-read-only");
  let phase = "authenticate-fixtures";
  const request = async (url, options = {}) => {
    try { return await fetchImpl(url, { ...options, redirect: "error", signal: AbortSignal.timeout(15000) }); }
    catch { throw new ProbeError("network-request-failed", "blocked"); }
  };
  const json = async response => {
    try { return JSON.parse((await boundedBody(response, 1024 * 1024)).toString("utf8")); }
    catch (error) { if (error instanceof ProbeError) throw error; throw new ProbeError("invalid-provider-json"); }
  };
  const api = (route, token) => request(`${config.base}${route}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  try {
    const client = createClient(config.supabase, config.publicKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { fetch: request },
    });
    const identities = [];
    for (const token of config.tokens) {
      const { data, error } = await client.auth.getUser(token);
      assert(!error && data?.user?.id && data.user.email_confirmed_at, "fixture-authentication-failed", "blocked");
      identities.push(data.user.id);
    }
    assert(new Set(identities).size === 3, "fixture-identities-must-be-distinct", "blocked");
    report.checks.push({ id: phase, result: "passed" });
    phase = "owner-fixture-attachment";
    const ownerResponse = await api("/api/owner/marketplace-asset", config.tokens[0]);
    assert(ownerResponse.status === 200, "owner-api-not-available", "blocked");
    const owner = await json(ownerResponse);
    assert(Array.isArray(owner.offers) && owner.offers.some(offer => offer.id === config.offer && offer.hasFile === true), "attached-owner-fixture-missing", "blocked");
    report.checks.push({ id: phase, result: "passed", scope: "Read-back only; does not prove upload persistence or bucket privacy" });
    phase = "buyer-library-and-isolation";
    for (const [index, token] of config.tokens.slice(1).entries()) {
      const response = await api("/api/marketplace/library", token);
      assert(response.status === 200, "library-api-not-available", "blocked");
      assert(/no-store/i.test(response.headers.get("cache-control") || ""), "library-cache-header-missing");
      const library = await json(response);
      assert(Array.isArray(library.products), "invalid-library-response");
      const matches = library.products.filter(product => product.orderId === config.order);
      assert(index === 0 ? matches.length === 1 && matches[0].downloadable === true : matches.length === 0, "buyer-library-isolation-failed");
    }
    const route = `/api/marketplace/download?orderId=${config.order}`;
    assert((await api(route)).status === 401, "anonymous-download-not-denied");
    assert((await api(route, config.tokens[2])).status === 404, "other-buyer-download-not-denied");
    report.checks.push({ id: phase, result: "passed", scope: "Controlled order fixture only" });
    phase = "authorised-download-content";
    const response = await api(route, config.tokens[1]);
    assert(response.status === 200, "authorised-download-unavailable", "blocked");
    assert(/no-store/i.test(response.headers.get("cache-control") || ""), "download-cache-header-missing");
    const body = await json(response);
    assert(body.expiresIn === 600 && typeof body.url === "string", "unexpected-download-lifetime");
    const signed = validateSignedUrl(body.url, config);
    assert(signed.expiresAt > now() && signed.expiresAt <= now() + 610000, "unexpected-download-expiry");
    const download = await request(signed.url.href);
    assert(download.status === 200, "signed-object-download-failed");
    const bytes = await boundedBody(download, 4 * 1024 * 1024);
    assert(bytes.length > 0 && digest(bytes) === config.assetDigest, "download-content-digest-mismatch");
    const file = await privateState(config, signed, now());
    report.privateStateFile = file;
    report.checks.push({ id: phase, result: "passed", expiresIn: 600 });
    phase = "unsigned-s3-object-access";
    const unsigned = new URL(signed.url); unsigned.search = "";
    const denied = await request(unsigned.href);
    assert(denied.status === 403, "unsigned-object-access-not-confirmed-denied");
    await denied.body?.cancel();
    report.checks.push({ id: phase, result: "passed", scope: "Selected S3 endpoint only; r2.dev/custom-domain public configuration remains unverified" });
    report.checks.push({ id: "same-url-after-expiry", result: "pending", recheckAfter: new Date(signed.expiresAt + 5000).toISOString() });
    report.status = "passed-requested-read-only-probes";
  } catch (error) {
    report.status = error instanceof ProbeError ? error.status : "failed";
    report.checks.push({ id: phase, result: report.status, code: error instanceof ProbeError ? error.code : "probe-failed" });
  }
  return report;
}

export async function verifyExpiry(config, file, { fetchImpl = fetch, now = () => Date.now() } = {}) {
  const report = reportFor(config, "verify-expiry");
  try {
    assert(typeof file === "string" && path.isAbsolute(file), "private-state-file-required", "blocked");
    const directory = path.dirname(file);
    assert(path.resolve(file) === file && path.dirname(directory) === await privateTempRoot() && path.basename(directory).startsWith("cqa-integration-") && path.basename(file) === "expiry.json", "private-state-location-not-allowed", "blocked");
    const dirStat = await fs.lstat(directory);
    assert(dirStat.isDirectory() && !dirStat.isSymbolicLink() && (dirStat.mode & 0o777) === 0o700 && dirStat.uid === process.getuid(), "unsafe-private-state-directory", "blocked");
    const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    let state;
    try {
      const stat = await handle.stat();
      assert(stat.isFile() && stat.nlink === 1 && (stat.mode & 0o777) === 0o600 && stat.uid === process.getuid() && stat.size <= 16384, "unsafe-private-state-file", "blocked");
      state = JSON.parse(await handle.readFile("utf8"));
    } finally { await handle.close(); }
    assert(state.schemaVersion === 1 && state.candidateSha === config.candidateSha && state.base === config.base && state.order === config.order && state.assetDigest === config.assetDigest && state.urlDigest === digest(state.url), "private-state-scope-mismatch", "blocked");
    const signed = validateSignedUrl(state.url, config);
    assert(signed.expiresAt === state.expiresAt && Number.isFinite(state.successfulDownloadAt) && state.successfulDownloadAt < state.expiresAt, "invalid-expiry-evidence", "blocked");
    if (now() < state.expiresAt + 5000) {
      report.status = "pending";
      report.checks.push({ id: "same-url-after-expiry", result: "pending", recheckAfter: new Date(state.expiresAt + 5000).toISOString() });
      return report;
    }
    let response;
    try { response = await fetchImpl(state.url, { redirect: "error", signal: AbortSignal.timeout(15000) }); }
    catch { throw new ProbeError("network-request-failed", "blocked"); }
    assert(response.status === 403, "expired-same-url-not-confirmed-denied");
    await response.body?.cancel();
    report.status = "passed-requested-expiry-probe";
    report.checks.push({ id: "same-url-after-expiry", result: "passed", scope: "Same previously successful signed URL returned HTTP 403 after its actual 600-second lifetime; refund revocation remains unverified" });
  } catch (error) {
    report.status = error instanceof ProbeError ? error.status : "blocked";
    report.checks.push({ id: "same-url-after-expiry", result: report.status, code: error instanceof ProbeError ? error.code : "private-state-unavailable" });
  }
  return report;
}

export async function main(args = process.argv.slice(2), env = process.env) {
  const preflight = args.length === 0;
  const readOnly = args.length === 1 && args[0] === "--verify-read-only";
  const expiryOnly = args.length === 3 && args[0] === "--verify-expiry" &&
    args[1] === "--state-file" && typeof args[2] === "string" && path.isAbsolute(args[2]);
  if (!preflight && !readOnly && !expiryOnly) {
    return { ...reportFor(null, "preflight"), status: "blocked", code: "invalid-arguments" };
  }
  const parsed = configuration(env, expiryOnly);
  if (!parsed.config) return { ...reportFor(null, "preflight"), ...parsed.report };
  if (expiryOnly) return verifyExpiry(parsed.config, args[2]);
  if (readOnly) return verifyReadOnly(parsed.config);
  return { ...reportFor(parsed.config, "preflight"), ...parsed.report };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const report = await main().catch(() => ({ schemaVersion: 1, releaseStatus: "NOT_READY", status: "failed", code: "runner-failed" }));
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.status.startsWith("passed-") || report.status === "preflight-ready" ? 0 : report.status === "failed" ? 1 : 2;
}
