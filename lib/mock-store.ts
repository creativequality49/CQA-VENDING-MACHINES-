import { Entitlement } from "./types";

export type MockOrder = {
  id: string;
  userId: string;
  productId: string;
  tier: string;
  machineSlug: string;
  status: "paid" | "refunded";
  stripeSessionId?: string;
  createdAt: string;
};

const eventLog = new Set<string>();
const orders = new Map<string, MockOrder>();
const entitlements = new Map<string, Entitlement>();
const subscriptions = new Map<string, { userId: string; active: boolean; tier: string; updatedAt: string }>();

export function hasProcessedEvent(eventId: string) {
  return eventLog.has(eventId);
}

export function markEventProcessed(eventId: string) {
  eventLog.add(eventId);
}

function entitlementKey(userId: string, productId: string) {
  return `${userId}:${productId}`;
}

export function upsertOrder(order: MockOrder) {
  orders.set(order.id, order);
}

export function upsertEntitlement(entitlement: Entitlement) {
  entitlements.set(entitlementKey(entitlement.userId, entitlement.productId), entitlement);
}

export function setSubscription(userId: string, tier: string, active: boolean) {
  subscriptions.set(userId, { userId, tier, active, updatedAt: new Date().toISOString() });
}

export function hasEntitlement(userId: string, productId: string) {
  const direct = entitlements.get(entitlementKey(userId, productId));
  if (direct?.active) return true;

  const subscription = subscriptions.get(userId);
  return Boolean(subscription?.active);
}

export function getUserVaultSnapshot(userId: string) {
  return {
    orders: [...orders.values()].filter((o) => o.userId === userId),
    entitlements: [...entitlements.values()].filter((e) => e.userId === userId),
    subscription: subscriptions.get(userId) ?? null,
  };
}
