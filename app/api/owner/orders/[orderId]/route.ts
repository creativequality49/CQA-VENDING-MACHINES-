import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCqaOwner } from "@/lib/cqa-owner-auth";
import { ownerOrder, ownerOrderHeaders, orderFailure, presentOwnerOrder, requestBusinessId, requireManualOrder, safeOwnerOrderError, updateOwnerOrder } from "@/lib/cqa-owner-orders";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ orderId: string }> };
const actionSchema = z.object({ action: z.enum(["start", "deliver"]), expectedRevision: z.number().int().min(0).max(2147483647),
  message: z.string().trim().max(10000).optional() }).strict();

export async function GET(request: Request, route: RouteContext) {
  try {
    const context = await requireCqaOwner(request, requestBusinessId(request));
    const { orderId } = await route.params;
    const order = await ownerOrder(context, orderId);
    const { data: events, error } = await context.admin.from("cqa_order_events")
      .select("id,actor_role,kind,message,created_at").eq("order_id", orderId)
      .order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ order: await presentOwnerOrder(context, order), events: events || [] }, { headers: ownerOrderHeaders });
  } catch (failure) {
    const result = safeOwnerOrderError(failure);
    return NextResponse.json({ error: result.error }, { status: result.status, headers: ownerOrderHeaders });
  }
}

export async function POST(request: Request, route: RouteContext) {
  try {
    const context = await requireCqaOwner(request, requestBusinessId(request));
    const body = actionSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) orderFailure(400, "Choose an action and refresh the order before trying again.");
    const { orderId } = await route.params;
    const order = await ownerOrder(context, orderId);
    if (order.status !== "paid") orderFailure(409, "Only paid orders can be fulfilled.");
    await requireManualOrder(context, order);
    await updateOwnerOrder(context, orderId, body.data.action, { message: body.data.message || "" }, body.data.expectedRevision);
    return NextResponse.json({ updated: true, order: await presentOwnerOrder(context, await ownerOrder(context, orderId)) }, { headers: ownerOrderHeaders });
  } catch (failure) {
    const result = safeOwnerOrderError(failure);
    return NextResponse.json({ error: result.error }, { status: result.status, headers: ownerOrderHeaders });
  }
}
