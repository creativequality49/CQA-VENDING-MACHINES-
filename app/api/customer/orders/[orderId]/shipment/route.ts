import { customerOrderErrorResponse, getCustomerOrder, requireCustomerOrderUser } from '@/lib/cqa-customer-orders';
import { getCqaSupabaseAdmin } from '@/lib/cqa-supabase-admin';
import { presentShipment, shipmentColumns } from '@/lib/cqa-order-shipment';
export const runtime = 'nodejs';
export async function GET(request: Request, route: { params: Promise<{ orderId: string }> }) {
  try {
    const userId = await requireCustomerOrderUser(request);
    const { orderId } = await route.params;
    const order = await getCustomerOrder(userId, orderId);
    const { data, error } = await getCqaSupabaseAdmin().from('cqa_order_shipments').select(shipmentColumns)
      .eq('order_id', orderId).eq('business_id', order.businessId).maybeSingle();
    if (error) throw error;
    return Response.json({ shipment: presentShipment(data) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return customerOrderErrorResponse(error); }
}
