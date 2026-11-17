import 'server-only';
import type Stripe from 'stripe';
import { getCqaSupabaseAdmin } from '@/lib/cqa-supabase-admin';

export type MarketplaceBuyerBinding = { buyerUserId: string | null; buyerEmail?: string };

/** Resolve authenticated service purchases from the checkout-authored ledger.
 * Payer email is editable and must never assign an order to an account.
 * Settlement and terminal-state enforcement remain the webhook caller's job.
 */
export async function verifyMarketplaceBuyerBinding(
  event: Stripe.Event,
  session: Stripe.Checkout.Session
): Promise<MarketplaceBuyerBinding | null> {
  if (session.metadata?.cqaDigitalDelivery === '1') return null;
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') return null;
  const admin = getCqaSupabaseAdmin();
  const { data: order, error } = await admin.from('cqa_orders')
    .select('id,business_id,machine_id,offer_id,customer_user_id,buyer_user_id,amount_cents,currency,stripe_checkout_session_id,status')
    .eq('stripe_checkout_session_id', session.id).maybeSingle();
  if (error) throw error;
  // Revocation is irreversible; old rows may already have lost buyer_user_id.
  if (order && ['refunded', 'cancelled', 'disputed'].includes(order.status)) return { buyerUserId: null };
  const claimedBuyer = session.metadata?.cqaBuyerUserId;
  const customerId = order?.customer_user_id;
  const buyerId = order?.buyer_user_id;
  const durableBuyer = customerId || buyerId;
  if (!durableBuyer) {
    if (claimedBuyer || session.client_reference_id) throw new Error('Checkout has no durable buyer binding.');
    return null;
  }
  if (customerId && buyerId && customerId !== buyerId) throw new Error('Checkout buyer identities do not match.');
  if (!event.account) throw new Error('Checkout buyer account is missing.');
  const { data: account, error: accountError } = await admin.from('cqa_connected_accounts')
    .select('stripe_account_id').eq('business_id', order.business_id).single();
  if (accountError) throw accountError;
  if (account?.stripe_account_id !== event.account) throw new Error('Checkout buyer account does not match business.');
  const metadata = session.metadata || {};
  if ((session.mode !== 'payment' && session.mode !== 'subscription') ||
      session.id !== order.stripe_checkout_session_id ||
      claimedBuyer !== durableBuyer || session.client_reference_id !== durableBuyer ||
      metadata.cqaBusinessId !== order.business_id || metadata.cqaMachineId !== order.machine_id ||
      metadata.cqaOfferId !== order.offer_id || session.amount_total !== order.amount_cents ||
      session.currency !== order.currency) {
    throw new Error('Checkout does not match its durable buyer binding.');
  }
  // Settlement updates customer_email from the payer's editable Stripe details.
  // Resolve the verified account recipient on every attempt, including retries
  // after a previous attempt recorded payment but could not send its receipt.
  const { data: identity, error: identityError } = await admin.auth.admin.getUserById(durableBuyer);
  const buyer = identity?.user;
  if (identityError || !buyer || buyer.id !== durableBuyer || !buyer.email_confirmed_at || buyer.is_anonymous || !buyer.email?.trim())
    throw new Error('Checkout buyer account is not verified.');
  return { buyerUserId: durableBuyer, buyerEmail: buyer.email.trim().toLowerCase() };
}
