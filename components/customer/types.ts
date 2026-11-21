export type CustomerOrder = {
  id: string;
  title: string;
  businessName: string;
  businessId: string;
  machineSlug: string | null;
  offerType: string | null;
  fulfillmentType: string | null;
  purchaseTerms?: { deliveryDescription: string; deliveryTiming: string; supportDetails: string; refundTerms: string };
  paymentStatus: string;
  amountCents: number;
  currency: string;
  createdAt: string;
  workspace: {
    state: "awaiting_intake" | "queued" | "in_progress" | "delivered";
    intake: { businessName: string; goals: string; details: string } | null;
    deliveryMessage: string | null;
    hasAsset: boolean;
    assetName: string | null;
    revision: number;
    updatedAt: string | null;
  };
};
export type OrderEvent = {
  id: string;
  kind: string;
  message: string;
  createdAt: string;
};
export type OrdersResult = {
  orders: CustomerOrder[];
  hasMore: boolean;
  nextOffset: number | null;
};
export type OrderResult = { order: CustomerOrder; events: OrderEvent[] };

export function money(order: CustomerOrder) {
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: order.currency.toUpperCase(),
    }).format(order.amountCents / 100);
  } catch {
    return `${(order.amountCents / 100).toFixed(2)} ${order.currency.toUpperCase()}`;
  }
}
export function dateTime(value: string | null, time = false) {
  if (!value || Number.isNaN(Date.parse(value))) return "Not available";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(time ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(new Date(value));
}
export function isDigital(order: CustomerOrder) {
  return (
    order.fulfillmentType === "digital" ||
    order.fulfillmentType === "digital_download" ||
    order.offerType === "digital_product"
  );
}
export function isPaid(order: CustomerOrder) {
  return order.paymentStatus === "paid";
}
export function orderState(order: CustomerOrder) {
  if (!isPaid(order)) {
    const label: Record<string, string> = {
      refunded: "Refunded",
      cancelled: "Cancelled",
      canceled: "Cancelled",
      disputed: "Payment disputed",
      failed: "Payment failed",
      expired: "Checkout expired",
      pending: "Payment pending",
    };
    return {
      label: label[order.paymentStatus] || "Payment not confirmed",
      tone: "neutral",
    };
  }
  if (order.offerType === "physical_product" || order.fulfillmentType === "shipping") return { label: "Physical delivery", tone: "progress" };
  if (isDigital(order)) return { label: "Digital purchase", tone: "ready" };
  if (order.workspace.state === "delivered")
    return { label: "Delivered", tone: "ready" };
  if (order.workspace.state === "queued")
    return { label: "Brief received", tone: "progress" };
  if (order.workspace.state === "in_progress")
    return { label: "In progress", tone: "progress" };
  return { label: "Your details needed", tone: "action" };
}
export function checkOrder(value: unknown): value is CustomerOrder {
  if (!value || typeof value !== "object") return false;
  const order = value as CustomerOrder;
  const optionalText = (field: unknown) =>
    field === null || typeof field === "string";
  if (
    typeof order.id !== "string" ||
    typeof order.title !== "string" ||
    typeof order.businessName !== "string" ||
    typeof order.businessId !== "string" ||
    !optionalText(order.machineSlug) ||
    !optionalText(order.offerType) ||
    !optionalText(order.fulfillmentType) ||
    typeof order.paymentStatus !== "string" ||
    typeof order.amountCents !== "number" ||
    !Number.isFinite(order.amountCents) ||
    typeof order.currency !== "string" ||
    typeof order.createdAt !== "string" ||
    !order.workspace ||
    typeof order.workspace !== "object"
  )
    return false;
  const workspace = order.workspace;
  return (
    ["awaiting_intake", "queued", "in_progress", "delivered"].includes(
      workspace.state,
    ) &&
    Number.isInteger(workspace.revision) &&
    workspace.revision >= 0 &&
    typeof workspace.hasAsset === "boolean" &&
    optionalText(workspace.deliveryMessage) &&
    optionalText(workspace.assetName) &&
    optionalText(workspace.updatedAt) &&
    (workspace.intake === null ||
      (!!workspace.intake &&
        typeof workspace.intake.businessName === "string" &&
        typeof workspace.intake.goals === "string" &&
        typeof workspace.intake.details === "string"))
  );
}
