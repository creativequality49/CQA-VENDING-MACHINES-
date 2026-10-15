import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createFoundingEnquirySender } from "../lib/cqa-founding-enquiry";

const details = { name: "Test Owner", email: "owner@example.test", businessKind: "Consulting", offer: "A one-hour business consultation", updates: true };
let calls = 0;
let body: Record<string, string> = {};
let release!: () => void;
const blocked = new Promise<void>((resolve) => { release = resolve; });
const sender = createFoundingEnquirySender((async (url, options) => {
  calls++; assert.equal(url, "/api/contact"); body = JSON.parse(String(options?.body));
  await blocked;
  return Response.json({ ok: true });
}) as typeof fetch);
const first = sender(details);
const duplicate = sender(details);
assert.equal(first, duplicate, "Double submission shares the in-flight request");
release(); await first; await sender(details);
assert.equal(calls, 1, "Saved form cannot submit a duplicate in the same mounted form");
assert.equal(body.service, "founding-customer-early-access");
assert.match(body.message, /No general marketing consent/);
assert.match(body.message, /No payment, guaranteed place or subscription requested/);

for (const invalid of [{ updates: false }, { email: "invalid" }, { offer: "short" }, { website: "bot-filled" }, { name: "x" }, { name: "n".repeat(121) }, { email: `${"e".repeat(191)}@test.test` }, { businessKind: "b".repeat(121) }, { offer: "o".repeat(1601) }]) {
  let requested = false;
  const rejectInvalid = createFoundingEnquirySender((async () => { requested = true; return Response.json({ ok: true }); }) as typeof fetch);
  await assert.rejects(rejectInvalid({ ...details, ...invalid }));
  assert.equal(requested, false);
}
let attempts = 0;
const retry = createFoundingEnquirySender((async () => {
  attempts++;
  return attempts === 1 ? Response.json({ error: "Please try later" }, { status: 429 }) : Response.json({ ok: true });
}) as typeof fetch);
await assert.rejects(retry(details), /Please try later/); await retry(details);
assert.equal(attempts, 2, "A rejected save can be retried");
const badSuccess = createFoundingEnquirySender((async () => Response.json({})) as typeof fetch);
await assert.rejects(badSuccess(details), /could not be saved/);
const offline = createFoundingEnquirySender((async () => { throw new Error("Offline"); }) as typeof fetch);
await assert.rejects(offline(details), /Offline/);

// Exercise the actual route's Zod validation and handler. Only its external RPC is mocked.
const require = createRequire(import.meta.url);
let rpcCalls = 0;
const rpcPayloads: Record<string, string>[] = [];
const routeModule: { exports: { POST?: (request: Request) => Promise<Response> } } = { exports: {} };
const routeSource = ts.transpileModule(readFileSync(new URL("../app/api/contact/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
runInNewContext(routeSource, { exports: routeModule.exports, module: routeModule, require: (id: string) => id === "@/lib/cqa-marketplace" ? { getPublicSupabaseClient: () => ({ rpc: async (name: string, payload: Record<string, string>) => { assert.equal(name, "cqa_submit_sales_lead"); rpcCalls++; rpcPayloads.push(payload); return { data: "test-lead-id", error: null }; } }) } : require(id), process: { env: {} }, console, fetch });
const post = routeModule.exports.POST!;
const realRouteSender = createFoundingEnquirySender((async (_url, options) => post(new Request("https://cqa.test/api/contact", options))) as typeof fetch);
await realRouteSender(details);
assert.equal(rpcCalls, 1, "Normal enquiry passes genuine server validation and reaches persistence RPC");
const maximumSender = createFoundingEnquirySender((async (_url, options) => post(new Request("https://cqa.test/api/contact", options))) as typeof fetch);
await maximumSender({ ...details, name: "N".repeat(120), email: `${"e".repeat(190)}@test.test`, businessKind: "B".repeat(120), offer: "O".repeat(1600) });
assert.equal(rpcCalls, 2, "Maximum UI field lengths fit genuine route limits");
assert.equal(rpcPayloads[1].p_email.length, 200);
const oversizedPrice = await post(new Request("https://cqa.test/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, price: "x".repeat(41) }) }));
assert.equal(oversizedPrice.status, 400, "Regression control: genuine route rejects prior overlong-price shape");
console.log("Founding enquiry: success, duplicate clicks, consent, validation, honeypot, rate-limit retry, malformed success and network failure PASS");
