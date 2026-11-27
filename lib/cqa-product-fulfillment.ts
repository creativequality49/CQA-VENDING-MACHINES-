import 'server-only';
import type Stripe from 'stripe';
import { getCqaSupabaseAdmin } from '@/lib/cqa-supabase-admin';
import { getStripeClient } from '@/lib/stripe';

function row(result: unknown): Record<string, unknown> {
  return result && typeof result === 'object' && !Array.isArray(result) ? result as Record<string, unknown> : {};
}
export async function reserveProductInventory(offerId: string, buyerId: string, expected?: Record<string, unknown>) {
  const { data, error } = await getCqaSupabaseAdmin().rpc('cqa_reserve_inventory', {
    p_offer_id: offerId, p_buyer_user_id: buyerId, p_idempotency_key: crypto.randomUUID(), p_quantity: 1
  });
  if (error) throw Object.assign(new Error('This product is unavailable or its inventory could not be reserved.'), { status: 409 });
  const reservation = row(row(data).reservation);
  if (!reservation?.id || reservation.state !== 'reserved' || reservation.offer_id !== offerId || reservation.buyer_user_id !== buyerId || reservation.quantity !== 1) throw new Error('Inventory reservation was not confirmed.');
  if (expected) {
    const snapshot = row(reservation.offer_snapshot), shipping = row(snapshot.shipping);
    const expectedShipping = row(expected.shipping);
    const equalCountries = Array.isArray(shipping.supportedRegions) && Array.isArray(expectedShipping.supportedRegions) && JSON.stringify([...shipping.supportedRegions].sort()) === JSON.stringify([...expectedShipping.supportedRegions].sort());
    if (snapshot.title !== expected.title || snapshot.offerType !== expected.offerType || snapshot.fulfillmentType !== expected.fulfillmentType ||
        snapshot.priceCents !== expected.priceCents || snapshot.currency !== expected.currency ||
        ["deliveryDescription", "deliveryTiming", "supportDetails", "refundTerms"].some(key => row(snapshot.terms)[key] !== row(expected.terms)[key]) ||
        (typeof expected.productRevision === 'number' && snapshot.productRevision !== expected.productRevision) ||
        (expected.shipping && (!equalCountries || shipping.flatFeeCents !== expectedShipping.flatFeeCents || shipping.dispatchTiming !== expectedShipping.dispatchTiming))) {
      await releaseUnboundProductInventory(String(reservation.id));
      throw Object.assign(new Error('This product changed. Refresh before purchasing.'), { status: 409 });
    }
  }
  return String(reservation.id);
}
export async function bindProductInventory(reservationId: string, checkoutId: string, orderId: string) {
  const { data, error } = await getCqaSupabaseAdmin().rpc('cqa_bind_inventory_reservation', {
    p_reservation_id: reservationId, p_checkout_session_id: checkoutId, p_order_id: orderId
  });
  if (error) throw error;
  const reservation = row(row(data).reservation);
  if (reservation?.id !== reservationId || reservation.stripe_checkout_session_id !== checkoutId || reservation.order_id !== orderId || reservation.state !== 'reserved')
    throw new Error('Inventory binding was not confirmed.');
}
export async function releaseUnboundProductInventory(reservationId: string) {
  const { error } = await getCqaSupabaseAdmin().rpc('cqa_release_inventory_reservation', { p_reservation_id: reservationId });
  if (error) throw error;
}
export async function releaseCheckoutProductInventory(checkoutId: string, eventAccount: string | undefined) {
  const admin = getCqaSupabaseAdmin();
  const { data: order, error: lookupError } = await admin.from('cqa_orders').select('business_id').eq('stripe_checkout_session_id', checkoutId).maybeSingle();
  if (lookupError) throw lookupError;
  if (!order) return;
  const { data: account, error: accountError } = await admin.from('cqa_connected_accounts').select('stripe_account_id').eq('business_id', order.business_id).single();
  if (accountError || !eventAccount || account?.stripe_account_id !== eventAccount) throw new Error('Product event account mismatch.');
  const { error } = await getCqaSupabaseAdmin().rpc('cqa_settle_inventory_reservation', { p_checkout_session_id: checkoutId, p_action: 'release' });
  if (error) throw error;
}

