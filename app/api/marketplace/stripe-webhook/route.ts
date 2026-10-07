import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { triggerBusinessAutomations } from "@/lib/cqa-automation-engine";
import { claimCqaWebhookEvent, finishCqaWebhookEvent } from "@/lib/cqa-webhook-events";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!signature || !secret) return NextResponse.json({ error: "Webhook not configured." }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  const admin = getCqaSupabaseAdmin();
  let claimedAt: string | null = null;
  try {
    const claim = await claimCqaWebhookEvent(event);
    if (claim.duplicate) return NextResponse.json({ received: true, duplicate: true });
    claimedAt = claim.claimedAt;

    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      const { error: accountError } = await admin.from("cqa_connected_accounts").update({
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        onboarding_complete: Boolean(account.details_submitted && account.charges_enabled),
        updated_at: new Date().toISOString()
      }).eq("stripe_account_id", account.id);
      if (accountError) throw accountError;
    }

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      const businessId = session.metadata?.cqaBusinessId;
      if (businessId && (session.payment_status === "paid" || session.payment_status === "no_payment_required")) {
        const { data: account, error: accountError } = await admin.from("cqa_connected_accounts")
          .select("stripe_account_id").eq("business_id", businessId).single();
        if (accountError) throw accountError;
        if (!event.account || account.stripe_account_id !== event.account) throw new Error("Checkout account does not match business.");
        const email = (session.customer_details?.email || session.customer_email || "").trim().toLowerCase();
        const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null;
        const { data: order, error: orderError } = await admin.from("cqa_orders").upsert({
          business_id: businessId,
          machine_id: session.metadata?.cqaMachineId,
          offer_id: session.metadata?.cqaOfferId,
          amount_cents: session.amount_total ?? 0,
          currency: session.currency || "aud",
          stripe_checkout_session_id: session.id,
          status: "paid",
          stripe_payment_intent_id: paymentIntentId,
          customer_email: email || null,
          updated_at: new Date().toISOString()
        }, { onConflict: "stripe_checkout_session_id" }).select("id,machine_id,offer_id,amount_cents,currency").single();
        if (orderError) throw orderError;

        let contactId: string | null = null;
        if (email) {
          const { data: contact, error: contactError } = await admin.from("cqa_contacts").upsert({
            business_id: businessId,
            email,
            name: session.customer_details?.name || null,
            status: "subscribed",
            source: "purchase",
            tags: ["customer"],
            metadata: { latest_order_id: order?.id || null, stripe_checkout_session_id: session.id },
            updated_at: new Date().toISOString()
          }, { onConflict: "business_id,email" }).select("id").single();
          if (contactError) throw contactError;
          contactId = contact?.id || null;
        }

        await triggerBusinessAutomations(businessId, "purchase", {
          orderId: order?.id || null,
          machineId: order?.machine_id || session.metadata?.cqaMachineId || null,
          offerId: order?.offer_id || session.metadata?.cqaOfferId || null,
          amountCents: order?.amount_cents || session.amount_total || null,
          currency: order?.currency || session.currency || "aud",
          checkoutSessionId: session.id,
          paymentIntentId
        }, contactId);
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const { error: expiredError } = await admin.from("cqa_orders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("stripe_checkout_session_id", session.id).neq("status", "paid");
      if (expiredError) throw expiredError;
    }

    if (claimedAt) await finishCqaWebhookEvent(event.id, claimedAt);

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    if (claimedAt) await finishCqaWebhookEvent(event.id, claimedAt, message);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
