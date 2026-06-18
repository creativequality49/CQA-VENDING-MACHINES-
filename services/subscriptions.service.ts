import { NotificationSeverity, SubscriptionStatus, type Prisma } from "@prisma/client";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { logActivity } from "./audit-log.service";
import { createNotification } from "./notifications.service";
import { revokeSubscriptionAccess } from "./digital-access.service";

function toStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (status === "active" || status === "trialing") return SubscriptionStatus.ACTIVE;
  if (status === "past_due" || status === "unpaid") return SubscriptionStatus.PAST_DUE;
  if (status === "canceled") return SubscriptionStatus.CANCELLED;
  if (status === "paused") return SubscriptionStatus.PAUSED;
  return SubscriptionStatus.INCOMPLETE;
}

export async function upsertStripeSubscription(subscription: Stripe.Subscription, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma;
  const productId = subscription.metadata?.productId || undefined;
  const status = toStatus(subscription.status);
  const currentPeriodStart = new Date(subscription.current_period_start * 1000);
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  const record = await client.ecommerceSubscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    update: {
      status,
      currentPeriodStart,
      currentPeriodEnd,
      renewalDate: currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      cancelledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
    },
    create: {
      customerId: subscription.metadata?.userId || null,
      userId: subscription.metadata?.userId || null,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : null,
      productId,
      tier: subscription.metadata?.tier ?? null,
      status,
      currentPeriodStart,
      currentPeriodEnd,
      renewalDate: currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      cancelledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
    },
  });
  await logActivity({ entityType: "EcommerceSubscription", entityId: record.id, action: "subscription.upserted", newValue: record });
  if (status === SubscriptionStatus.PAST_DUE) {
    await createNotification({ type: "FAILED_PAYMENT", title: "Subscription payment failed", message: `Subscription ${subscription.id} is past due`, severity: NotificationSeverity.WARNING, relatedEntityType: "EcommerceSubscription", relatedEntityId: record.id });
  }
  if (status === SubscriptionStatus.CANCELLED) await revokeSubscriptionAccess(subscription.id);
  return record;
}
