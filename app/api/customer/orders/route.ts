import { customerOrderErrorResponse, customerOrderPagination, listCustomerOrders, requireCustomerOrderUser } from "@/lib/cqa-customer-orders";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const userId = await requireCustomerOrderUser(request);
    const { limit, offset } = customerOrderPagination(request.url);
    return Response.json(await listCustomerOrders(userId, limit, offset), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return customerOrderErrorResponse(error); }
}
