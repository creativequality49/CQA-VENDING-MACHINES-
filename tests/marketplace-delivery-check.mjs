import { resolvePurchasedDigitalAsset } from "./marketplace-asset-test-module.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

const source = fs.readFileSync("lib/cqa-marketplace-delivery.ts", "utf8")
  .replace(/^import .*;\r?\n/gm, "").replace(/export /g, "");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const orderId = "00000000-0000-4000-8000-000000000001";
const business = "00000000-0000-4000-8000-000000000002";
const machine = "00000000-0000-4000-8000-000000000003";
const offerId = "00000000-0000-4000-8000-000000000004";
const purchasedKey = `marketplace/${business}/${offerId}/00000000-0000-4000-8000-000000000007.pdf`;
const purchasedAsset = { key: purchasedKey, sizeBytes: 64, contentType: "application/pdf" };
for (const variant of [
  { name: "unbound legacy purchase cannot sign a replacement file", expected: 409 },
  { name: "replaced pack signs the purchased version", bound: purchasedAsset, expected: 200 },
  { name: "unlisted pack still delivers the purchased version", bound: purchasedAsset, mismatchedOffer: true, expected: 200 },
  { name: "invalid purchase binding never signs the replacement", bound: null, expected: 409 },
  { name: "foreign purchase binding never signs the replacement", bound: { ...purchasedAsset, key: "marketplace/other/offer/file.pdf" }, expected: 409 },
  { name: "refunded bound purchase stays revoked", bound: purchasedAsset, orderStatus: "refunded", expected: 404 },
  { name: "second buyer cannot use bound purchase", bound: purchasedAsset, buyerId: "buyer-b", expected: 404 },
  { name: "unpaid buyer", orderStatus: "pending", expected: 404 },
  { name: "different buyer", buyerId: "other-user", expected: 404 },
  { name: "unbound legacy email order", buyerId: null, expected: 404 },
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
    buyer_user_id: Object.hasOwn(variant, "buyerId") ? variant.buyerId : "buyer", status: variant.orderStatus || "paid" };
  if (Object.hasOwn(variant, "bound")) order.purchase_snapshot = {
    title: "Purchased pack", offerType: "digital_product", fulfillmentType: "digital", digitalAsset: variant.bound
  };
  const offer = { id: offerId, business_id: business, machine_id: machine, offer_type: "digital_product",
    fulfillment_type: "digital", fulfillment_config: { asset_key: variant.assetKey || `marketplace/${business}/${offerId}/file.pdf` } };
  const admin = { from(table) {
    const filters = [];
    const q = { select() { return q; }, eq(k,v) { filters.push([k,v]); return q; },
      async maybeSingle() { return { data: table === "cqa_orders" ? (variant.missing ? null : order) :
        variant.mismatchedOffer ? null : offer, error: null }; } };
    return q;
  } };
  const fn = new Function("resolvePurchasedDigitalAsset", "getPublicSupabaseClient", "getCqaSupabaseAdmin", "createSignedDownloadUrl",
    compiled + ";return resolveMarketplaceDownload;")(
    resolvePurchasedDigitalAsset, () => ({ auth: { getUser: async () => variant.invalid ? { data: {}, error: Error("bad token") } :
      { data: { user: { id: "buyer", email: "buyer@example.test",
        email_confirmed_at: variant.verified === false ? null : "2026-10-28" } }, error: null } } }),
    () => admin, async key => { assert.equal(key, variant.bound ? purchasedKey : offer.fulfillment_config.asset_key); signed++; return { url: "https://private.example.test/signed", expiresIn: 600 }; }
  );
  const result = await fn("verified-token", orderId);
  assert.equal(result.status, variant.expected, variant.name);
  assert.equal(signed, variant.expected === 200 ? 1 : 0, variant.name + " must not sign");
  console.log("PASS " + variant.name);
}

const db = new PGlite();
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create table public.cqa_orders (
      id text primary key, purchase_snapshot jsonb, status text, business_id text, machine_id text, offer_id text
    );
  `);
  const migrationPath = "supabase/migrations/20261125233000_protect_purchased_digital_asset.sql";
  await db.exec(fs.readFileSync(migrationPath, "utf8"));
  const snapshot = { title: "Original", offerType: "digital_product", fulfillmentType: "digital", digitalAsset: purchasedAsset };
  await db.query("insert into cqa_orders values ($1, $2, 'pending', $3, $4, $5)",
    [orderId, JSON.stringify(snapshot), business, machine, offerId]);
  for (const mutation of [
    "purchase_snapshot = purchase_snapshot - 'digitalAsset'",
    "purchase_snapshot = jsonb_set(purchase_snapshot, '{digitalAsset,key}', '\"other.pdf\"')",
    "business_id = 'another-business'", "machine_id = 'another-machine'", "offer_id = 'another-offer'"
  ]) {
    await assert.rejects(() => db.exec(`update cqa_orders set ${mutation}`), /Cannot change the file or catalogue binding/);
  }
  await db.exec("update cqa_orders set status = 'paid'");
  await db.exec("update cqa_orders set status = 'refunded'");
  const { rows } = await db.query("select status, purchase_snapshot from cqa_orders where id = $1", [orderId]);
  assert.deepEqual(rows, [{ status: "refunded", purchase_snapshot: snapshot }]);
  console.log("PASS PostgreSQL preserves the exact purchased file and permits settlement and refund updates");
} finally {
  await db.close();
}
