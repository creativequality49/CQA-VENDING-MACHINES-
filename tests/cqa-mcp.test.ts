import { test } from "node:test";
import assert from "node:assert/strict";
import { createCqaMcpHandler } from "../lib/cqa-mcp";

const businessId = "11111111-1111-4111-8111-111111111111";
const foreignId = "22222222-2222-4222-8222-222222222222";
const queries: Array<[string, unknown]> = [];
const handle = createCqaMcpHandler({ authorize: async (req, id) => {
  if (req.headers.get("authorization") !== "Bearer valid") throw Object.assign(new Error(), { status: 401 });
  if (id && id !== businessId) throw Object.assign(new Error(), { status: 403 });
  return { business: { id: businessId, name: "Test" }, admin: { from: () => {
    const query = { select: () => query, eq: (column: string, value: unknown) => { queries.push([column, value]); return query; }, order: () => query, limit: async () => ({ data: [], error: null }) };
    return query;
  } } };
} });
function req(body: unknown, extra: Record<string, string> = {}) {
  return new Request("https://example.com/api/mcp", { method: "POST", headers: { authorization: "Bearer valid", accept: "application/json, text/event-stream", "content-type": "application/json", ...extra }, body: JSON.stringify(body) });
}
test("rejects unauthorized discovery and foreign Origin", async () => {
  assert.equal((await handle(req({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { authorization: "" }))).status, 401);
  assert.equal((await handle(req({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { origin: "https://evil.example" }))).status, 403);
});
test("initializes and accepts initialized notifications without a response body", async () => {
  const init = await (await handle(req({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } } }))).json();
  assert.equal(init.result.protocolVersion, "2025-11-25");
  const notification = await handle(req({ jsonrpc: "2.0", method: "notifications/initialized" }));
  assert.equal(notification.status, 202);
  assert.equal(await notification.text(), "");
});
test("only exposes read-only tools and rejects arbitrary operations", async () => {
  const list = await (await handle(req({ jsonrpc: "2.0", id: 1, method: "tools/list" }))).json();
  assert.equal(list.result.tools.length, 3);
  assert.ok(list.result.tools.every((t: { annotations: { readOnlyHint: boolean } }) => t.annotations.readOnlyHint));
  const mutation = await (await handle(req({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "execute_sql", arguments: {} } }))).json();
  assert.equal(mutation.error.code, -32602);
});
test("every database tool filters business ownership and refuses a foreign workspace", async () => {
  queries.length = 0;
  for (const name of ["get_workspace", "list_offers", "list_automation_runs"]) {
    const response = await (await handle(req({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name, arguments: { businessId } } }))).json();
    assert.equal(response.result.isError, false);
  }
  assert.deepEqual(queries, Array(3).fill(["business_id", businessId]));
  const foreign = await (await handle(req({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "list_offers", arguments: { businessId: foreignId } } }))).json();
  assert.equal(foreign.result.isError, true);
  assert.equal(queries.length, 3);
});
test("rejects batches, unsupported versions and oversized requests", async () => {
  assert.equal((await handle(req([]))).status, 400);
  assert.equal((await handle(req({}, { "mcp-protocol-version": "invalid" }))).status, 400);
  assert.equal((await handle(req({ data: "x".repeat(17000) }))).status, 413);
});
