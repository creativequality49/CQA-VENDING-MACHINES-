export type OperationRow = Record<string, unknown>;
export type OperationsInput = { business: { id: string; name: string; status: string }; machines: OperationRow[]; offers: OperationRow[]; orders: OperationRow[]; shipments: OperationRow[]; workspaces: OperationRow[]; inventory: { offer_id: string; reserved_quantity: number; available_quantity: number | null }[]; now?: Date };
const text = (value: unknown) => typeof value === "string" ? value : "";
const object = (value: unknown): OperationRow => value && typeof value === "object" && !Array.isArray(value) ? value as OperationRow : {};
function totals(rows: OperationRow[]) {
  const result = new Map<string, { currency: string; amountCents: number; orders: number }>();
  for (const row of rows) {
    const currency = text(row.currency).toUpperCase(), amount = Number(row.amount_cents);
    if (!/^[A-Z]{3}$/.test(currency) || !Number.isSafeInteger(amount) || amount < 0) throw Error("Order total unavailable");
    const current = result.get(currency) || { currency, amountCents: 0, orders: 0 };
    current.amountCents += amount; current.orders++;
    if (!Number.isSafeInteger(current.amountCents)) throw Error("Order total exceeds supported range");
    result.set(currency, current);
  }
  return [...result.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}
export function summarizeCqaOperations(input: OperationsInput) {
  const now = input.now || new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(today.getTime() - 29 * 86400000);
  const cutoff = start.toISOString();
  const machines = new Map(input.machines.map(row => [text(row.id), row]));
  const offers = new Map(input.offers.map(row => [text(row.id), row]));
  const shipments = new Map(input.shipments.map(row => [text(row.order_id), row]));
  const workspaces = new Map(input.workspaces.map(row => [text(row.order_id), row]));
  const inventory = new Map(input.inventory.map(row => [row.offer_id, row]));
  for (const rows of [input.machines, input.offers, input.orders, input.shipments, input.workspaces]) {
    if (rows.some(row => row.business_id !== input.business.id)) throw Error("Operations business mismatch");
  }
  for (const order of input.orders) if (!Number.isFinite(Date.parse(text(order.created_at)))) throw Error("Order date unavailable");
  const recent = input.orders.filter(row => text(row.created_at) >= cutoff && Date.parse(text(row.created_at)) <= now.getTime());
  const paid = recent.filter(row => row.status === "paid");
  const allPaid = input.orders.filter(row => row.status === "paid");
  const stock = input.offers.filter(row => row.active === true && row.offer_type === "physical_product").map(row => {
    const summary = inventory.get(text(row.id));
    if (row.inventory_tracking === true && (!summary || summary.available_quantity === null || !Number.isSafeInteger(summary.available_quantity) || summary.available_quantity < 0)) throw Error("Inventory unavailable");
    return { id: text(row.id), name: text(row.name), machineId: text(row.machine_id), onHand: row.inventory_tracking === true && summary?.available_quantity !== null && summary?.available_quantity !== undefined ? summary.available_quantity + summary.reserved_quantity : null, reserved: summary?.reserved_quantity ?? null, available: row.inventory_tracking === true ? summary!.available_quantity : null };
  });
  const stockAlerts = stock.filter(row => row.available === null || row.available <= 5).map(row => ({ ...row, reason: row.available === null ? "Stock tracking needed" : row.available === 0 ? "Out of stock" : "Low stock", suggestedRestock: row.available === null ? null : Math.max(0, 6 - row.available) }));
  const fulfilment = { toDispatch: 0, inTransit: 0, awaitingBrief: 0, serviceInProgress: 0, digitalPaid: 0, needsReview: 0 };
  for (const order of allPaid) {
    const snapshot = object(order.purchase_snapshot), offer = offers.get(text(order.offer_id));
    const kind = text(snapshot.offerType) || text(offer?.offer_type), delivery = text(snapshot.fulfillmentType) || text(offer?.fulfillment_type);
    if (kind === "physical_product" || delivery === "shipping") {
      const shipment = shipments.get(text(order.id));
      if (!shipment || !["ready", "packing", "shipped", "delivered"].includes(text(shipment.state))) fulfilment.needsReview++;
      else if (["ready", "packing"].includes(text(shipment.state))) fulfilment.toDispatch++;
      else if (shipment.state === "shipped") fulfilment.inTransit++;
    } else if (kind === "digital_product" || delivery === "digital") {
      fulfilment.digitalPaid++; if (!order.buyer_user_id) fulfilment.needsReview++;
    } else if (["service", "booking", "consultation"].includes(kind)) {
      const workspace = workspaces.get(text(order.id));
      if (!workspace || workspace.state === "awaiting_intake") fulfilment.awaitingBrief++;
      else if (["queued", "in_progress"].includes(text(workspace.state))) fulfilment.serviceInProgress++;
      else if (workspace.state !== "delivered") fulfilment.needsReview++;
    } else fulfilment.needsReview++;
  }
  const daily = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(start.getTime() + index * 86400000).toISOString().slice(0, 10);
    const orders = paid.filter(row => text(row.created_at).slice(0, 10) === date);
    return { date, orders: orders.length, totals: totals(orders) };
  });
  return { business: input.business, refreshedAt: now.toISOString(), window: { start: cutoff, end: now.toISOString(), timezone: "UTC", days: 30 },
    sales: { paidOrders: paid.length, pendingOrders: recent.filter(row => row.status === "pending").length, refundedOrders: recent.filter(row => row.status === "refunded").length, cancelledOrders: recent.filter(row => ["cancelled", "disputed"].includes(text(row.status))).length, totals: totals(paid), daily },
    fulfilment, stockAlerts, stockSummary: { activePhysicalProducts: stock.length, low: stockAlerts.filter(row => row.available !== null && row.available > 0).length, out: stockAlerts.filter(row => row.available === 0).length, untracked: stockAlerts.filter(row => row.available === null).length },
    machines: input.machines.map(machine => { const orders = paid.filter(row => row.machine_id === machine.id); return { id: text(machine.id), title: text(machine.title), slug: text(machine.slug), status: text(machine.status), published: machine.status === "live" && input.business.status === "live", activeOffers: input.offers.filter(row => row.machine_id === machine.id && row.active === true).length, paidOrders: orders.length, totals: totals(orders) }; }),
    recentOrders: [...recent].sort((a, b) => text(b.created_at).localeCompare(text(a.created_at))).slice(0, 10).map(order => ({ id: text(order.id), title: text(object(order.purchase_snapshot).title) || text(offers.get(text(order.offer_id))?.name) || "Order", status: text(order.status), amountCents: Number(order.amount_cents), currency: text(order.currency).toUpperCase(), createdAt: text(order.created_at), machineTitle: text(machines.get(text(order.machine_id))?.title) || "Storefront" })),
    definitions: "Current paid order totals include shipping and exclude fully refunded/cancelled orders. They are not net profit or payout balances; partial refunds and fees are not deducted. Sales use order creation dates over 30 UTC calendar days. Fulfilment and stock cover current records across all dates. Shipment progress is merchant-reported; no hardware or carrier telemetry is connected." };
}
export type OperationsSnapshot = ReturnType<typeof summarizeCqaOperations>;
