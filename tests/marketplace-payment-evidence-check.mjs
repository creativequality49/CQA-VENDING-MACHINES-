import assert from "node:assert/strict";
import { matchPayment } from "../scripts/verify-marketplace-payment.mjs";

const order = { id: "order", offer_id: "pack", machine_id: "machine", business_id: "business",
  buyer_user_id: "buyer", status: "paid", currency: "aud", amount_cents: 900,
  stripe_checkout_session_id: "cs_test_one", stripe_payment_intent_id: "pi_one" };
const evidence = { order, buyer: "buyer", merchant: "acct_merchant",
  config: { order: "order", business: "business", offer: "pack" },
  event: { id: "evt_one", type: "checkout.session.completed", livemode: false, account: "acct_merchant",
    data: { object: { id: "cs_test_one", payment_status: "paid", payment_intent: "pi_one" } } },
  receipt: { event_id: "evt_one", event_type: "checkout.session.completed", status: "processed" },
  session: { id: "cs_test_one", livemode: false, mode: "payment", payment_status: "paid", currency: "aud",
    amount_total: 900, client_reference_id: "buyer", metadata: { cqaBusinessId: "business", cqaMachineId: "machine",
      cqaOfferId: "pack", cqaBuyerUserId: "buyer", cqaDigitalDelivery: "1" },
    payment_intent: { id: "pi_one", status: "succeeded", livemode: false, currency: "aud", amount_received: 900 } } };
matchPayment(evidence);
for (const change of [
  x => { x.receipt.status = "failed"; }, x => { x.event.data.object.id = "cs_test_other"; },
  x => { x.session.payment_intent.amount_received = 899; }, x => { x.session.livemode = true; },
  x => { x.order.buyer_user_id = "other"; }, x => { x.event.account = "acct_other"; },
  x => { x.order.status = "refunded"; }
]) {
  const altered = structuredClone(evidence);
  change(altered);
  assert.throws(() => matchPayment(altered));
}
console.log("PASS sandbox payment must match the order and processed event");
