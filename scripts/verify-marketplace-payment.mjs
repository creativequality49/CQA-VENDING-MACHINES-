import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { configuration, verifyReadOnly } from "./verify-marketplace-integration.mjs";
import { pathToFileURL } from "node:url";

const sandboxAccount = "acct_1UPzM6P6kjGSpjgk";
function check(condition, code) {
  if (!condition) throw new Error(code);
}

// Match provider and database evidence before requesting any download.
export function matchPayment({ order, merchant, event, receipt, session, buyer, config }) {
  check(order?.id === config.order && order.business_id === config.business &&
    order.offer_id === config.offer && order.status === "paid" && order.buyer_user_id === buyer,
    "paid-order-mismatch");
  check(event?.livemode === false && (event.account == null || event.account === merchant) &&
    ["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type) &&
    receipt?.event_id === event.id && receipt.event_type === event.type && receipt.status === "processed",
    "processed-webhook-mismatch");
  const delivered = event.data.object;
  const pi = session?.payment_intent;
  check(session?.livemode === false && session.mode === "payment" && session.payment_status === "paid" &&
    session.id === order.stripe_checkout_session_id && delivered.id === session.id &&
    delivered.payment_status === "paid" && delivered.payment_intent === pi?.id &&
    session.client_reference_id === buyer && session.metadata?.cqaBuyerUserId === buyer &&
    session.metadata.cqaDigitalDelivery === "1" && session.metadata.cqaOfferId === order.offer_id &&
    session.metadata.cqaMachineId === order.machine_id && session.metadata.cqaBusinessId === order.business_id &&
    pi?.id === order.stripe_payment_intent_id && pi?.status === "succeeded" && pi.livemode === false &&
    order.amount_cents > 0 && pi.amount_received === order.amount_cents &&
    session.amount_total === order.amount_cents && pi.currency === order.currency &&
    session.currency === order.currency, "provider-payment-mismatch");
}

export async function verify(env) {
  const parsed = configuration(env);
  if (!parsed.config) return parsed.report;
  const config = parsed.config;
  const required = ["CQA_TEST_STRIPE_KEY", "CQA_TEST_DATABASE_SERVICE_KEY", "CQA_TEST_STRIPE_EVENT_ID"];
  const missing = required.filter(name => !env[name]);
  if (missing.length) return { status: "blocked", missing };
  if (!/^(sk|rk)_test_/.test(env.CQA_TEST_STRIPE_KEY) || !/^evt_[a-zA-Z0-9]+$/.test(env.CQA_TEST_STRIPE_EVENT_ID))
    return { status: "blocked", code: "sandbox-credentials-or-event-required" };
  let phase = "verify-sandbox-account";
  try {
    const stripe = new Stripe(env.CQA_TEST_STRIPE_KEY);
    check((await stripe.accounts.retrieve()).id === sandboxAccount, phase);
    const db = createClient(config.supabase, env.CQA_TEST_DATABASE_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    phase = "identify-buyer";
    const identity = await db.auth.getUser(config.tokens[1]);
    check(identity.data.user?.email_confirmed_at && !identity.error, phase);
    phase = "read-paid-order";
    const { data: order, error } = await db.from("cqa_orders")
      .select("id,business_id,machine_id,offer_id,status,buyer_user_id,stripe_checkout_session_id,stripe_payment_intent_id,amount_cents,currency")
      .eq("id", config.order).eq("business_id", config.business).single();
    check(!error && order?.stripe_checkout_session_id?.startsWith("cs_test_"), phase);
    phase = "identify-connected-merchant";
    const { data: account } = await db.from("cqa_connected_accounts").select("stripe_account_id").eq("business_id", config.business).single();
    check(account?.stripe_account_id, phase);
    const merchant = account.stripe_account_id;
    phase = "match-stripe-payment-and-processed-webhook";
    const eventId = env.CQA_TEST_STRIPE_EVENT_ID;
    const [session, event, { data: receipt }] = await Promise.all([
      stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id, { expand: ["payment_intent"] }, { stripeAccount: merchant }),
      stripe.events.retrieve(eventId, {}, { stripeAccount: merchant }),
      db.from("cqa_stripe_webhook_events").select("event_id,event_type,status").eq("event_id", eventId).single()
    ]);
    matchPayment({ order, merchant, event, receipt, session, buyer: identity.data.user.id, config });
    phase = "verify-private-delivery";
    const delivery = await verifyReadOnly(config);
    return { ...delivery, mode: "payment-to-delivery", evidence: { orderId: order.id, eventId, sessionId: session.id, paymentIntentId: session.payment_intent.id },
      unverified: delivery.unverified.filter(id => delivery.status !== "passed-requested-read-only-probes" || id !== "payment-to-download"),
      checks: [{ id: "provider-payment-and-processed-webhook", result: "passed" }, ...delivery.checks] };
  } catch { return { status: "failed", phase }; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await verify(process.env);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.status.startsWith("passed-") ? 0 : 1;
}
