import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  hasProcessedStripeEvent,
  markStripeEventProcessed,
  revokeCheckoutEntitlement,
  updateSubscriptionEntitlement,
  upsertCheckoutEntitlement
} from "@/lib/entitlements";
import { handleFanXStripeEvent } from "@/lib/fanx-commerce";
import { handleCqaBillingStripeEvent } from "@/lib/cqa-billing";
import { getStripeClient } from "@/lib/stripe";
import { claimCqaWebhookEvent, finishCqaWebhookEvent } from "@/lib/cqa-webhook-events";

export const runtime = "nodejs";

function getStringId(value: string | { id: string } | null) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing webhook signature or secret" }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let claimedAt: string | null = null;
  try {
  if (await hasProcessedStripeEvent(event.id)) {
    return NextResponse.json({ ok: true, duplicate: true });
  }
  const claim = await claimCqaWebhookEvent(event);
  if (claim.duplicate) return NextResponse.json({ ok: true, duplicate: true });
  claimedAt = claim.claimedAt;

  const cqaBillingHandled = await handleCqaBillingStripeEvent(event);
  const fanXHandled = cqaBillingHandled ? false : await handleFanXStripeEvent(event);

  if (!cqaBillingHandled && !fanXHandled) {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") break;
        const userId = session.metadata?.userId ?? session.client_reference_id;
        const productId = session.metadata?.productId;
        const tier = session.metadata?.tier;
        const machineSlug = session.metadata?.machineSlug;
        if (userId && productId && tier && machineSlug) {
          let status: "active" | "cancelled" = "active";
          const subscriptionId = getStringId(session.subscription);
          if (subscriptionId) {
            const current = await getStripeClient().subscriptions.retrieve(subscriptionId);
            status = current.status === "active" || current.status === "trialing" ? "active" : "cancelled";
          } else {
            const paymentIntentId = getStringId(session.payment_intent);
            if (paymentIntentId) {
              const current = await getStripeClient().paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
              const charge = current.latest_charge;
              // Delayed completion or retry after a full refund must not re-grant access.
              if (charge && typeof charge !== "string" && charge.refunded) status = "cancelled";
            }
          }
          await upsertCheckoutEntitlement({
            userId,
            productId,
            tier,
            machineSlug,
            stripeCustomerId: getStringId(session.customer),
            stripeSubscriptionId: subscriptionId,
            stripeSessionId: session.id,
            source: subscriptionId ? "subscription" : "checkout",
            status
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const eventSubscription = event.data.object as Stripe.Subscription;
        const subscription = event.type === "customer.subscription.deleted" ? eventSubscription : await getStripeClient().subscriptions.retrieve(eventSubscription.id);
        const userId = subscription.metadata?.userId;
        if (userId) {
          await updateSubscriptionEntitlement({
            userId,
            stripeSubscriptionId: subscription.id,
            status: subscription.status === "active" || subscription.status === "trialing" ? "active" : "cancelled"
          });
        }
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = getStringId(charge.payment_intent);
        // Partial refunds do not imply loss of the purchased product. Subscription
        // access follows subscription status, not an individual invoice refund.
        if (!charge.refunded || !paymentIntentId) break;
        const sessions = await getStripeClient().checkout.sessions.list({ payment_intent: paymentIntentId, limit: 100 });
        for (const session of sessions.data) {
          if (session.mode === "payment" && session.metadata?.userId && session.metadata?.productId) await revokeCheckoutEntitlement(session.id);
        }
        break;
      }
      default:
        break;
    }
  }

  await markStripeEventProcessed(event.id, event.type);
  if (claimedAt) await finishCqaWebhookEvent(event.id, claimedAt);
  return NextResponse.json({ ok: true, fanXHandled, cqaBillingHandled });
  } catch (error) {
    if (claimedAt) await finishCqaWebhookEvent(event.id, claimedAt, error instanceof Error ? error.message : "Processing failed.");
    console.error("[stripe-webhook] processing failed", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
