import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { configuration, main, TEST_PROJECT, validateSignedUrl, verifyReadOnly, verifyExpiry } from "../scripts/verify-marketplace-integration.mjs";

const ids = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000003"];
const jwt = id => `e30.${Buffer.from(JSON.stringify({ iss: `https://${TEST_PROJECT}.supabase.co/auth/v1`, sub: id })).toString("base64url")}.fixture-signature`;
const bytes = Buffer.from("CQA controlled integration fixture\n");
const hash = createHash("sha256").update(bytes).digest("hex");
const now = Date.parse("2026-11-02T00:00:00Z");
const env = {
  CQA_TEST_BASE_URL: "https://cqa-vending-machines-test-preview-creativequality.vercel.app",
  CQA_TEST_SUPABASE_URL: `https://${TEST_PROJECT}.supabase.co`,
  CQA_TEST_ISOLATION_ACK: TEST_PROJECT, CQA_TEST_CANDIDATE_SHA: "a".repeat(40),
  CQA_TEST_R2_ACCOUNT_ID: "b".repeat(32), CQA_TEST_R2_BUCKET: "cqa-launch-test",
  CQA_TEST_BUSINESS_ID: ids[0], CQA_TEST_OFFER_ID: ids[1], CQA_TEST_ORDER_ID: ids[2],
  CQA_TEST_ASSET_SHA256: hash, CQA_TEST_SUPABASE_ANON_KEY: "sb_publishable_fixture",
  CQA_TEST_OWNER_TOKEN: jwt(ids[0]), CQA_TEST_BUYER_A_TOKEN: jwt(ids[1]), CQA_TEST_BUYER_B_TOKEN: jwt(ids[2]),
};
const config = configuration(env).config;
const url = `https://${config.account}.r2.cloudflarestorage.com/${config.bucket}/marketplace/${config.business}/${config.offer}/00000000-0000-4000-8000-000000000004.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20261102T000000Z&X-Amz-Expires=600&X-Amz-Signature=${"c".repeat(64)}`;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });

function fixtureFetch(variant = {}) {
  const calls = [];
  const fn = async (input, options = {}) => {
    const value = String(input), target = new URL(value);
    const headers = new Headers(options.headers);
    calls.push({ pathname: target.pathname, authorised: headers.has("authorization"), redirect: options.redirect });
    if (target.hostname === `${TEST_PROJECT}.supabase.co`) {
      const token = headers.get("authorization")?.replace(/^Bearer /, "");
      let index = config.tokens.indexOf(token);
      if (variant.authError) return json({ message: "token-secret-must-not-be-printed" }, 401);
      if (variant.sameIdentity && index === 2) index = 1;
      return json({ id: ids[index], email: "controlled@example.invalid", email_confirmed_at: "2026-11-01T00:00:00Z" });
    }
    if (target.hostname.endsWith(".vercel.app")) {
      const index = config.tokens.indexOf(headers.get("authorization")?.replace(/^Bearer /, ""));
      if (target.pathname === "/api/owner/marketplace-asset") return json({ offers: [{ id: config.offer, hasFile: true }] });
      if (target.pathname === "/api/marketplace/library") {
        if (index === 2 && variant.bLibraryUnauthorized) return json({}, 401);
        return json({ products: index === 1 || variant.libraryLeak ? [{ orderId: config.order, downloadable: true, title: "Never print this customer title" }] : [] });
      }
      if (target.pathname === "/api/marketplace/download") {
        if (index < 0) return json({}, 401);
        if (index === 2) return json({}, variant.bDownloadUnauthorized ? 401 : variant.downloadLeak ? 200 : 404);
        return json({ url: variant.hostileSignedUrl || url, expiresIn: 600 });
      }
    }
    if (target.hostname === `${config.account}.r2.cloudflarestorage.com`) {
      assert.equal(headers.has("authorization"), false, "Bearer credentials must never reach object storage");
      if (target.search) return new Response(variant.badDigest ? "wrong object" : bytes);
      if (variant.unsignedNetwork) throw new Error(`network secret ${url}`);
      return new Response("AccessDenied", { status: variant.publicObject ? 200 : 403 });
    }
    throw new Error(`Unexpected destination ${value}`);
  };
  return { fn, calls };
}

let groups = 0;
async function test(name, fn) { await fn(); groups++; console.log(`PASS ${name}`); }
async function cleanup(report) { if (report.privateStateFile) await fs.rm(path.dirname(report.privateStateFile), { recursive: true }); }

