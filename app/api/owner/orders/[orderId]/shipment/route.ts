import { z } from 'zod';
import { requireCqaOwner } from '@/lib/cqa-owner-auth';
import { getCqaSupabaseAdmin } from '@/lib/cqa-supabase-admin';
import { ownerOrder, ownerOrderHeaders, orderFailure, requestBusinessId, safeOwnerOrderError } from '@/lib/cqa-owner-orders';
import { presentShipment, shipmentColumns } from '@/lib/cqa-order-shipment';
export const runtime = 'nodejs';
type Context = { params: Promise<{ orderId: string }> };
const schema = z.object({ action: z.enum(['pack', 'ship', 'dispatch', 'deliver']), expectedRevision: z.number().int().min(0).max(2147483647),
  carrier: z.string().trim().min(1).max(100).optional(), trackingNumber: z.string().trim().min(1).max(200).optional(),
  trackingUrl: z.string().max(2000).optional() }).strict();
async function load(request: Request, route: Context) {
  const context = await requireCqaOwner(request, requestBusinessId(request));
  const { orderId } = await route.params;
  const order = await ownerOrder(context, orderId);
  const { data: shipment, error } = await getCqaSupabaseAdmin().from('cqa_order_shipments').select(shipmentColumns)
    .eq('order_id', orderId).eq('business_id', context.business.id).maybeSingle();
  if (error) throw error;
  return { context, orderId, order, shipment };
}
export async function GET(request: Request, route: Context) {
  try { const { shipment } = await load(request, route); return Response.json({ shipment: presentShipment(shipment) }, { headers: ownerOrderHeaders }); }
  catch (error) { const result = safeOwnerOrderError(error); return Response.json({ error: result.error }, { status: result.status, headers: ownerOrderHeaders }); }
}
export async function POST(request: Request, route: Context) {
  try {
    const body = schema.safeParse(await request.json().catch(() => null));
    if (!body.success) orderFailure(400, 'Choose a valid dispatch action and refresh this shipment.');
    const { context, orderId, order, shipment } = await load(request, route);
    if (order.status !== 'paid' || !shipment) orderFailure(409, 'Only confirmed paid physical orders can be dispatched.');
    const action = body.data.action === 'dispatch' ? 'ship' : body.data.action;
    if (action === 'ship' && (!body.data.carrier || !body.data.trackingNumber)) orderFailure(400, 'Enter the carrier and tracking number for the shipment you have dispatched.');
    if (body.data.trackingUrl) {
      let url: URL; try { url = new URL(body.data.trackingUrl); } catch { orderFailure(400, 'Use a valid HTTPS tracking URL.'); }
      if (url.protocol !== 'https:' || url.username || url.password) orderFailure(400, 'Use a valid HTTPS tracking URL.');
    }
    const { data, error } = await getCqaSupabaseAdmin().rpc('cqa_update_order_shipment', { p_order_id: orderId, p_actor_user_id: context.user.id, p_action: action,
      p_payload: { carrier: body.data.carrier || '', tracking_number: body.data.trackingNumber || '', tracking_url: body.data.trackingUrl || '' }, p_expected_revision: body.data.expectedRevision });
    if (error) orderFailure(409, 'The shipment changed or this action is not available. Refresh before trying again.');
    const result = data as { shipment?: Record<string, unknown> } | null;
    const expectedState = action === 'pack' ? 'packing' : action === 'ship' ? 'shipped' : 'delivered';
    if (!result?.shipment || result.shipment.order_id !== orderId || result.shipment.business_id !== context.business.id || result.shipment.state !== expectedState || result.shipment.revision !== body.data.expectedRevision + 1) throw new Error('Shipment update was not confirmed.');
    return Response.json({ updated: true, shipment: presentShipment(result.shipment) }, { headers: ownerOrderHeaders });
  } catch (error) { const result = safeOwnerOrderError(error); return Response.json({ error: result.error }, { status: result.status, headers: ownerOrderHeaders }); }
}
