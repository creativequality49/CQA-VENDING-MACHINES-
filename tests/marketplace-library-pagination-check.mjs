import { resolvePurchasedDigitalAsset } from "./marketplace-asset-test-module.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("app/api/marketplace/library/route.ts", "utf8")
  .replace(/^import .*;\r?\n/gm, "")
  .replace('export const runtime = "nodejs";', 'const runtime = "nodejs";')
  .replace("export async function GET", "async function GET");
const compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None
} }).outputText;
let adminCalls = 0;
const route = new Function("resolvePurchasedDigitalAsset", "NextResponse", "getPublicSupabaseClient", "getCqaSupabaseAdmin",
  compiled + ";return GET;")(
  resolvePurchasedDigitalAsset, { json: (body, init = {}) => new Response(JSON.stringify(body), init) },
  () => ({ auth: { getUser: async token => token === "buyer-token"
    ? { data: { user: { id: "buyer-a", email: "buyer@example.test", email_confirmed_at: "2026-01-01" } }, error: null }
    : token === "anonymous-token"
      ? { data: { user: { id: "anonymous-user", email: "anonymous@example.test", email_confirmed_at: "2026-01-01", is_anonymous: true } }, error: null }
      : { data: {}, error: new Error("Invalid token") } } }),
  () => { adminCalls++; return admin; }
);

const orders = Array.from({ length: 1005 }, (_, index) => ({
  id: `order-${String(index).padStart(4, "0")}`,
  business_id: index === 1004 ? "different-business" : "business-a",
  machine_id: index === 1003 ? "different-machine" : "machine-a",
  offer_id: `offer-${String(index).padStart(4, "0")}`,
  status: "paid",
  buyer_user_id: "buyer-a",
  created_at: new Date(Date.UTC(2026, 0, 1) + (1005 - index) * 1000).toISOString()
}));
orders.push({ ...orders[0], id: "other-buyer-order", buyer_user_id: "buyer-b" });
orders.push({ ...orders[0], id: "refunded-order", status: "refunded" });
const offers = orders.map(order => ({
  id: order.offer_id,
  business_id: "business-a",
  machine_id: "machine-a",
  name: `Product ${order.id}`,
  offer_type: "digital_product",
  fulfillment_type: "digital",
  fulfillment_config: { asset_key: `marketplace/business-a/${order.offer_id}/file.zip` }
}));
const originalAsset = { key: "marketplace/business-a/offer-0010/original.pdf", sizeBytes: 64, contentType: "application/pdf" };
orders[10].purchase_snapshot = { title: "Purchased edition", offerType: "digital_product", fulfillmentType: "digital", digitalAsset: originalAsset };
orders[11].purchase_snapshot = { ...orders[10].purchase_snapshot, digitalAsset: null };
offers[10].fulfillment_config = {};
const orderRanges = [];
const offerBatches = [];
const admin = { from(table) {
  const filters = {};
  let range;
  const query = {
    select() { return query; },
    eq(key, value) { filters[key] = value; return query; },
    order() { return query; },
    range(from, to) { range = [from, to]; return query; },
    in(key, values) { filters[key] = values; return query; },
    then(resolve, reject) {
      const result = table === "cqa_orders"
        ? (() => {
          orderRanges.push(range);
          assert.equal(filters.status, "paid");
          assert.equal(filters.buyer_user_id, "buyer-a");
          return { data: orders.filter(order => order.status === filters.status && order.buyer_user_id === filters.buyer_user_id)
            .slice(range[0], range[1] + 1), error: null };
        })()
        : (() => {
          offerBatches.push(filters.id);
          return { data: offers.filter(offer => filters.id.includes(offer.id)), error: null };
        })();
      return Promise.resolve(result).then(resolve, reject);
    }
  };
  return query;
} };

const response = await route(new Request("https://example.test/api/marketplace/library", {
  headers: { authorization: "Bearer buyer-token" }
}));
assert.equal(response.status, 200);
const body = await response.json();
assert.equal(body.products.length, 1003, "all eligible purchases beyond the first 100 must be returned; tenant mismatches stay hidden");
assert.ok(body.products.some(product => product.orderId === "order-1002"), "the oldest purchase remains in the library");
assert.ok(!body.products.some(product => ["order-1003", "order-1004", "other-buyer-order", "refunded-order"].includes(product.orderId)), "tenant mismatch, other buyer and refunded orders stay hidden");
assert.deepEqual(orderRanges, [[0, 499], [500, 999], [1000, 1499]]);
assert.equal(offerBatches.length, 11, "offers are fetched in bounded batches instead of once per order");
assert.ok(offerBatches.every(batch => batch.length <= 100));
const purchased = body.products.find(product => product.orderId === orders[10].id);
assert.equal(purchased.title, "Purchased edition");
assert.equal(purchased.downloadable, true, "replacement cannot disable the purchased file");
assert.equal(body.products.find(product => product.orderId === orders[11].id)?.downloadable, false);
assert.ok(body.products.filter(product => product.orderId !== orders[10].id).every(product => !product.downloadable), "an unbound purchase stays visible without exposing a replacement file");
assert.doesNotMatch(JSON.stringify(body), /marketplace\//, "library responses keep private object keys off the client");
console.log("PASS full buyer purchase history is paged and offers are batched with tenant binding");

const invalid = await route(new Request("https://example.test/api/marketplace/library", {
  headers: { authorization: "Bearer invalid-token" }
}));
assert.equal(invalid.status, 401);
console.log("PASS invalid buyer token cannot load the library");

const adminCallsBeforeAnonymous = adminCalls;
const rangesBeforeAnonymous = orderRanges.length;
const anonymous = await route(new Request("https://example.test/api/marketplace/library", {
  headers: { authorization: "Bearer anonymous-token" }
}));
assert.equal(anonymous.status, 401);
assert.equal(adminCalls, adminCallsBeforeAnonymous, "anonymous account must not instantiate privileged database client");
assert.equal(orderRanges.length, rangesBeforeAnonymous, "anonymous account must not query orders");
console.log("PASS authenticated-looking anonymous account is rejected before privileged database access");
