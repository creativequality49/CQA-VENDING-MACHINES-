import 'server-only';

export const shipmentColumns = 'order_id,business_id,state,shipping_address,carrier,tracking_number,tracking_url,revision,shipped_at,delivered_at,updated_at';
export function presentShipment(value: Record<string, unknown> | null) {
  if (!value) return null;
  const raw = value.shipping_address;
  const address = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const text = (input: unknown) => typeof input === 'string' ? input : '';
  return { orderId: text(value.order_id), status: text(value.state), recipientName: text(address.name),
    address: { line1: text(address.line1), line2: text(address.line2), city: text(address.city), state: text(address.state), postal_code: text(address.postal_code), country: text(address.country) },
    carrier: text(value.carrier) || null, trackingNumber: text(value.tracking_number) || null, trackingUrl: text(value.tracking_url) || null,
    dispatchedAt: text(value.shipped_at) || null, deliveredAt: text(value.delivered_at) || null, revision: value.revision, updatedAt: value.updated_at };
}
