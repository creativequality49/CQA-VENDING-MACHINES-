import "server-only";
import Stripe from "stripe";
import { CQA_PLANS, CQA_WORKERS, type PlanKey } from "@/lib/cqa-marketplace";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { getStripeClient } from "@/lib/stripe";

export type CqaBillingKind = "plan" | "worker";
export type CqaBillingStatus =
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "unpaid"
  | "cancelled"
  | "incomplete_expired";

export function getPlanDefinition(plan: PlanKey) {
  return CQA_PLANS.find((item) => item.key === plan) || null;
}

export function getWorkerDefinition(workerId: string) {
  return CQA_WORKERS.find(([id]) => id === workerId) || null;
}

export function isActiveBillingStatus(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

function stripeId(value: string | { id: string } | null) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function normaliseSubscriptionStatus(status: Stripe.Subscription.Status): CqaBillingStatus {
  if (status === "active" || status === "trialing" || status === "past_due" || status === "unpaid" || status === "incomplete" || status === "incomplete_expired") {
    return status;
  }
  return "cancelled";
}

function currentPeriodEnd(subscription: Stripe.Subscription) {
  const value = subscription.current_period_end;
  return value ? new Date(value * 1000).toISOString() : null;
}

async function syncPlanSubscription(subscription: Stripe.Subscription) {
  const businessId = subscription.metadata.cqaBusinessId;
  const plan = subscription.metadata.cqaPlan as PlanKey | undefined;
  if (!businessId || !plan || !getPlanDefinition(plan)) return false;

  const admin = getCqaSupabaseAdmin();
  const status = normaliseSubscriptionStatus(subscription.status);
  const { error } = await admin.from("cqa_plan_subscriptions").upsert({
    business_id: businessId,
    plan,
    stripe_customer_id: stripeId(subscription.customer),
    stripe_subscription_id: subscription.id,
    status,
    current_period_end: currentPeriodEnd(subscription),
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString()
  }, { onConflict: "business_id" });
  if (error) throw error;

  if (isActiveBillingStatus(status)) {
    const { error: businessError } = await admin
      .from("cqa_businesses")
      .update({ plan, updated_at: new Date().toISOString() })
      .eq("id", businessId);
    if (businessError) throw businessError;
  }

  return true;
}

async function syncWorkerSubscription(subscription: Stripe.Subscription) {
  const businessId = subscription.metadata.cqaBusinessId;
  const workerId = subscription.metadata.cqaWorkerId;
  const worker = workerId ? getWorkerDefinition(workerId) : null;
  if (!businessId || !workerId || !worker) return false;

  const admin = getCqaSupabaseAdmin();
  const status = normaliseSubscriptionStatus(subscription.status);
  const { error } = await admin.from("cqa_worker_subscriptions").upsert({
    business_id: businessId,
    worker_id: workerId,
    stripe_customer_id: stripeId(subscription.customer),
    stripe_subscription_id: subscription.id,
    status,
    price_cents: worker[2] * 100,
    current_period_end: currentPeriodEnd(subscription),
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString()
  }, { onConflict: "business_id,worker_id" });
  if (error) throw error;

  const { error: workerError } = await admin.from("cqa_business_workers").upsert({
    business_id: businessId,
    worker_id: workerId,
    enabled: isActiveBillingStatus(status),
    updated_at: new Date().toISOString()
  }, { onConflict: "business_id,worker_id" });
  if (workerError) throw workerError;

  return true;
}

async function recordCheckoutSession(session: Stripe.Checkout.Session) {
  const kind = session.metadata?.cqaBillingType as CqaBillingKind | undefined;
  const businessId = session.metadata?.cqaBusinessId;
  if (!kind || !businessId) return false;

  const admin = getCqaSupabaseAdmin();
  const subscriptionId = stripeId(session.subscription);
  const customerId = stripeId(session.customer);

  if (kind === "plan") {
    const plan = session.metadata?.cqaPlan as PlanKey | undefined;
    if (!plan || !getPlanDefinition(plan)) return false;
    const { error } = await admin.from("cqa_plan_subscriptions").upsert({
      business_id: businessId,
      plan,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_checkout_session_id: session.id,
      status: "incomplete",
      updated_at: new Date().toISOString()
    }, { onConflict: "business_id" });
    if (error) throw error;
  } else {
    const workerId = session.metadata?.cqaWorkerId;
    const worker = workerId ? getWorkerDefinition(workerId) : null;
    if (!workerId || !worker) return false;
    const { error } = await admin.from("cqa_worker_subscriptions").upsert({
      business_id: businessId,
      worker_id: workerId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_checkout_session_id: session.id,
      status: "incomplete",
      price_cents: worker[2] * 100,
      updated_at: new Date().toISOString()
    }, { onConflict: "business_id,worker_id" });
    if (error) throw error;
  }

  if (subscriptionId) {
    const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
    if (kind === "plan") await syncPlanSubscription(subscription);
    else await syncWorkerSubscription(subscription);
  }

  return true;
}

export async function handleCqaBillingStripeEvent(event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    return recordCheckoutSession(event.data.object as Stripe.Checkout.Session);
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const kind = subscription.metadata.cqaBillingType as CqaBillingKind | undefined;
    if (kind === "plan") return syncPlanSubscription(subscription);
    if (kind === "worker") return syncWorkerSubscription(subscription);
  }

  return false;
}
