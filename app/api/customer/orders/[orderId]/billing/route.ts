import { createCustomerBillingPortal } from "@/lib/cqa-customer-billing";
import { customerOrderErrorResponse, requireCustomerOrderUser } from "@/lib/cqa-customer-orders";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  try {
    const userId = await requireCustomerOrderUser(request);
    const { orderId } = await context.params;
    return Response.json(await createCustomerBillingPortal(request, userId, orderId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return customerOrderErrorResponse(error); }
}
