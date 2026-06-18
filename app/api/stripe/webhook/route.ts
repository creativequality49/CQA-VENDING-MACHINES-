import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { isDatabaseConfigured } from "@/lib/env";
import { createOrderFromCheckoutSession, markOrderRefunded, markPaymentFailed } from "@/services/orders.service";
import { upsertStripeSubscription } from "@/services/subscriptions.service";
import { createNotification } from "@/services/notifications.service";
import { NotificationSeverity, PaymentStatus } from "@prisma/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) return NextResponse.json({ error: "Missing webhook signature or secret" }, { status: 400 });
  const body = await req.text();
  let event: Stripe.Event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", { apiVersion: "2024-06-20" });
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid webhook signature" }, { status: 400 });
  }
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const existing = await prisma.stripeEvent.findUnique({ where: { stripeEventId: event.id } });
  if (existing) return NextResponse.json({ ok: true, duplicate: true });

  switch (event.type) {
    case "checkout.session.completed":
      await createOrderFromCheckoutSession(event.data.object as Stripe.Checkout.Session);
      break;
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await prisma.order.updateMany({ where: { stripePaymentIntentId: paymentIntent.id }, data: { paymentStatus: PaymentStatus.PAID, status: "paid" } });
      break;
    }
    case "payment_intent.payment_failed":
      await markPaymentFailed((event.data.object as Stripe.PaymentIntent).id);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertStripeSubscription(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await upsertStripeSubscription(event.data.object as Stripe.Subscription);
      break;
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      if (typeof invoice.subscription === "string") {
        await prisma.ecommerceSubscription.updateMany({ where: { stripeSubscriptionId: invoice.subscription }, data: { status: "ACTIVE" } });
        await prisma.customerEntitlement.updateMany({ where: { stripeSubscriptionId: invoice.subscription }, data: { status: "active", expiresAt: null } });
      }
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      if (typeof invoice.subscription === "string") {
        await prisma.ecommerceSubscription.updateMany({ where: { stripeSubscriptionId: invoice.subscription }, data: { status: "PAST_DUE" } });
        await createNotification({ type: "FAILED_PAYMENT", title: "Invoice payment failed", message: `Invoice ${invoice.id} failed`, severity: NotificationSeverity.WARNING, relatedEntityType: "StripeInvoice", relatedEntityId: invoice.id });
      }
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      if (typeof charge.payment_intent === "string") await markOrderRefunded(charge.payment_intent);
      break;
    }
    default:
      break;
  }
  await prisma.stripeEvent.create({ data: { stripeEventId: event.id, type: event.type } });
  return NextResponse.json({ ok: true });
}
