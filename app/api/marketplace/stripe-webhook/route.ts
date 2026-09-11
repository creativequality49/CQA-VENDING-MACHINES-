import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";

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
      await admin.from("cqa_orders").update({
        status: "paid",
        stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null,
        customer_email: session.customer_details?.email || session.customer_email || null,
        updated_at: new Date().toISOString()
      }).eq("stripe_checkout_session_id", session.id).eq("business_id", businessId);
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    await admin.from("cqa_orders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("stripe_checkout_session_id", session.id);
  }

  return NextResponse.json({ received: true });
}
