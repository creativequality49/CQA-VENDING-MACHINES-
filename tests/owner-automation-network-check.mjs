import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";

// Exercise the real page handlers with hook/JSX shims, without provider calls.
const compiled = ts.transpileModule(fs.readFileSync("app/owner/automations/page.tsx", "utf8").replace(/^import .*;\r?\n/gm, ""), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const fixture = {
  templates: [{ key: "welcome", name: "Welcome", description: "Welcome flow", trigger_type: "new_contact", steps: [] }],
  businesses: [{ id: "business-1", name: "Test business" }],
  automations: [{ id: "automation-1", business_id: "business-1", name: "Welcome", status: "active", trigger_type: "new_contact", description: "", cqa_automation_steps: [] }],
  runs: [], contacts: [], connections: [], context: [
    { id: "context-1", kind: "instruction", title: "Saved policy", content: "Quotes above $1,500 need approval.\n<script>literal text</script>", active: true },
    { id: "context-2", kind: "instruction", title: "Old policy", content: "Archived instructions", active: false }
  ]
};
function find(node, predicate) {
  if (Array.isArray(node)) {
    for (const child of node) { const result = find(child, predicate); if (result) return result; }
  } else if (node && typeof node === "object") {
    if (predicate(node)) return node;
    return find(node.props?.children, predicate);
  }
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness(mode = "ok", initialLoading = false) {
  const state = [structuredClone(fixture), initialLoading, "", "", "", "Policy", "Approved business instructions"];
  let index = 0, effect, currentMode = mode, writes = 0, release;
  const jsx = (type, props) => ({ type, props });
  const client = {
    auth: { getSession: async () => {
      if (currentMode === "auth-rejected") throw new TypeError("Failed to fetch");
      return { data: { session: currentMode === "logged-out" ? null : { access_token: "test-token" } } };
    } },
    from: () => ({ insert: async () => {
      writes++;
      if (currentMode === "pending") await new Promise(resolve => { release = resolve; });
      if (currentMode === "insert-rejected") throw new TypeError("Failed to fetch");
      if (currentMode === "insert-fetch-error") return { error: { message: "TypeError: Failed to fetch" }, status: 0 };
      return { error: currentMode === "insert-error" ? { message: "Database unavailable." } : null, status: currentMode === "insert-error" ? 400 : 201 };
    } })
  };
  const request = async (_url, options = {}) => {
    if (options.method) writes++;
    if (currentMode === "pending" && options.method) await new Promise(resolve => { release = resolve; });
    if (currentMode === "fetch-rejected" || (currentMode === "refresh-rejected" && !options.method)) throw new TypeError("Failed to fetch");
    return {
      ok: currentMode !== "http-error",
      json: async () => {
        if (currentMode === "json-rejected") throw new SyntaxError("Unexpected token <");
        return options.method ? { run: { status: "queued" }, error: "Request unavailable." } : fixture;
      }
    };
  };
  const page = new Function("require", "exports", "useState", "useMemo", "useEffect", "getBrowserSupabaseClient", "fetch",
    "const Link = () => null;\n" + compiled + "\nreturn OwnerAutomationsPage;"
  )(() => ({ jsx, jsxs: jsx }), {}, initial => {
    const slot = index++;
    if (!(slot in state)) state[slot] = initial;
    return [state[slot], value => { state[slot] = value; }];
  }, factory => factory(), callback => { effect = callback; }, () => client, request);
  return {
    state,
    render() { index = 0; return page(); },
    async mount() { this.render(); effect(); await tick(); },
    mode(value) { currentMode = value; },
    writes() { return writes; },
    release() { release(); },
    button(label) { return find(this.render(), node => node.type === "button" && node.props.children === label); },
    async reload() { await this.button("Reload workspace").props.onClick(); }
  };
}
for (const mode of ["auth-rejected", "fetch-rejected", "json-rejected"]) {
  const h = harness(mode, true);
  await h.mount();
  assert.equal(h.state[1], false, mode + ": loading must settle");
  assert.match(h.state[4], /could not be loaded/);
  assert.equal(h.state[3], "");
  assert.equal(h.button("Reload workspace").props.disabled, false);
  h.mode("ok");
  await h.reload();
  assert.equal(h.state[4], "");
  assert.equal(h.state[1], false);
}
const signedOut = harness("logged-out", true);
await signedOut.mount();
assert.equal(signedOut.state[0].automations.length, 0);
assert.match(signedOut.state[4], /Log in/);
assert.equal(signedOut.state[1], false);

const operations = [
  { label: "Activate Template", modes: ["auth-rejected", "fetch-rejected", "json-rejected"], invoke: h => h.button("Activate Template").props.onClick() },
  { label: "Pause", modes: ["auth-rejected", "fetch-rejected", "json-rejected"], invoke: h => h.button("Pause").props.onClick() },
  { label: "Run Test", modes: ["auth-rejected", "fetch-rejected", "json-rejected"], invoke: h => h.button("Run Test").props.onClick() },
  { label: "Add Shared Context", modes: ["auth-rejected", "insert-rejected", "insert-fetch-error"], invoke: h => find(h.render(), node => node.type === "form").props.onSubmit({ preventDefault() {} }) }
];
for (const operation of operations) {
  const loggedOut = harness("logged-out");
  await operation.invoke(loggedOut);
  assert.equal(loggedOut.writes(), 0, "no writes when the session is absent");
  assert.equal(loggedOut.state[2], "");
  assert.match(loggedOut.state[4], /Log in/);
  assert.equal(loggedOut.state[5], "Policy");
  assert.equal(loggedOut.state[6], "Approved business instructions");
  for (const mode of operation.modes) {
    const h = harness(mode);
    h.state[3] = "Previous action completed.";
    await operation.invoke(h);
    assert.equal(h.state[2], "", operation.label + ": busy must settle");
    assert.equal(h.state[3], "", operation.label + ": stale success must clear");
    assert.match(h.state[4], /could not be confirmed/);
    assert.equal(h.button(operation.label).props.disabled, false);
    assert.equal(h.state[5], "Policy", "uncertain writes preserve the context title");
    assert.equal(h.state[6], "Approved business instructions", "uncertain writes preserve the context body");
    const writes = h.writes();
    h.mode("ok");
    await h.reload();
    assert.equal(h.writes(), writes, "reloading must not replay an uncertain write");
    assert.equal(h.state[4], "");
    await operation.invoke(h);
    assert.equal(h.state[2], "");
    assert.equal(h.state[4], "");
    assert.ok(h.state[3], "confirmed retry reports success");
  }
  const h = harness("pending");
  const pending = operation.invoke(h);
  await tick();
  const buttons = [];
  const collect = node => {
    if (Array.isArray(node)) node.forEach(collect);
    else if (node && typeof node === "object") { if (node.type === "button") buttons.push(node); collect(node.props?.children); }
  };
  collect(h.render());
  assert.ok(buttons.length >= 4);
  for (const button of buttons) assert.equal(button.props.disabled, true, "all controls block overlapping requests");
  h.mode("ok");
  h.release();
  await pending;
  assert.equal(h.state[2], "");
  assert.equal(h.state[1], false);
  assert.equal(h.button("Reload workspace").props.disabled, false);
}
const rejected = harness("http-error");
await rejected.button("Pause").props.onClick();
assert.equal(rejected.state[4], "Request unavailable.");
assert.equal(rejected.state[3], "");
assert.equal(rejected.state[2], "");
const contextError = harness("insert-error");
await operations[3].invoke(contextError);
assert.equal(contextError.state[4], "Database unavailable.");
assert.equal(contextError.state[2], "");
assert.equal(contextError.state[5], "Policy");
assert.equal(contextError.state[6], "Approved business instructions");
contextError.mode("ok");
await contextError.reload();
const saved = find(contextError.render(), node => node.props?.["aria-label"] === "Saved shared context");
assert.ok(saved, "reload exposes saved context so uncertain writes can be reconciled");
assert.ok(find(saved, node => node.type === "h4" && node.props.children === "Saved policy"));
assert.ok(find(saved, node => node.type === "p" && node.props.children === fixture.context[0].content), "context content remains a text child, including literal markup");
assert.ok(find(saved, node => node.type === "span" && node.props.children === "Active"));
assert.ok(find(saved, node => node.type === "span" && node.props.children === "Inactive"));
assert.equal(find(saved, node => Object.hasOwn(node.props || {}, "dangerouslySetInnerHTML")), undefined);
const refresh = harness("refresh-rejected");
await refresh.button("Pause").props.onClick();
assert.equal(refresh.state[3], "Automation paused.", "confirmed write remains distinct from failed refresh");
assert.match(refresh.state[4], /could not be loaded/);
assert.equal(refresh.state[2], "");
assert.equal(refresh.state[1], false);
console.log("PASS owner automations: load/mutation failures settle, uncertainty is explicit, reload never replays writes, controls prevent overlap");
