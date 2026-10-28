import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";

const source = fs.readFileSync("lib/cqa-marketplace-delivery.ts", "utf8")
  .replace(/^import .*;\r?\n/gm, "").replace(/export /g, "");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const orderId = "00000000-0000-4000-8000-000000000001";
const business = "00000000-0000-4000-8000-000000000002";
const machine = "00000000-0000-4000-8000-000000000003";
const offerId = "00000000-0000-4000-8000-000000000004";
for (const variant of [
  { name: "paid buyer", expected: 200 },
  { name: "unpaid buyer", orderStatus: "pending", expected: 404 },
  { name: "different buyer", email: "someone-else@example.test", expected: 404 },
  { name: "unverified email", verified: false, expected: 401 },
  { name: "invalid token", invalid: true, expected: 401 },
  { name: "other tenant asset", assetKey: "marketplace/other/offer/file.pdf", expected: 409 },
  { name: "public media key", assetKey: "cqa-machine-media/public.pdf", expected: 409 },
  { name: "path traversal", assetKey: `marketplace/${business}/${offerId}/../secret.pdf`, expected: 409 },
  { name: "cross-business offer", mismatchedOffer: true, expected: 404 },
  { name: "missing order", missing: true, expected: 404 }
]) {
  let signed = 0;
  const order = { id: orderId, business_id: business, machine_id: machine, offer_id: offerId,
    customer_email: variant.email || "buyer@example.test", status: variant.orderStatus || "paid" };
  const offer = { id: offerId, business_id: business, machine_id: machine, offer_type: "digital_product",
    fulfillment_type: "digital", fulfillment_config: { asset_key: variant.assetKey || `marketplace/${business}/${offerId}/file.pdf` } };
  const admin = { from(table) {
    const filters = [];
    const q = { select() { return q; }, eq(k,v) { filters.push([k,v]); return q; },
      async maybeSingle() { return { data: table === "cqa_orders" ? (variant.missing ? null : order) :
        variant.mismatchedOffer ? null : offer, error: null }; } };
    return q;
  } };
  const fn = new Function("getPublicSupabaseClient", "getCqaSupabaseAdmin", "createSignedDownloadUrl",
    compiled + ";return resolveMarketplaceDownload;")(
    () => ({ auth: { getUser: async () => variant.invalid ? { data: {}, error: Error("bad token") } :
      { data: { user: { id: "buyer", email: "buyer@example.test",
        email_confirmed_at: variant.verified === false ? null : "2026-10-28" } }, error: null } } }),
    () => admin, async () => { signed++; return { url: "https://private.example.test/signed", expiresIn: 600 }; }
  );
  const result = await fn("verified-token", orderId);
  assert.equal(result.status, variant.expected, variant.name);
  assert.equal(signed, variant.expected === 200 ? 1 : 0, variant.name + " must not sign");
  console.log("PASS " + variant.name);
}
