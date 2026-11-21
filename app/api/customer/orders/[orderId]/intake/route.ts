import { CustomerOrderError, customerOrderErrorResponse, requireCustomerOrderUser, submitCustomerOrderIntake } from "@/lib/cqa-customer-orders";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  try {
    const userId = await requireCustomerOrderUser(request);
    const { orderId } = await context.params;
    const body = await request.text();
    if (body.length > 20000) throw new CustomerOrderError(400, "Intake is too large");
    let payload: unknown;
    try { payload = JSON.parse(body); } catch { throw new CustomerOrderError(400, "Invalid intake JSON"); }
    const order = await submitCustomerOrderIntake(userId, orderId, payload);
    return Response.json({ order, events: order.events }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return customerOrderErrorResponse(error); }
}
