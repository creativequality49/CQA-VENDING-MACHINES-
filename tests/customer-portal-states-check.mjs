import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function evaluate(path, mocks = {}, suffix = "") {
  const code = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText;
  const exports = {};
  new Function("require", "exports", code + suffix)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), exports);
  return exports;
}
const shipmentExports = evaluate("components/fulfillment/ShipmentPanel.tsx", { "./ShipmentPanel.module.css": {} });
const types = evaluate("components/customer/types.ts");
const order = {
  id: "33333333-3333-4333-8333-333333333333", title: "Website delivery", businessName: "Test business",
  businessId: "11111111-1111-4111-8111-111111111111", machineSlug: "test-business", offerType: "service",
  fulfillmentType: "service", paymentStatus: "paid", amountCents: 4900, currency: "aud", createdAt: "2026-01-02",
  workspace: { state: "delivered", intake: { businessName: "Test project", goals: "Build a website", details: "Brand notes" },
    deliveryMessage: "Private handover content", hasAsset: true, assetName: "private-delivery.zip", revision: 4, updatedAt: "2026-01-03" }
};
for (const [status, expected] of [["pending", "Payment pending"], ["refunded", "Refunded"], ["cancelled", "Cancelled"],
  ["canceled", "Cancelled"], ["disputed", "Payment disputed"], ["failed", "Payment failed"], ["expired", "Checkout expired"],
  ["unknown", "Payment not confirmed"]]) {
  assert.equal(types.orderState({ ...order, paymentStatus: status }).label, expected);
}

const simple = ({ children }) => React.createElement("div", null, children);
const { OrderWorkspace } = evaluate("app/account/orders/[orderId]/page.tsx", {
  "@/components/fulfillment/ShipmentPanel": shipmentExports,
  "next/link": ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children),
  "next/navigation": { useParams() { return {}; } },
  "@/components/customer/useCustomerSession": { CustomerRequestError: class extends Error {}, useCustomerSession() { throw Error("Unexpected session hook"); } },
  "@/components/customer/PortalFrame": { PortalFrame: simple, ErrorPanel: simple, LoadingPanel: simple,
    OrderBadge: ({ order }) => React.createElement("span", null, types.orderState(order).label) },
  "@/components/customer/types": types,
  "../../account.module.css": {}
}, ";exports.OrderWorkspace = OrderWorkspace;");
function render(paymentStatus) {
  return renderToStaticMarkup(React.createElement(OrderWorkspace, {
    result: { order: { ...order, paymentStatus }, events: [] },
    request() { throw Error("Rendering must not perform a provider request"); }, reload() {}
  }));
}
const physical = renderToStaticMarkup(React.createElement(OrderWorkspace, { result: { order: { ...order, offerType: "physical_product", fulfillmentType: "shipping" }, events: [] }, request() { throw Error("Render must not request"); }, reload() {} }));
assert.match(physical, /Delivery tracking/);
assert.match(physical, /Physical product/);
assert.doesNotMatch(physical, /Send project brief|Your project brief|Service delivery|Private handover content/);
const paid = render("paid");
assert.match(paid, /Your delivery is here/);
assert.match(paid, /Private handover content/);
assert.match(paid, /private-delivery\.zip/);
for (const status of ["pending", "refunded", "cancelled", "disputed", "failed", "expired"]) {
  const html = render(status);
  assert.doesNotMatch(html, /Your delivery is here|Private handover content|private-delivery\.zip|HANDOVER COMPLETE/);
  assert.match(html, /Payment must be confirmed before fulfilment/);
}
console.log("PASS customer portal payment labels and actual rendered delivery gating for unpaid/revoked orders");
