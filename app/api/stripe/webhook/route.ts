import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  hasProcessedStripeEvent,
  markStripeEventProcessed,
  updateSubscriptionEntitlement,
  upsertCheckoutEntitlement,
} from "@/lib/entitlements";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStringId(value: string | { id: string } | null | undefined) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function entitlementStatus(subscription: Stripe.Subscription) {
  return subscription.status === "active" || subscription.status === "trialing" ? "active" : "cancelled";
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  if (!userId) return;

  await updateSubscriptionEntitlement({
    userId,
    stripeSubscriptionId: subscription.id,
    status: entitlementStatus(subscription),
  });
}

async function syncInvoiceSubscription(invoice: Stripe.Invoice, status: "active" | "inactive") {
  const subscriptionId = getStringId(invoice.subscription);
  if (!subscriptionId) return;

  const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.userId;
  if (!userId) return;

  await updateSubscriptionEntitlement({
    userId,
    stripeSubscriptionId: subscription.id,
    status,
  });
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

  if (await hasProcessedStripeEvent(event.id)) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId ?? session.client_reference_id;
        const productId = session.metadata?.productId;
        const tier = session.metadata?.tier;
        const machineSlug = session.metadata?.machineSlug;

        if (userId && productId && tier && machineSlug) {
          await upsertCheckoutEntitlement({
            userId,
            productId,
            tier,
            machineSlug,
            stripeCustomerId: getStringId(session.customer),
            stripeSubscriptionId: getStringId(session.subscription),
            stripeSessionId: session.id,
            source: tier === "subscription" ? "subscription" : "checkout",
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        await syncInvoiceSubscription(event.data.object as Stripe.Invoice, "active");
        break;
      }

      case "invoice.payment_failed": {
        await syncInvoiceSubscription(event.data.object as Stripe.Invoice, "inactive");
        break;
      }

      default:
        break;
    }

    await markStripeEventProcessed(event.id, event.type);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    console.error("Stripe webhook processing failed", { eventId: event.id, eventType: event.type, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
