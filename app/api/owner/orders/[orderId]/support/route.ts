import { handleOrderSupport } from "@/lib/cqa-order-support";
export const runtime = "nodejs";
type Context = { params: Promise<{ orderId: string }> };
export async function GET(request: Request, context: Context) {
  return handleOrderSupport(request, (await context.params).orderId, "owner");
}
export const POST = GET;
