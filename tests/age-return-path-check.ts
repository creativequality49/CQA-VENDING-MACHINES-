import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { safeAgeReturnPath } from "../lib/age-return-path";

for (const value of [undefined, null, "", "https://evil.test", "//evil.test", "/\\evil.test", "/%5cevil.test", "/%2f%2fevil.test", "/a/..//evil.test", "/%2e%2e//evil.test", "/\nevil.test", "/%not-encoded"]) {
  assert.equal(safeAgeReturnPath(value), "/fanxfantasy", `Reject unsafe return path: ${String(value)}`);
}
for (const value of ["/creator-studio", "/fanxfantasy/library?tab=paid", "/fanxfantasy#preview"]) {
  assert.equal(safeAgeReturnPath(value), value);
  assert.equal(new URL(safeAgeReturnPath(value), "http://localhost:3000").origin, "http://localhost:3000");
}

const source = readFileSync(new URL("../app/age-check/page.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const actualRequire = createRequire(import.meta.url);
function loadPage(environment: string | undefined) {
  const exports: { default?: () => React.ReactNode } = {};
  const require = (name: string) => {
    if (name === "next/link") return ({ href, children }: { href: string; children: React.ReactNode }) => actualRequire("react").createElement("a", { href }, children);
    if (name === "next/navigation") return { redirect(url: string) { throw new Error(`redirect:${url}`); } };
    return actualRequire(name);
  };
  new Function("require", "exports", "process", compiled)(require, exports, { env: { VERCEL_ENV: environment } });
  return exports.default!;
}
for (const environment of [undefined, "development", "preview"]) {
  const html = renderToStaticMarkup(loadPage(environment)());
  assert.match(html, /Verification is currently unavailable/);
  assert.doesNotMatch(html, /<form\b|https:\/\/fanxfantasy-cqa/);
  assert.match(html, /href="\/fanxfantasy"/);
}
assert.throws(() => loadPage("production")(), /redirect:https:\/\/fanxfantasy-cqa.vercel.app\/age-check/);
for (const name of ["start", "callback"]) {
  const route = readFileSync(new URL(`../app/api/age/${name}/route.ts`, import.meta.url), "utf8");
  assert.match(route, /safeAgeReturnPath\(/, `${name} validates its return destination`);
}
console.log("PASS local age navigation, preserved hosted redirect and safe return destinations");
