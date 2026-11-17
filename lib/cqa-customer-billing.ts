import "server-only";
import { z } from "zod";
import { CustomerOrderError } from "@/lib/cqa-customer-orders";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { getStripeClient } from "@/lib/stripe";
import { getCqaSiteUrl } from "@/lib/cqa-site-url";

const uuid = z.string().uuid();
const unavailable = () => new CustomerOrderError(404, "Subscription not found");
function objectId(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string" && value.id && !("deleted" in value && value.deleted)) return value.id;
  return null;
}

/** Billing management uses durable purchaser identity, not current delivery entitlement. */
export async function createCustomerBillingPortal(request: Request, userId: string, orderId: string) {
  if (!uuid.safeParse(userId).success) throw new CustomerOrderError(401, "Verified account required");
  if (!uuid.safeParse(orderId).success) throw new CustomerOrderError(400, "Invalid order reference");
  const admin = getCqaSupabaseAdmin();
  const { data: order, error: orderError } = await admin.from("cqa_orders")
    .select("id,business_id,machine_id,offer_id,customer_user_id,buyer_user_id,stripe_checkout_session_id")
    .eq("id", orderId).or(`customer_user_id.eq.${userId},buyer_user_id.eq.${userId}`).maybeSingle();
  if (orderError) throw orderError;
  if (!order || (order.customer_user_id || order.buyer_user_id) !== userId ||
      !order.business_id || !order.machine_id || !order.offer_id || !order.stripe_checkout_session_id) throw unavailable();
  const { data: account, error: accountError } = await admin.from("cqa_connected_accounts")
    .select("business_id,stripe_account_id").eq("business_id", order.business_id).maybeSingle();
  if (accountError) throw accountError;
  if (!account || account.business_id !== order.business_id || !account.stripe_account_id) throw unavailable();
  const stripe = getStripeClient();
  const stripeAccount = { stripeAccount: account.stripe_account_id };
  // The historical provider contract survives offer edits or deletion. A mutable
  // catalogue type must never strand a customer's subscription management.
  const session = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id, {}, stripeAccount);
  const customerId = objectId(session.customer), subscriptionId = objectId(session.subscription);
  const matchesMetadata = (metadata: Record<string, string> | null | undefined) =>
    Boolean(metadata && metadata.cqaBusinessId === order.business_id && metadata.cqaMachineId === order.machine_id &&
    metadata.cqaOfferId === order.offer_id && metadata.cqaBuyerUserId === userId);
  if (session.id !== order.stripe_checkout_session_id || session.mode !== "subscription" ||
      session.client_reference_id !== userId || !matchesMetadata(session.metadata) || !customerId || !subscriptionId) throw unavailable();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {}, stripeAccount);
  if (subscription.id !== subscriptionId || objectId(subscription.customer) !== customerId || !matchesMetadata(subscription.metadata)) throw unavailable();
  // Cancellations and refunds do not remove the customer's ability to manage billing.
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getCqaSiteUrl(request)}/account/orders/${encodeURIComponent(orderId)}`
  }, stripeAccount);
  const destination = new URL(portal.url);
  if (destination.origin !== "https://billing.stripe.com" || destination.username || destination.password)
    throw new Error("Invalid billing portal destination");
  return { url: destination.href };
}
