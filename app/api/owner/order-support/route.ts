import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { requireCqaOwner } from "@/lib/cqa-owner-auth";
import { requestBusinessId, requireVerifiedOrderOwner, safeOwnerOrderError } from "@/lib/cqa-owner-orders";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  try {
    const rawPage = new URL(request.url).searchParams.get("page") || "0";
    const page = Number(rawPage);
    if (!/^\d+$/.test(rawPage) || !Number.isSafeInteger(page) || page > 10000)
      return Response.json({ error: "Choose a valid support page" }, { status: 400, headers });
    const context = await requireCqaOwner(request, requestBusinessId(request));
    requireVerifiedOrderOwner(context);
    const { data, error } = await getCqaSupabaseAdmin().from("cqa_order_support")
      .select("order_id,business_id,updated_at,revision").eq("business_id", context.business.id).eq("state", "waiting_owner")
      .order("updated_at", { ascending: true }).order("order_id", { ascending: true }).range(page * 20, page * 20 + 20);
    if (error) throw error;
    const rows = (data || []).slice(0, 20);
    if (rows.some(row => row.business_id !== context.business.id)) throw new Error("Support tenant mismatch");
    if (!rows.length) return Response.json({ threads: [], hasMore: false, page }, { headers });
    // Double-check order ownership using the owner's RLS client before returning inbox references.
    const { data: orders, error: orderError } = await context.admin.from("cqa_orders")
      .select("id,business_id,purchase_snapshot").eq("business_id", context.business.id).in("id", rows.map(row => row.order_id));
    if (orderError) throw orderError;
    const threads = rows.flatMap(row => {
      const order = orders?.find(order => order.id === row.order_id && order.business_id === context.business.id);
      if (!order) return [];
      const title = order.purchase_snapshot?.title;
      return [{ orderId: order.id, title: typeof title === "string" && title.length <= 300 ? title : "Customer order",
        updatedAt: row.updated_at, revision: row.revision }];
    });
    return Response.json({ threads, hasMore: (data || []).length > 20, page }, { headers });
  } catch (error) {
    const result = safeOwnerOrderError(error);
    return Response.json({ error: result.error }, { status: result.status, headers });
  }
}
