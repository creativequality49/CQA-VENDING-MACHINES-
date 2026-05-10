import { NextResponse } from "next/server";
import Stripe from "stripe";
import { markEventProcessed, hasProcessedEvent, setSubscription, upsertEntitlement, upsertOrder } from "@/lib/mock-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing webhook signature or secret" }, { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", { apiVersion: "2024-06-20" });
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (hasProcessedEvent(event.id)) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId ?? "anonymous";
      const productId = session.metadata?.productId ?? "unknown";
      const tier = session.metadata?.tier ?? "unknown";
      const machineSlug = session.metadata?.machineSlug ?? "unknown";

      upsertOrder({
        id: session.id,
        userId,
        productId,
        tier,
        machineSlug,
        status: "paid",
        stripeSessionId: session.id,
        createdAt: new Date().toISOString(),
      });

      upsertEntitlement({ userId, productId, active: true, source: tier === "subscription" ? "subscription" : "one_time" });
      if (tier === "subscription") setSubscription(userId, tier, true);
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const userId = (invoice as unknown as { metadata?: Record<string, string> }).metadata?.userId ?? "anonymous";
      setSubscription(userId, "subscription", true);
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId ?? "anonymous";
      setSubscription(userId, "subscription", sub.status === "active" || sub.status === "trialing");
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId ?? "anonymous";
      setSubscription(userId, "subscription", false);
      break;
    }
    default:
      break;
  }

  markEventProcessed(event.id);
  return NextResponse.json({ ok: true });
}
