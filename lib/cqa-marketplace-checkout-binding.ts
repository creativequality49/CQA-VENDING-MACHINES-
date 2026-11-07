import 'server-only';
import Stripe from 'stripe';
import { getCqaSupabaseAdmin } from '@/lib/cqa-supabase-admin';
import { getStripeClient } from '@/lib/stripe';

/** Existing cqa_orders pending row is the server-authored digital purchase
 * contract. Stripe metadata and the payer's editable email cannot replace it. */
export async function verifyMarketplaceDigitalCheckout(event: Stripe.Event, supplied: Stripe.Checkout.Session) {
  if (supplied.payment_status !== 'paid' && supplied.payment_status !== 'no_payment_required') return null;
  const admin = getCqaSupabaseAdmin();
  const { data: pending, error: pendingError } = await admin.from('cqa_orders')
    .select('id,business_id,machine_id,offer_id,buyer_user_id,amount_cents,currency,stripe_checkout_session_id,stripe_payment_intent_id,status')
    .eq('stripe_checkout_session_id', supplied.id).maybeSingle();
  if (pendingError) throw pendingError;
  // Connect accounts can emit unrelated Checkout events. With neither our
  // durable contract nor CQA metadata there is nothing to fulfill, and undefined
  // identifiers must never reach UUID-filtered offer queries.
  if (!pending && !supplied.metadata?.cqaBusinessId && !supplied.metadata?.cqaDigitalDelivery) return null;
  const businessId = pending?.business_id || supplied.metadata?.cqaBusinessId;
  const offerId = pending?.offer_id || supplied.metadata?.cqaOfferId;
  const machineId = pending?.machine_id || supplied.metadata?.cqaMachineId;
  const { data: offer, error: offerError } = await admin.from('cqa_offers').select('offer_type,fulfillment_type')
    .eq('id', offerId).eq('business_id', businessId).eq('machine_id', machineId).maybeSingle();
  if (offerError) throw offerError;
  const digital = offer?.offer_type === 'digital_product' || offer?.fulfillment_type === 'digital';
  if (!digital && supplied.metadata?.cqaDigitalDelivery !== '1') return null;
  if (digital && pending && ['refunded', 'cancelled', 'disputed'].includes(pending.status)) return { session: supplied, buyerUserId: null, buyerEmail: null, terminal: true };
  if (!digital || !pending || !pending.buyer_user_id || !event.account) throw new Error('Digital checkout has no durable buyer contract.');
  const { data: account, error: accountError } = await admin.from('cqa_connected_accounts').select('stripe_account_id').eq('business_id', pending.business_id).single();
  if (accountError || account?.stripe_account_id !== event.account) throw new Error('Digital checkout account mismatch.');
  const session = await getStripeClient().checkout.sessions.retrieve(supplied.id, { expand: ['payment_intent'] }, { stripeAccount: event.account });
  const metadata = session.metadata || {};
  const keys = ['cqaBusinessId', 'cqaMachineId', 'cqaOfferId', 'cqaBuyerUserId', 'cqaDigitalDelivery'];
  const id = (value: Stripe.Checkout.Session['payment_intent']) => typeof value === 'string' ? value : value?.id;
  if (session.id !== pending.stripe_checkout_session_id || session.mode !== 'payment' || session.payment_status !== 'paid' ||
      session.amount_total !== pending.amount_cents || session.currency !== pending.currency ||
      session.client_reference_id !== pending.buyer_user_id || metadata.cqaBuyerUserId !== pending.buyer_user_id ||
      metadata.cqaBusinessId !== pending.business_id || metadata.cqaMachineId !== pending.machine_id || metadata.cqaOfferId !== pending.offer_id ||
      metadata.cqaDigitalDelivery !== '1' || keys.some(key => supplied.metadata?.[key] !== metadata[key]) ||
      supplied.amount_total !== session.amount_total || supplied.currency !== session.currency || id(supplied.payment_intent) !== id(session.payment_intent)) {
    throw new Error('Digital checkout does not match its durable purchase contract.');
  }
  const pi = session.payment_intent;
  if (!pi || typeof pi === 'string' || pi.status !== 'succeeded' || pi.amount !== pending.amount_cents || pi.currency !== pending.currency ||
      (pending.stripe_payment_intent_id && pending.stripe_payment_intent_id !== pi.id)) throw new Error('Digital payment binding mismatch.');
  const { data: identity, error: identityError } = await admin.auth.admin.getUserById(pending.buyer_user_id);
  if (identityError || !identity?.user?.email_confirmed_at || !identity.user.email || identity.user.is_anonymous) throw new Error('Digital buyer account is not verified.');
  // Bind before the caller reads the latest Charge. Refunds arriving earlier
  // are caught by that subsequent provider read; later refunds can find this
  // pending row by actual PI ID and make its terminal state irreversible.
  const { error: bindError } = await admin.from('cqa_orders').update({ stripe_payment_intent_id: pi.id })
    .eq('id', pending.id).eq('business_id', pending.business_id).eq('status', 'pending');
  if (bindError) throw bindError;
  return { session, buyerUserId: pending.buyer_user_id as string, buyerEmail: identity.user.email.trim().toLowerCase(), terminal: false };
}
