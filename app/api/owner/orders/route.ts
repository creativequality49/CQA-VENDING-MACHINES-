import { NextResponse } from "next/server";
import { requireCqaOwner } from "@/lib/cqa-owner-auth";
import { orderFields, ownerOrderHeaders, presentOwnerOrders, requestBusinessId, requireVerifiedOrderOwner, safeOwnerOrderError } from "@/lib/cqa-owner-orders";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") || "0");
    const limit = Number(url.searchParams.get("limit") || "20");
    if (!Number.isSafeInteger(page) || page < 0 || page > 10000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50)
      return NextResponse.json({ error: "Choose a valid order page (up to 50 orders)." }, { status: 400, headers: ownerOrderHeaders });
    const context = await requireCqaOwner(request, requestBusinessId(request));
    requireVerifiedOrderOwner(context);
    const { data, error } = await context.admin.from("cqa_orders").select(orderFields)
      .eq("business_id", context.business.id).order("created_at", { ascending: false })
      .order("id", { ascending: false }).range(page * limit, page * limit + limit);
    if (error) throw error;
    const rows = data || [];
    const orders = await presentOwnerOrders(context, rows.slice(0, limit));
    return NextResponse.json({ business: { id: context.business.id, name: context.business.name }, orders,
      page, hasMore: rows.length > limit }, { headers: ownerOrderHeaders });
  } catch (failure) {
    const result = safeOwnerOrderError(failure);
    return NextResponse.json({ error: result.error }, { status: result.status, headers: ownerOrderHeaders });
  }
}
