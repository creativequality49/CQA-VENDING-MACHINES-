import fs from "node:fs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = ts.transpileModule(fs.readFileSync("app/api/automations/route.ts", "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
const tables = ["cqa_businesses", "cqa_automations", "cqa_automation_runs", "cqa_contacts", "cqa_business_connections", "cqa_context_items"];
async function readWorkspace({ failedTable, rejectedTable, authenticated = true, noBusiness = false } = {}) {
  const reads = [];
  const admin = { from(table) {
    reads.push(table);
    const query = { then(resolve, reject) {
      if (table === rejectedTable) return Promise.reject(new Error("Transport interrupted")).then(resolve, reject);
      return Promise.resolve({
        data: table === failedTable ? null : table === "cqa_businesses" ? (noBusiness ? [] : [{ id: "business-1", name: "Test business" }]) : table === "cqa_context_items" ? [{ id: "context-1", title: "Saved policy", content: "Approved instructions", active: true }] : [],
        error: table === failedTable ? { message: "Private database diagnostic" } : null
      }).then(resolve, reject);
    } };
    for (const method of ["select", "eq", "in", "order", "limit"]) query[method] = () => query;
    return query;
  } };
  const mocks = {
    "@/lib/cqa-marketplace": { getPublicSupabaseClient: () => ({ auth: { getUser: async () => ({ data: { user: authenticated ? { id: "owner-1" } : null }, error: null }) } }) },
    "@/lib/cqa-supabase-admin": { getCqaSupabaseAdmin: () => admin },
    "@/lib/cqa-automation-engine": { CQA_AUTOMATION_TEMPLATES: [], createAutomationFromTemplate: () => { throw new Error("GET must not write"); } }
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", source)(id => Object.hasOwn(mocks, id) ? mocks[id] : require(id), module, module.exports);
  const response = await module.exports.GET(new Request("https://example.test/api/automations", { headers: { Authorization: "Bearer fixture" } }));
  return { status: response.status, body: await response.json(), reads };
}
for (const table of tables) {
  const result = await readWorkspace({ failedTable: table });
  assert.equal(result.status, 500, `${table}: database errors must not become empty successful workspaces`);
  assert.match(result.body.error, /Unable to load/);
  assert.equal("context" in result.body, false);
  assert.doesNotMatch(JSON.stringify(result.body), /Private database diagnostic/);
}
assert.equal((await readWorkspace({ rejectedTable: "cqa_context_items" })).status, 500);
const loaded = await readWorkspace();
assert.equal(loaded.status, 200);
assert.equal(loaded.body.context[0].title, "Saved policy");
const empty = await readWorkspace({ noBusiness: true });
assert.equal(empty.status, 200);
assert.deepEqual(empty.body.context, []);
assert.deepEqual(empty.reads, ["cqa_businesses"]);
const denied = await readWorkspace({ authenticated: false });
assert.equal(denied.status, 401);
assert.deepEqual(denied.reads, []);
console.log("PASS automation workspace: every database read failure returns an error; saved context, genuine empty state and authentication are preserved");
