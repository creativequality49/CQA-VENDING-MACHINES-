import Stripe from "stripe";
import { getSupabaseAdminClient } from "@/lib/supabase";

const activeStatuses = new Set(["active","trialing"]);

function id(value: string | Stripe.Customer | Stripe.DeletedCustomer | Stripe.PaymentIntent | Stripe.Subscription | null) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export async function handleFanXStripeEvent(event: Stripe.Event) {
  const db = getSupabaseAdminClient() as any;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.system !== "fanx") return false;
    const orderId = session.metadata.orderId;
    const fanUserId = session.metadata.fanUserId;
    const creatorId = session.metadata.creatorId;
    const kind = session.metadata.kind as "subscription"|"product"|"post"|"tip";
    const itemId = session.metadata.itemId || null;
    if (!orderId || !fanUserId || !creatorId || !kind) return true;

    const { data: order, error: orderError } = await db.from("fanx_orders").update({
      status: "paid",
      stripe_payment_intent_id: id(session.payment_intent as any),
      stripe_subscription_id: id(session.subscription as any),
      updated_at: new Date().toISOString()
    }).eq("id", orderId).select("id,gross_cents,platform_fee_cents,creator_net_cents").single();
    if (orderError) throw new Error(orderError.message);

    const { data: existingEarning } = await db.from("fanx_earnings").select("id").eq("order_id", orderId).maybeSingle();
    if (!existingEarning) {
      await db.from("fanx_earnings").insert({
        creator_id: creatorId,
        order_id: orderId,
        earning_type: kind,
        gross_cents: order.gross_cents,
        platform_fee_cents: order.platform_fee_cents,
        creator_net_cents: order.creator_net_cents,
        currency: "aud",
        status: "available"
      });
    }

    if (kind === "subscription" && itemId) {
      const stripeSubscriptionId = id(session.subscription as any);
      const { data: sub, error } = await db.from("fanx_subscriptions").upsert({
        fan_user_id: fanUserId,
        creator_id: creatorId,
        tier_id: itemId,
        stripe_customer_id: id(session.customer as any),
        stripe_subscription_id: stripeSubscriptionId,
        status: "active",
        updated_at: new Date().toISOString()
      }, { onConflict: "fan_user_id,tier_id" }).select("id").single();
      if (error) throw new Error(error.message);
      await db.from("fanx_entitlements").upsert({
        fan_user_id: fanUserId,
        creator_id: creatorId,
        content_type: "creator_subscription",
        content_id: creatorId,
        source_order_id: orderId,
        source_subscription_id: sub.id,
        status: "active",
        expires_at: null,
        updated_at: new Date().toISOString()
      }, { onConflict: "fan_user_id,content_type,content_id" });
    } else if ((kind === "product" || kind === "post") && itemId) {
      await db.from("fanx_entitlements").upsert({
        fan_user_id: fanUserId,
        creator_id: creatorId,
        content_type: kind,
        content_id: itemId,
        source_order_id: orderId,
        status: "active",
        expires_at: null,
        updated_at: new Date().toISOString()
      }, { onConflict: "fan_user_id,content_type,content_id" });
    }
    return true;
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    if (sub.metadata?.system !== "fanx") return false;
    const fanUserId = sub.metadata.fanUserId;
    const creatorId = sub.metadata.creatorId;
    const tierId = sub.metadata.itemId;
    if (!fanUserId || !creatorId || !tierId) return true;
    const active = event.type !== "customer.subscription.deleted" && activeStatuses.has(sub.status);
    const status = event.type === "customer.subscription.deleted" ? "cancelled" : sub.status;
    const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
    const { data: row, error } = await db.from("fanx_subscriptions").upsert({
      fan_user_id: fanUserId,
      creator_id: creatorId,
      tier_id: tierId,
      stripe_customer_id: id(sub.customer as any),
      stripe_subscription_id: sub.id,
      status,
      current_period_end: periodEnd,
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString()
    }, { onConflict: "fan_user_id,tier_id" }).select("id").single();
    if (error) throw new Error(error.message);
    await db.from("fanx_entitlements").upsert({
      fan_user_id: fanUserId,
      creator_id: creatorId,
      content_type: "creator_subscription",
      content_id: creatorId,
      source_subscription_id: row.id,
      status: active ? "active" : "expired",
      expires_at: active ? periodEnd : new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: "fan_user_id,content_type,content_id" });
    return true;
  }

  if (event.type === "invoice.payment_failed" || event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = id(invoice.subscription as any);
    if (!subscriptionId) return false;
    const { data: sub } = await db.from("fanx_subscriptions").select("id,fan_user_id,creator_id").eq("stripe_subscription_id", subscriptionId).maybeSingle();
    if (!sub) return false;
    if (event.type === "invoice.payment_failed") {
      const grace = new Date(Date.now() + 3*24*60*60*1000).toISOString();
      await db.from("fanx_subscriptions").update({ status:"past_due", updated_at:new Date().toISOString() }).eq("id",sub.id);
      await db.from("fanx_entitlements").update({ status:"active", expires_at:grace, updated_at:new Date().toISOString() }).eq("fan_user_id",sub.fan_user_id).eq("content_type","creator_subscription").eq("content_id",sub.creator_id);
    } else {
      await db.from("fanx_subscriptions").update({ status:"active", updated_at:new Date().toISOString() }).eq("id",sub.id);
      await db.from("fanx_entitlements").update({ status:"active", expires_at:null, updated_at:new Date().toISOString() }).eq("fan_user_id",sub.fan_user_id).eq("content_type","creator_subscription").eq("content_id",sub.creator_id);
    }
    return true;
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId = id(charge.payment_intent as any);
    if (!paymentIntentId) return false;
    const { data: order } = await db.from("fanx_orders").select("id,creator_id,gross_cents,platform_fee_cents,creator_net_cents").eq("stripe_payment_intent_id",paymentIntentId).maybeSingle();
    if (!order) return false;
    await db.from("fanx_orders").update({status:"refunded",updated_at:new Date().toISOString()}).eq("id",order.id);
    await db.from("fanx_entitlements").update({status:"revoked",updated_at:new Date().toISOString()}).eq("source_order_id",order.id);
    const { data: reversal } = await db.from("fanx_earnings").select("id").eq("order_id",order.id).eq("earning_type","refund").maybeSingle();
    if(!reversal) await db.from("fanx_earnings").insert({creator_id:order.creator_id,order_id:order.id,earning_type:"refund",gross_cents:-order.gross_cents,platform_fee_cents:-order.platform_fee_cents,creator_net_cents:-order.creator_net_cents,currency:"aud",status:"reversed"});
    return true;
  }

  return false;
}