/** Retrieve physical checkout on its Connect account; never trust editable catalogue or browser addresses. */
export async function verifyPhysicalProductCheckout(event: Stripe.Event, supplied: Stripe.Checkout.Session) {
  if (supplied.payment_status !== 'paid') return null;
  const admin = getCqaSupabaseAdmin();
  const { data: order, error } = await admin.from('cqa_orders').select('id,business_id,machine_id,offer_id,customer_user_id,buyer_user_id,status,amount_cents,currency,purchase_snapshot')
    .eq('stripe_checkout_session_id', supplied.id).maybeSingle();
  if (error) throw error;
  const physical = order?.purchase_snapshot?.offerType === 'physical_product' || order?.purchase_snapshot?.fulfillmentType === 'shipping';
  if (!physical && supplied.metadata?.cqaPhysicalDelivery !== '1') return null;
  if (!order) throw new Error('Physical checkout has no durable purchase.');
  if (!event.account || supplied.mode !== 'payment' || supplied.metadata?.cqaPhysicalDelivery !== '1') throw new Error('Physical checkout account or delivery marker is missing.');
  if (['refunded', 'cancelled', 'disputed'].includes(order.status)) return { terminal: true as const, session: supplied, address: null };
  const { data: account, error: accountError } = await admin.from('cqa_connected_accounts').select('stripe_account_id').eq('business_id', order.business_id).single();
  if (accountError || account?.stripe_account_id !== event.account) throw new Error('Physical checkout account mismatch.');
  const session = await getStripeClient().checkout.sessions.retrieve(supplied.id, {}, { stripeAccount: event.account });
  const snapshot = row(order.purchase_snapshot), shipping = row(snapshot.shipping);
  const metadata = session.metadata || {};
  if (session.mode !== 'payment' || session.payment_status !== 'paid' || session.id !== supplied.id ||
      session.amount_total !== order.amount_cents || session.currency !== order.currency ||
      metadata.cqaBusinessId !== order.business_id || metadata.cqaMachineId !== order.machine_id || metadata.cqaOfferId !== order.offer_id ||
      !order.customer_user_id || metadata.cqaBuyerUserId !== order.customer_user_id || session.client_reference_id !== order.customer_user_id ||
      metadata.cqaPhysicalDelivery !== '1' || typeof shipping.reservationId !== 'string' || !shipping.reservationId || metadata.cqaInventoryReservationId !== shipping.reservationId ||
      session.shipping_cost?.amount_total !== shipping.rateCents || session.total_details?.amount_shipping !== shipping.rateCents ||
      !Array.isArray(shipping.countries)) throw new Error('Physical checkout does not match its purchase.');
  const supplier = snapshot.fulfilmentType === 'supplier_shipped';
  const pilot = supplier || snapshot.pilotPhysicalCheckout === true;
  if (pilot && event.livemode !== false) throw new Error('Physical pilot checkout must use sandbox payment.');
  if (pilot && session.amount_subtotal !== snapshot.unitPriceCents) throw new Error('Physical checkout item amount does not match its purchase.');
  const details = session.shipping_details;
  const address = details?.address;
  if (!details?.name?.trim() || !address?.line1?.trim() || !address.city?.trim() || !address.postal_code?.trim() ||
      !address.country || !shipping.countries.includes(address.country)) throw new Error('Physical checkout delivery address is incomplete.');
  const phone = session.customer_details?.phone?.trim();
  if (supplier && (!phone || phone.length < 5 || phone.length > 40)) throw new Error('Supplier delivery contact is incomplete.');
  return { terminal: false as const, session, pilot, supplier, address: { name: details.name, line1: address.line1, line2: address.line2 || '', city: address.city, state: address.state || '', postal_code: address.postal_code, country: address.country, ...(supplier && phone ? { phone } : {}) } };
}
export async function recordProductFulfillment(orderId: string, checkoutId: string, address: Record<string, string> = {}) {
  const { data, error } = await getCqaSupabaseAdmin().rpc('cqa_record_product_fulfillment', {
    p_order_id: orderId, p_checkout_session_id: checkoutId, p_shipping_address: address
  });
  if (error) throw error;
  const result = row(data), job = row(result.job);
  const physical = Object.keys(address).length > 0;
  if (job.order_id !== orderId || job.kind !== (physical ? 'physical_shipment' : 'digital_access') || !(physical ? ['queued', 'processing', 'completed'].includes(String(job.state)) : job.state === 'completed')) throw new Error('Product fulfillment was not confirmed.');
  if (physical && (row(result.shipment).order_id !== orderId || !['ready', 'packing', 'shipped', 'delivered'].includes(String(row(result.shipment).state)))) throw new Error('Shipment fulfillment was not confirmed.');
}
