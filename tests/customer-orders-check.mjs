import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";
const O = "33333333-3333-4333-8333-333333333333", P = "44444444-4444-4444-8444-444444444444";
function harness() {
  const state = {
    calls: [], signatures: [], rpcCalls: [], authCalls: [], rpcError: null, revokeDuringSigning: false, offerType: "service", fulfillmentType: "manual",
    orders: [{ id: O, business_id: "business-a", machine_id: "machine-a", offer_id: "offer-a", buyer_user_id: A, customer_user_id: A, status: "paid", amount_cents: 4900, currency: "aud", created_at: "2026-01-02" },
      { id: P, business_id: "business-a", machine_id: "machine-a", offer_id: "offer-a", buyer_user_id: null, customer_user_id: A, status: "refunded", amount_cents: 4900, currency: "aud", created_at: "2026-01-01" },
      { id: "55555555-5555-4555-8555-555555555555", business_id: "business-b", machine_id: "machine-b", offer_id: "offer-b", buyer_user_id: B, customer_user_id: B, status: "paid" }],
    workspaces: [{ order_id: O, business_id: "business-a", state: "delivered", intake: { businessName: "Client", goals: "A functioning site", details: "Brand notes", secret: "never return" }, delivery_message: "Your delivery is ready", asset_key: `fulfillment/business-a/${O}/site.zip`, asset_name: "site.zip", revision: 2, updated_at: "2026-01-03" }]
  };
  const admin = {
    from(table) {
      const call = { table, filters: [], or: null, range: null, limit: null, columns: null };
      state.calls.push(call);
      const query = {
        select(columns) { call.columns = columns; return query; },
        eq(key, value) { call.filters.push([key, value]); return query; },
        in(key, value) { call.filters.push([key, value]); return query; },
        or(value) { assert.match(value, /^customer_user_id\.eq\.[a-f\d-]{36},buyer_user_id\.eq\.[a-f\d-]{36}$/); call.or = value; return query; },
        order() { return query; }, range(from, to) { call.range = [from, to]; return query; }, limit(value) { call.limit = value; return query; },
        maybeSingle() { return Promise.resolve({ data: rows()[0] || null, error: null }); },
        then(resolve, reject) { return Promise.resolve({ data: rows(), error: null }).then(resolve, reject); }
      };
      function rows() {
        let rows = table === "cqa_orders" ? state.orders : table === "cqa_order_workspaces" ? state.workspaces : table === "cqa_offers"
          ? state.missingOffer ? [] : [{ id: "offer-a", business_id: "business-a", machine_id: "machine-a", name: "Website build", offer_type: state.offerType, fulfillment_type: state.fulfillmentType, fulfillment_config: { secret: "not selected" } }]
          : table === "cqa_businesses" ? [{ id: "business-a", name: "Agency" }] : table === "cqa_machines" ? [{ id: "machine-a", business_id: "business-a", slug: "agency" }]
          : [{ id: "event-1", order_id: O, actor_user_id: B, actor_role: "owner", kind: "delivered", message: "Delivery ready", created_at: "2026-01-03" }];
        rows = rows.filter(row => call.filters.every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : row[key] === value));
        if (call.or) { const userId = call.or.split(",")[0].split(".").at(-1); rows = rows.filter(row => row.customer_user_id === userId || row.buyer_user_id === userId); }
        if (call.range) rows = rows.slice(call.range[0], call.range[1] + 1);
        if (call.limit) rows = rows.slice(0, call.limit);
        return rows.map(row => Object.fromEntries(call.columns.split(",").filter(key => key in row).map(key => [key, row[key]])));
      }
      return query;
    },
    async rpc(name, args) {
      state.rpcCalls.push({ name, args });
      if (state.rpcError) return { data: null, error: state.rpcError };
      if (Object.hasOwn(state, "rpcResponse")) return { data: state.rpcResponse, error: null };
      state.workspaces[0] = { ...state.workspaces[0], intake: args.p_payload, state: "queued", revision: 3 };
      return { data: { workspace: state.workspaces[0] }, error: null };
    }
  };
  const source = ts.transpileModule(fs.readFileSync("lib/cqa-customer-orders.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, Response, URL, console, require(id) {
    if (id === "server-only") return {};
    if (id === "@/lib/cqa-supabase-admin") return { getCqaSupabaseAdmin: () => admin };
    if (id === "@/lib/cqa-marketplace") return { getPublicSupabaseClient: () => ({ auth: { getUser: async token => {
      state.authCalls.push(token);
      return { error: token === "invalid" ? new Error("invalid") : null, data: { user: { id: token === "malformed-id" ? "bad,id" : A, email: "buyer@example.test", email_confirmed_at: token === "unconfirmed" ? null : "2026-01-01", is_anonymous: token === "anonymous" } } };
    } } }) };
    if (id === "@/lib/storage") return { createSignedDownloadUrl: async key => { state.signatures.push(key); if (state.revokeDuringSigning) state.orders[0].status = "refunded"; return { url: "https://private.test/signed", expiresIn: 600 }; } };
    return require(id);
  } });
  function route(path) {
    const compiled = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const moduleExports = {};
    vm.runInNewContext(compiled, { exports: moduleExports, Response, URL, require(id) { if (id === "@/lib/cqa-customer-orders") return exports; return require(id); } });
    return moduleExports;
  }
  return { state, api: exports, route };
}
const rejects = (promise, status) => assert.rejects(promise, error => error.status === status);
{
  const { api, state } = harness();
  await rejects(api.requireCustomerOrderUser(new Request("https://app.test/orders?session_id=cs_stolen")), 401);
  for (const token of ["invalid", "unconfirmed", "anonymous", "malformed-id"]) await rejects(api.requireCustomerOrderUser(new Request("https://app.test", { headers: { Authorization: `Bearer ${token}` } })), 401);
  assert.equal(await api.requireCustomerOrderUser(new Request("https://app.test", { headers: { Authorization: "Bearer verified" } })), A);
  assert.equal(state.calls.length, 0, "Identity failures cannot query private orders");
  assert.equal(state.authCalls.length, 5, "Tokens are verified remotely instead of decoded locally");
}
{
  const { api, state } = harness();
  const snapshot = { title: "Original monthly operations", offerType: "subscription", fulfillmentType: "subscription", asset_key: "never-return-snapshot-key", fulfillment_config: { secret: "never-return-snapshot-config" } };
  state.orders[0].purchase_snapshot = snapshot;
  state.offerType = "digital_product"; state.fulfillmentType = "digital";
  let saved = await api.getCustomerOrder(A, O);
  assert.equal(saved.title, snapshot.title); assert.equal(saved.offerType, "subscription"); assert.equal(saved.fulfillmentType, "subscription");
  assert.ok(!JSON.stringify(saved).includes("never-return-snapshot"));
  assert.ok(!JSON.stringify(saved).includes("purchase_snapshot"));
  assert.match(state.calls.find(call => call.table === "cqa_orders").columns, /purchase_snapshot/);
  state.missingOffer = true;
  saved = await api.getCustomerOrder(A, O);
  assert.equal(saved.title, snapshot.title); assert.equal(saved.offerType, "subscription", "A removed current offer must not erase historical purchase type");
  for (const invalid of [null, [], {}, { ...snapshot, title: { secret: true } }, { ...snapshot, offerType: "unknown" }, { ...snapshot, fulfillmentType: {} }]) {
    state.orders[0].purchase_snapshot = invalid;
    state.workspaces = [];
    saved = await api.getCustomerOrder(A, O);
    assert.equal(saved.title, "Order"); assert.equal(saved.offerType, null); assert.equal(saved.fulfillmentType, null);
    assert.equal(saved.workspace.state, "awaiting_intake", "Malformed snapshots cannot classify an unknown order as digital");
  }
  state.missingOffer = false;
  state.orders[0].purchase_snapshot = { title: "Original service", offerType: "service", fulfillmentType: null };
  saved = await api.getCustomerOrder(A, O);
  assert.equal(saved.fulfillmentType, null, "A valid null snapshot field must not fall back to an edited digital offer");
  state.orders[0].purchase_snapshot = { title: "Original digital kit", offerType: "digital_product", fulfillmentType: "digital" };
  state.offerType = "service"; state.fulfillmentType = "service";
  await rejects(api.submitCustomerOrderIntake(A, O, { businessName: "Client", goals: "Goals", details: "", expectedRevision: 2 }), 409);
  assert.equal(state.rpcCalls.length, 0, "Historical digital purchases cannot become service intake after editing the current offer");
}
{
  const { api, state } = harness();
  const page = await api.listCustomerOrders(A, 1, 0);
  assert.equal(page.orders.length, 1); assert.equal(page.hasMore, true); assert.equal(page.nextOffset, 1); assert.equal(page.nextCursor, "1");
  assert.deepEqual(state.calls[0].range, [0, 1]);
  assert.match(state.calls[0].or, /customer_user_id/);
  const next = await api.listCustomerOrders(A, 1, 1);
  assert.equal(next.orders[0].paymentStatus, "refunded", "Durable identity retains refunded purchase history");
  assert.equal(next.nextCursor, null);
  const detail = await api.getCustomerOrder(A, O);
  assert.equal(detail.title, "Website build"); assert.equal(detail.workspace.hasAsset, true); assert.equal(detail.events.length, 1);
  const json = JSON.stringify(detail);
  for (const forbidden of ["fulfillment_config", "asset_key", "actor_user_id", "never return", "fulfillment/business-a"]) assert.ok(!json.includes(forbidden));
  state.orders[0].status = "refunded";
  const revoked = await api.getCustomerOrder(A, O);
  assert.equal(revoked.workspace.hasAsset, false); assert.equal(revoked.workspace.deliveryMessage, ""); assert.equal(revoked.workspace.assetName, "");
  state.orders[0].status = "paid";
  state.workspaces[0].business_id = "business-b";
  const mismatched = await api.getCustomerOrder(A, O); assert.equal(mismatched.workspace.hasAsset, false); assert.equal(mismatched.workspace.deliveryMessage, "");
  state.workspaces[0].business_id = "business-a";
  await rejects(api.getCustomerOrder(B, O), 404);
  await rejects(api.getCustomerOrder(A, "invalid"), 400);
  await rejects(api.listCustomerOrders("bad,id", 1, 0), 401);
  assert.throws(() => api.customerOrderPagination("https://app.test?limit=51"), error => error.status === 400);
  assert.throws(() => api.customerOrderPagination("https://app.test?cursor=-1"), error => error.status === 400);
}
{
  const { api, state } = harness();
  const body = { businessName: "Client", goals: "A functioning site", details: "Brand notes", expectedRevision: 2 };
  await rejects(api.submitCustomerOrderIntake(B, O, body), 404);
  await rejects(api.submitCustomerOrderIntake(A, P, body), 409);
  await rejects(api.submitCustomerOrderIntake(A, O, { ...body, ownerId: B }), 400);
  assert.equal(state.rpcCalls.length, 0);
  state.offerType = "digital_product"; state.fulfillmentType = "digital";
  await rejects(api.submitCustomerOrderIntake(A, O, body), 409);
  assert.equal(state.rpcCalls.length, 0, "Digital purchases cannot submit service intake");
  state.offerType = "service"; state.fulfillmentType = "manual";
  const saved = await api.submitCustomerOrderIntake(A, O, body);
  assert.equal(saved.workspace.state, "queued"); assert.equal(saved.workspace.revision, 3);
  const rpc = state.rpcCalls[0]; assert.equal(rpc.name, "cqa_update_order_workspace"); assert.equal(rpc.args.p_actor_user_id, A); assert.equal(rpc.args.p_expected_revision, 2); assert.equal(rpc.args.p_action, "submit_intake");
  assert.equal(rpc.args.p_payload.expectedRevision, undefined);
  for (const [code, status] of [["40001", 409], ["23514", 409], ["42501", 404], ["P0002", 404]]) {
    state.rpcError = { code, message: "update rejected" };
    await rejects(api.submitCustomerOrderIntake(A, O, body), status);
  }
}
{
  const { api, route, state } = harness();
  const body = { businessName: "Client", goals: "A functioning site", details: "Brand notes", expectedRevision: 2 };
  const workspace = { order_id: O, business_id: "business-a", revision: 3, state: "queued" };
  for (const response of [null, {}, { workspace: null }, { workspace: { ...workspace, order_id: P } },
    { workspace: { ...workspace, business_id: "business-b" } }, { workspace: { ...workspace, revision: 2 } },
    { workspace: { ...workspace, revision: 4 } }, { workspace: { ...workspace, state: "delivered" } }]) {
    state.rpcResponse = response;
    await rejects(api.submitCustomerOrderIntake(A, O, body), 409);
  }
  const intake = route("app/api/customer/orders/[orderId]/intake/route.ts").POST;
  const response = await intake(new Request("https://app.test/intake", { method: "POST", headers: { authorization: "Bearer verified" }, body: JSON.stringify(body) }), { params: Promise.resolve({ orderId: O }) });
  assert.equal(response.status, 409, "The actual endpoint must not claim success for an unconfirmed mutation");
  assert.equal((await response.json()).order, undefined);
}
{
  const { api, state } = harness();
  await rejects(api.downloadCustomerOrderAsset(B, O), 404);
  await rejects(api.downloadCustomerOrderAsset(A, P), 404);
  const initial = state.workspaces[0].asset_key;
  for (const key of [`fulfillment/business-b/${O}/site.zip`, `${initial}/../secret`, `${initial}?x=y`, `${initial}%2fsecret`, `https://public.test/file`, `${initial}\\secret`]) {
    state.workspaces[0].asset_key = key;
    await rejects(api.downloadCustomerOrderAsset(A, O), 409);
  }
  assert.equal(state.signatures.length, 0);
  state.workspaces[0].asset_key = initial;
  state.workspaces[0].state = "in_progress";
  await rejects(api.downloadCustomerOrderAsset(A, O), 409);
  state.workspaces[0].state = "delivered";
  assert.equal((await api.downloadCustomerOrderAsset(A, O)).expiresIn, 600);
  state.revokeDuringSigning = true;
  await rejects(api.downloadCustomerOrderAsset(A, O), 404);
}
{
  const { route, state } = harness();
  const list = route("app/api/customer/orders/route.ts").GET;
  const unauthorized = await list(new Request("https://app.test/api/customer/orders?session_id=cs_stolen"));
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.headers.get("cache-control"), "no-store");
  const excessive = await list(new Request("https://app.test/api/customer/orders?limit=2000", { headers: { authorization: "Bearer verified" } }));
  assert.equal(excessive.status, 400);
  const result = await list(new Request("https://app.test/api/customer/orders", { headers: { authorization: "Bearer verified" } }));
  assert.equal(result.status, 200); assert.equal((await result.json()).orders.length, 2);
  const intake = route("app/api/customer/orders/[orderId]/intake/route.ts").POST;
  const request = body => new Request("https://app.test/intake", { method: "POST", headers: { authorization: "Bearer verified" }, body });
  const context = { params: Promise.resolve({ orderId: O }) };
  assert.equal((await intake(request("{"), context)).status, 400);
  assert.equal((await intake(request("x".repeat(20001)), context)).status, 400);
  assert.equal(state.rpcCalls.length, 0, "Malformed and oversized bodies never reach mutation RPC");
}
console.log("PASS customer orders: verified identity, durable history, tenant scoping, pagination, intake concurrency, private delivery, revocation race");
