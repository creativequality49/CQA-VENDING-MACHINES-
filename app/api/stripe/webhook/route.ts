import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  hasProcessedStripeEvent,
  markStripeEventProcessed,
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
          await upsertCheckoutEntitlement({
            userId,
            productId,
            tier,
            machineSlug,
            stripeCustomerId: getStringId(session.customer),
            stripeSubscriptionId: getStringId(session.subscription),
            stripeSessionId: session.id,
            source: tier === "subscription" ? "subscription" : "checkout"
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
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