await test("offline default reports exact missing names without network or false integration success", async () => {
  const result = await main([], {});
  assert.equal(result.status, "blocked"); assert(result.missing.includes("CQA_TEST_OWNER_TOKEN"));
  assert.equal(result.releaseStatus, "NOT_READY"); assert(result.unverified.includes("payment-to-download"));
  assert.equal((await main([], env)).status, "preflight-ready");
});
await test("production, deceptive origins and wrong project refs fail closed", async () => {
  for (const base of ["https://www.creativequalityaustralia.tech", "http://cqa-vending-machines-test.vercel.app", "https://cqa-vending-machines.vercel.app", "https://cqa-vending-machines-test.vercel.app.evil.test", "https://user:secret@cqa-vending-machines-test.vercel.app", "https://cqa-vending-machines-test.vercel.app/path"]) {
    assert.equal(configuration({ ...env, CQA_TEST_BASE_URL: base }).report.status, "blocked");
  }
  assert.equal(configuration({ ...env, CQA_TEST_SUPABASE_URL: "https://rjxiuukphwybujuclenn.supabase.co" }).report.status, "blocked");
  assert.equal(configuration({ ...env, CQA_TEST_ISOLATION_ACK: "yes" }).report.status, "blocked");
});
await test("tokens from another project and service-role/public key confusion rejected offline", async () => {
  const other = `e30.${Buffer.from(JSON.stringify({ iss: "https://other.supabase.co/auth/v1", sub: ids[0] })).toString("base64url")}.x`;
  assert.equal(configuration({ ...env, CQA_TEST_OWNER_TOKEN: other }).report.code, "fixture-token-project-mismatch");
  const service = `e30.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.x`;
  for (const key of [service, "sb_secret_value"]) assert.equal(configuration({ ...env, CQA_TEST_SUPABASE_ANON_KEY: key }).report.code, "admin-key-not-accepted");
});
await test("live fixture identity rather than token-string inequality enforces separate accounts", async () => {
  const fake = fixtureFetch({ sameIdentity: true });
  const report = await verifyReadOnly(config, { fetchImpl: fake.fn, now: () => now });
  assert.equal(report.status, "blocked"); assert.equal(report.checks.at(-1).code, "fixture-identities-must-be-distinct");
  assert(fake.calls.every(call => call.pathname === "/auth/v1/user"));
});
await test("provider auth failure does not leak error payloads or continue application probes", async () => {
  const fake = fixtureFetch({ authError: true });
  const report = await verifyReadOnly(config, { fetchImpl: fake.fn, now: () => now });
  assert.equal(report.status, "blocked"); assert(!JSON.stringify(report).includes("token-secret"));
  assert(fake.calls.every(call => call.pathname === "/auth/v1/user"));
});
await test("genuine-probe driver checks fixture digest, distinct-account denial and keeps expiry pending", async () => {
  const fake = fixtureFetch(); const report = await verifyReadOnly(config, { fetchImpl: fake.fn, now: () => now });
  try {
    assert.equal(report.status, "passed-requested-read-only-probes");
    assert.equal(report.checks.at(-1).result, "pending");
    assert.equal(report.releaseStatus, "NOT_READY");
    assert(report.unverified.includes("bucket-public-configuration"));
    const text = JSON.stringify(report); assert(!text.includes("X-Amz")); assert(!text.includes("controlled@example")); assert(!text.includes("customer title"));
    const state = JSON.parse(await fs.readFile(report.privateStateFile, "utf8"));
    assert.equal(state.url, url); assert.equal((await fs.stat(report.privateStateFile)).mode & 0o777, 0o600);
    assert(fake.calls.every(call => call.redirect === "error"));
  } finally { await cleanup(report); }
});
await test("a returned library order from the second account fails isolation", async () => {
  const report = await verifyReadOnly(config, { fetchImpl: fixtureFetch({ libraryLeak: true }).fn, now: () => now });
  assert.equal(report.status, "failed"); assert.equal(report.checks.at(-1).code, "buyer-library-isolation-failed");
});
await test("second buyer successful download status is a failure", async () => {
  const report = await verifyReadOnly(config, { fetchImpl: fixtureFetch({ downloadLeak: true }).fn, now: () => now });
  assert.equal(report.checks.at(-1).code, "other-buyer-download-not-denied");
});
await test("second buyer application authentication failure cannot count as isolation", async () => {
  const report = await verifyReadOnly(config, { fetchImpl: fixtureFetch({ bLibraryUnauthorized: true }).fn, now: () => now });
  assert.equal(report.status, "blocked");
  assert.equal(report.checks.at(-1).code, "library-api-not-available");
  assert(!report.checks.some(check => check.id === "buyer-library-and-isolation" && check.result === "passed"));
});
await test("second buyer download 401 is not accepted as ownership denial", async () => {
  const report = await verifyReadOnly(config, { fetchImpl: fixtureFetch({ bDownloadUnauthorized: true }).fn, now: () => now });
  assert.equal(report.status, "failed");
  assert.equal(report.checks.at(-1).code, "other-buyer-download-not-denied");
});
await test("HTTP 200 wrong bytes cannot count as a successful download", async () => {
  const report = await verifyReadOnly(config, { fetchImpl: fixtureFetch({ badDigest: true }).fn, now: () => now });
  assert.equal(report.checks.at(-1).code, "download-content-digest-mismatch"); assert(!report.privateStateFile);
});
await test("unsigned endpoint 403 is a narrow pass; network errors and public bytes are different failures", async () => {
  for (const [variant, status, code] of [[{ unsignedNetwork: true }, "blocked", "network-request-failed"], [{ publicObject: true }, "failed", "unsigned-object-access-not-confirmed-denied"]]) {
    const report = await verifyReadOnly(config, { fetchImpl: fixtureFetch(variant).fn, now: () => now });
    try { assert.equal(report.status, status); assert.equal(report.checks.at(-1).code, code); }
    finally { await cleanup(report); }
  }
});
await test("hostile signed URL is never followed or disclosed", async () => {
  const hostile = "https://evil.example.test/collect?secret=sensitive";
  const fake = fixtureFetch({ hostileSignedUrl: hostile });
  const report = await verifyReadOnly(config, { fetchImpl: fake.fn, now: () => now });
  assert.equal(report.checks.at(-1).code, "download-origin-mismatch"); assert(!JSON.stringify(report).includes("sensitive"));
});
await test("signature lifetime and tenant scope must match the actual implementation", async () => {
  for (const altered of [url.replace("Expires=600", "Expires=60"), url.replace(`/marketplace/${config.business}/`, "/marketplace/other/"), url + "&X-Amz-Expires=600"]) assert.throws(() => validateSignedUrl(altered, config));
});
await test("expiry recheck is pending before actual expiry and sends the SAME stored URL afterward", async () => {
  const report = await verifyReadOnly(config, { fetchImpl: fixtureFetch().fn, now: () => now });
  try {
    let calls = 0;
    const before = await verifyExpiry(config, report.privateStateFile, { now: () => now + 599000, fetchImpl: async () => { calls++; throw new Error(); } });
    assert.equal(before.status, "pending"); assert.equal(calls, 0);
    const expired = await verifyExpiry(config, report.privateStateFile, { now: () => now + 606000, fetchImpl: async input => { calls++; assert.equal(input, url); return new Response("Expired", { status: 403 }); } });
    assert.equal(expired.status, "passed-requested-expiry-probe"); assert.equal(calls, 1); assert(!JSON.stringify(expired).includes("X-Amz"));
    assert(expired.unverified.includes("refund-revocation"));
  } finally { await cleanup(report); }
});
await test("expiry accepts neither network errors nor a still-working signed URL", async () => {
  const report = await verifyReadOnly(config, { fetchImpl: fixtureFetch().fn, now: () => now });
  try {
    const failure = await verifyExpiry(config, report.privateStateFile, { now: () => now + 606000, fetchImpl: async () => { throw new Error(url); } });
    assert.equal(failure.status, "blocked"); assert(!JSON.stringify(failure).includes("X-Amz"));
    const stillWorks = await verifyExpiry(config, report.privateStateFile, { now: () => now + 606000, fetchImpl: async () => new Response(bytes) });
    assert.equal(stillWorks.status, "failed");
  } finally { await cleanup(report); }
});
await test("private expiry state rejects tampering, broad permissions and arbitrary paths", async () => {
  const report = await verifyReadOnly(config, { fetchImpl: fixtureFetch().fn, now: () => now });
  try {
    assert.equal((await verifyExpiry(config, "/tmp/unrelated.json")).status, "blocked");
    await fs.chmod(report.privateStateFile, 0o644);
    assert.equal((await verifyExpiry(config, report.privateStateFile)).checks[0].code, "unsafe-private-state-file");
    await fs.chmod(report.privateStateFile, 0o600);
    const state = JSON.parse(await fs.readFile(report.privateStateFile, "utf8")); state.candidateSha = "d".repeat(40);
    await fs.writeFile(report.privateStateFile, JSON.stringify(state));
    assert.equal((await verifyExpiry(config, report.privateStateFile)).checks[0].code, "private-state-scope-mismatch");
  } finally { await cleanup(report); }
});
await test("unknown flags and incompatible probe modes fail closed", async () => {
  assert.equal((await main(["--upload-test-file"], env)).code, "invalid-arguments");
  assert.equal((await main(["--verify-read-only", "--verify-expiry"], env)).code, "invalid-arguments");
});
await test("malformed state-file and repeated modes cannot enable a probe", async () => {
  for (const args of [
    ["--state-file"], ["--state-file", "/tmp/example"],
    ["--state-file", "--verify-read-only"],
    ["--verify-expiry"], ["--verify-expiry", "--state-file"],
    ["--verify-read-only", "--state-file", "/tmp/example"],
    ["--verify-read-only", "--verify-read-only"],
    ["--verify-expiry", "--state-file", "/tmp/example", "--state-file", "/tmp/other"],
  ]) assert.equal((await main(args, {})).code, "invalid-arguments", args.join(" "));
});
await test("other team preview hostnames and repository temp roots are refused", async () => {
  assert.equal(configuration({ ...env, CQA_TEST_BASE_URL: "https://cqa-vending-machines-test-preview-otherteam.vercel.app" }).report.code, "preview-origin-not-allowed");
  const previous = process.env.TMPDIR;
  process.env.TMPDIR = process.cwd();
  try {
    const report = await verifyReadOnly(config, { fetchImpl: fixtureFetch().fn, now: () => now });
    assert.equal(report.status, "blocked");
    assert.equal(report.checks.at(-1).code, "private-state-root-inside-repository");
    assert(!report.privateStateFile);
  } finally {
    if (previous === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previous;
  }
});
console.log(`PASS ${groups} integration-runner behavioural groups (providers mocked; no genuine integration claim)`);
