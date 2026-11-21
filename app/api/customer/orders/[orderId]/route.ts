import { customerOrderErrorResponse, getCustomerOrder, requireCustomerOrderUser } from "@/lib/cqa-customer-orders";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ orderId: string }> }) {
  try {
    const userId = await requireCustomerOrderUser(request);
    const { orderId } = await context.params;
    const order = await getCustomerOrder(userId, orderId);
    return Response.json({ order, events: order.events }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return customerOrderErrorResponse(error); }
}
