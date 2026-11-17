import { customerOrderErrorResponse, downloadCustomerOrderAsset, requireCustomerOrderUser } from "@/lib/cqa-customer-orders";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ orderId: string }> }) {
  try {
    const userId = await requireCustomerOrderUser(request);
    const { orderId } = await context.params;
    return Response.json(await downloadCustomerOrderAsset(userId, orderId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return customerOrderErrorResponse(error); }
}
