import { notifyCqaOrder } from "@/lib/cqa-transactional-email";
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
        const claimedBuyerId = session.metadata?.cqaBuyerUserId || null;
        let buyerUserId: string | null = null;
        if (claimedBuyerId && email) {
          const { data: buyerLookup, error: buyerError } = await admin.auth.admin.getUserById(claimedBuyerId);
          if (buyerError) throw buyerError;
          const buyer = buyerLookup?.user;
          if (buyer?.email_confirmed_at && buyer.email?.trim().toLowerCase() === email) buyerUserId = buyer.id;
        }
        let paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null;
        if (session.mode === "subscription") {
          // Subscription Checkout stores its payment on the original invoice.
          // Never use latest_invoice: renewals can move it to another charge.
          const invoiceId = typeof session.invoice === "string" ? session.invoice : session.invoice?.id;
          const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
          if (!invoiceId || !subscriptionId) throw new Error("Checkout subscription invoice is missing.");
          const invoice = await getStripeClient().invoices.retrieve(invoiceId, {}, { stripeAccount: event.account });
          const invoiceSubscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
          const invoiceCustomerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
          const sessionCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
          if (!invoice.paid || invoice.status !== "paid" || invoiceSubscriptionId !== subscriptionId ||
              !sessionCustomerId || invoiceCustomerId !== sessionCustomerId || invoice.currency !== session.currency || invoice.total !== session.amount_total) {
            throw new Error("Checkout subscription invoice does not match the payment.");
          }
          paymentIntentId = typeof invoice.payment_intent === "string" ? invoice.payment_intent : invoice.payment_intent?.id || null;
        }
        const orderDetails = {
          business_id: businessId,
          machine_id: session.metadata?.cqaMachineId,
          offer_id: session.metadata?.cqaOfferId,
          amount_cents: session.amount_total ?? 0,
          currency: session.currency || "aud",
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: paymentIntentId,
          customer_email: email || null,
          updated_at: new Date().toISOString()
        };
        // Establish the row before checking Stripe so a concurrent refund can
        // revoke it. A delayed completion must never overwrite a terminal row.
        const { error: insertError } = await admin.from("cqa_orders").upsert({
          ...orderDetails, status: "pending", buyer_user_id: null
        }, { onConflict: "stripe_checkout_session_id", ignoreDuplicates: true });
        if (insertError) throw insertError;

        let revokedStatus: "refunded" | "cancelled" | null = null;
        if (paymentIntentId) {
          const intent = await getStripeClient().paymentIntents.retrieve(paymentIntentId,
            { expand: ["latest_charge"] }, { stripeAccount: event.account });
          const latestCharge = typeof intent.latest_charge === "string"
            ? await getStripeClient().charges.retrieve(intent.latest_charge, { stripeAccount: event.account })
            : intent.latest_charge;
          if (latestCharge?.disputed) revokedStatus = "cancelled";
          else if (latestCharge?.refunded) revokedStatus = "refunded";
          else if (intent.status !== "succeeded" || !latestCharge) throw new Error("Checkout payment is not settled.");
        } else if (session.payment_status !== "no_payment_required" || session.amount_total !== 0) {
          throw new Error("Checkout payment intent is missing.");
        }

        const { data: order, error: orderError } = await admin.from("cqa_orders")
          .update({ ...orderDetails, status: revokedStatus || "paid", buyer_user_id: revokedStatus ? null : buyerUserId })
          .eq("stripe_checkout_session_id", session.id)
          .eq("business_id", businessId)
          .neq("status", "refunded").neq("status", "cancelled").neq("status", "disputed")
          .select("id,machine_id,offer_id,amount_cents,currency").maybeSingle();
        if (orderError) throw orderError;

        // No matching row means another event already revoked access. Finish
        // this event without sending a new receipt or running purchase work.
        if (!order || revokedStatus) {
          if (claimedAt) await finishCqaWebhookEvent(event.id, claimedAt);
          return NextResponse.json({ received: true });
        }

        let contactId: string | null = null;
        if (email) {
          const { data: existingContact, error: existingContactError } = await admin.from("cqa_contacts")
            .select("status").eq("business_id", businessId).eq("email", email).maybeSingle();
          if (existingContactError) throw existingContactError;
          const { data: contact, error: contactError } = await admin.from("cqa_contacts").upsert({
            business_id: businessId,
            email,
            name: session.customer_details?.name || null,
            // A purchase is not permission to send marketing or reverse an opt-out.
            status: existingContact?.status || "unsubscribed",
            source: "purchase",
            tags: ["customer"],
            metadata: { latest_order_id: order?.id || null, stripe_checkout_session_id: session.id },
            updated_at: new Date().toISOString()
          }, { onConflict: "business_id,email" }).select("id").single();
          if (contactError) throw contactError;
          contactId = contact?.id || null;
        }

        await notifyCqaOrder({ businessId, orderId: order.id, checkoutId: session.id, customerEmail: email, offerId: order.offer_id, amountCents: order.amount_cents, currency: order.currency });

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

    // Revoke entitlement on fully refunded charges and payment disputes.
    if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
      const charge = event.type === "charge.dispute.created"
        ? await getStripeClient().charges.retrieve(
            typeof (event.data.object as Stripe.Dispute).charge === "string"
              ? (event.data.object as Stripe.Dispute).charge as string
              : ((event.data.object as Stripe.Dispute).charge as Stripe.Charge).id,
            { stripeAccount: event.account || undefined }
          )
        : event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === "string"
        ? charge.payment_intent : charge.payment_intent?.id || null;
      if (paymentIntentId && event.account) {
        const { data: orders, error: lookupError } = await admin.from("cqa_orders")
          .select("id,business_id").eq("stripe_payment_intent_id", paymentIntentId);
        if (lookupError) throw lookupError;
        for (const order of orders || []) {
          const { data: account, error: accountError } = await admin.from("cqa_connected_accounts")
            .select("stripe_account_id").eq("business_id", order.business_id).single();
          if (accountError) throw accountError;
          if (account.stripe_account_id !== event.account) throw new Error("Refund account mismatch.");
          if (event.type === "charge.dispute.created" ||
              (charge.refunded && charge.amount_refunded >= charge.amount)) {
            const { error: revokeError } = await admin.from("cqa_orders")
              // The deployed schema supports cancelled, not disputed. Both
              // represent non-paid access; do not label a dispute as a refund.
              .update({ status: event.type === "charge.dispute.created" ? "cancelled" : "refunded",
                buyer_user_id: null, updated_at: new Date().toISOString() })
              .eq("id", order.id);
            if (revokeError) throw revokeError;
          }
        }
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const { error: expiredError } = await admin.from("cqa_orders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("stripe_checkout_session_id", session.id).eq("status", "pending");
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
