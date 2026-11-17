import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(fs.readFileSync("app/owner/orders/page.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
}).outputText;
const sessionA = { access_token: "owner-a-token", user: { id: "owner-a" } };
const order = { id: "order-a", status: "paid", amountCents: 4900, currency: "aud", createdAt: "2026-01-02",
  customerEmail: "buyer@example.test", offerName: "Digital operations kit", digital: true,
  workspace: { state: "awaiting_intake", revision: 0, intake: {}, deliveryMessage: "", hasAsset: false, assetName: null, updatedAt: null } };

function harness(selected = order) {
  const state = [sessionA, false, "", { id: "business-a", name: "Test business" }, [selected], 0, false, false,
    selected, [], false, "", "", "", "", null];
  let stateIndex = 0, refIndex = 0, finishFetch;
  const callbacks = [], refs = [], redirects = [], writes = [];
  const router = { replace(path) { redirects.push(path); } };
  const hooks = {
    useState() { const index = stateIndex++; return [state[index], value => writes.push([index, value])]; },
    useEffect() {},
    useCallback(callback) { callbacks.push(callback); return callback; },
    useRef(initial) {
      const index = refIndex++;
      const ref = { current: index === 3 ? sessionA.user.id : index === 4 ? sessionA : initial };
      refs.push(ref); return ref;
    }
  };
  const exports = {};
  const mocks = {
    react: hooks,
    "next/link": ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children),
    "next/navigation": { useRouter() { return router; } },
    "@/lib/cqa-marketplace": { getBrowserSupabaseClient() { throw Error("Render must not contact authentication"); } },
    "@/lib/cqa-marketplace-assets": { MAX_MARKETPLACE_ASSET_BYTES: 4 * 1024 * 1024 },
    "./orders.module.css": {}
  };
  new Function("require", "exports", "window", "fetch", compiled)(
    name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), exports,
    { location: { origin: "https://app.test", pathname: "/owner/orders", search: "" } },
    () => new Promise(resolve => { finishFetch = resolve; })
  );
  const html = renderToStaticMarkup(exports.default());
  return { html, request: callbacks[2], activeSession: refs[4], redirects, writes, respond: value => finishFetch(value) };
}

const digital = harness();
assert.match(digital.html, /Protected digital delivery|PROTECTED DIGITAL DELIVERY/);
assert.match(digital.html, /Managed through the customer library/);
assert.doesNotMatch(digital.html, /Awaiting customer details|Customer brief|Start work|Mark delivered|Prepare the handover/);
const unpaid = harness({ ...order, status: "refunded" });
assert.match(unpaid.html, /Payment is not active/);
assert.doesNotMatch(unpaid.html, /Start work|Mark delivered|Your customer can view the handover/);

for (const next of [{ access_token: "owner-b-token", user: { id: "owner-b" } }, { ...sessionA, access_token: "owner-a-refreshed-token" }]) {
  const test = harness();
  const pending = test.request("/api/owner/orders");
  test.activeSession.current = next;
  test.respond(Response.json({ error: "Old token expired" }, { status: 401 }));
  await assert.rejects(pending, error => error.name === "AbortError");
  assert.equal(test.redirects.length, 0, "A stale 401 must not sign out a replacement or refreshed session");
  assert.equal(test.writes.length, 0, "A stale response must not clear the new account's private state");
}
const expired = harness();
const pending = expired.request("/api/owner/orders");
expired.respond(Response.json({ error: "Current session expired" }, { status: 401 }));
await assert.rejects(pending, /Current session expired/);
assert.equal(expired.redirects.length, 1, "A 401 for the current session must return to sign-in");
assert.equal(expired.activeSession.current, null);
console.log("PASS owner portal digital-delivery rendering and stale-account/token 401 isolation");
