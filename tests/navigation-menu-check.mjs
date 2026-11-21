import fs from "node:fs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const code = ts.transpileModule(fs.readFileSync("components/NavMenu.tsx", "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
class ElementFixture {
  constructor(anchor = null) { this.anchor = anchor; }
  closest(selector) { assert.equal(selector, "a[href]"); return this.anchor; }
}
const module = { exports: {} };
new Function("require", "module", "exports", "Element", code)(require, module, module.exports, ElementFixture);
const menu = module.exports.default({ children: "Menu content" });
assert.equal(menu.type, "details", "Native disclosure semantics are retained");
assert.equal(menu.props.children, "Menu content");

function fixture(open = true) {
  let focused = false, prevented = false;
  const details = { open, querySelector: selector => {
    assert.equal(selector, "summary");
    return { focus() { focused = true; } };
  } };
  return { details, event: { currentTarget: details, preventDefault() { prevented = true; } }, focused: () => focused, prevented: () => prevented };
}
for (const label of ["route link", "same-route link", "nested link span", "keyboard-activated link"]) {
  const f = fixture();
  menu.props.onClick({ ...f.event, target: new ElementFixture({ href: label }), detail: label === "keyboard-activated link" ? 0 : 1 });
  assert.equal(f.details.open, false, `${label} closes the menu`);
  assert.equal(f.prevented(), false, "Link navigation is not prevented");
  assert.equal(f.focused(), false, "Link navigation does not move focus back to the menu");
}
const summary = fixture();
menu.props.onClick({ ...summary.event, target: new ElementFixture() });
assert.equal(summary.details.open, true, "Summary and panel clicks retain native disclosure behavior");
const escape = fixture();
menu.props.onKeyDown({ ...escape.event, key: "Escape" });
assert.equal(escape.details.open, false);
assert.equal(escape.prevented(), true);
assert.equal(escape.focused(), true, "Escape returns keyboard focus to the disclosure trigger");
const otherKey = fixture();
menu.props.onKeyDown({ ...otherKey.event, key: "Tab" });
assert.equal(otherKey.details.open, true);
assert.equal(otherKey.prevented(), false);
const alreadyClosed = fixture(false);
menu.props.onKeyDown({ ...alreadyClosed.event, key: "Escape" });
assert.equal(alreadyClosed.prevented(), false);
assert.equal(alreadyClosed.focused(), false);
console.log("PASS navigation menu: selections close without blocking navigation; Escape closes and restores focus; other native interactions remain intact");
