import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { triggerBusinessAutomations } from "@/lib/cqa-automation-engine";

export const runtime = "nodejs";

async function claimWebhookEvent(
  admin: ReturnType<typeof getCqaSupabaseAdmin>,
  event: Stripe.Event,
) {
  const { error } = await admin.from("cqa_stripe_webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
    status: "processing",
  });

  if (!error) return "claimed" as const;
  if (error.code !== "23505") throw error;

  const { data: existing, error: existingError } = await admin
    .from("cqa_stripe_webhook_events")
    .select("status,processed_at")
    .eq("event_id", event.id)
    .single();
  if (existingError) throw existingError;
  if (existing.status === "processed") return "processed" as const;

  if (existing.status === "failed") {
    const { data: reclaimed, error: reclaimError } = await admin
      .from("cqa_stripe_webhook_events")
      .update({ status: "processing", last_error: null, processed_at: new Date().toISOString() })
      .eq("event_id", event.id)
      .eq("status", "failed")
      .select("event_id")
      .maybeSingle();
    if (reclaimError) throw reclaimError;
    if (reclaimed) return "claimed" as const;
  }

  throw new Error("Webhook event is already being processed.");
}

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
  try {
    const claim = await claimWebhookEvent(admin, event);
    if (claim === "processed") return NextResponse.json({ received: true, duplicate: true });

    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      await admin.from("cqa_connected_accounts").update({
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        onboarding_complete: Boolean(account.details_submitted && account.charges_enabled),
        updated_at: new Date().toISOString()
      }).eq("stripe_account_id", account.id);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const businessId = session.metadata?.cqaBusinessId;
      if (businessId) {
        const email = (session.customer_details?.email || session.customer_email || "").trim().toLowerCase();
        const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null;
        const { data: order } = await admin.from("cqa_orders").update({
          status: "paid",
          stripe_payment_intent_id: paymentIntentId,
          customer_email: email || null,
          updated_at: new Date().toISOString()
        }).eq("stripe_checkout_session_id", session.id).eq("business_id", businessId).select("id,machine_id,offer_id,amount_cents,currency").maybeSingle();

        let contactId: string | null = null;
        if (email) {
          const { data: contact } = await admin.from("cqa_contacts").upsert({
            business_id: businessId,
            email,
            name: session.customer_details?.name || null,
            status: "subscribed",
            source: "purchase",
            tags: ["customer"],
            metadata: { latest_order_id: order?.id || null, stripe_checkout_session_id: session.id },
            updated_at: new Date().toISOString()
          }, { onConflict: "business_id,email" }).select("id").single();
          contactId = contact?.id || null;
        }

        void triggerBusinessAutomations(businessId, "purchase", {
          orderId: order?.id || null,
          machineId: order?.machine_id || session.metadata?.cqaMachineId || null,
          offerId: order?.offer_id || session.metadata?.cqaOfferId || null,
          amountCents: order?.amount_cents || session.amount_total || null,
          currency: order?.currency || session.currency || "aud",
          checkoutSessionId: session.id,
          paymentIntentId
        }, contactId).catch((automationError) => console.error("[automation] purchase trigger failed", automationError));
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      await admin.from("cqa_orders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("stripe_checkout_session_id", session.id);
    }

    const { error: completeError } = await admin
      .from("cqa_stripe_webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString(), last_error: null })
      .eq("event_id", event.id);
    if (completeError) throw completeError;

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    await admin
      .from("cqa_stripe_webhook_events")
      .update({ status: "failed", last_error: message.slice(0, 500) })
      .eq("event_id", event.id)
      .eq("status", "processing");
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
