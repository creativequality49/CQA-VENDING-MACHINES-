import { NextResponse } from "next/server";
import { getPublicSupabaseClient } from "@/lib/cqa-marketplace";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";

export const runtime = "nodejs";
export async function GET(req: Request) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") || "");
  if (!match) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data, error } = await getPublicSupabaseClient().auth.getUser(match[1]);
  const user = data?.user;
  if (error || !user?.id || !user.email || !user.email_confirmed_at)
    return NextResponse.json({ error: "Verified account required" }, { status: 401 });
  try {
    const admin = getCqaSupabaseAdmin();
    const { data: orders, error: ordersError } = await admin.from("cqa_orders")
      .select("id,business_id,machine_id,offer_id,status,buyer_user_id,created_at")
      .eq("status", "paid").eq("buyer_user_id", user.id)
      .order("created_at", { ascending: false }).limit(100);
    if (ordersError) throw ordersError;
    const products = [];
    for (const order of orders || []) {
      if (!order.business_id || !order.machine_id || !order.offer_id) continue;
      const { data: offer, error: offerError } = await admin.from("cqa_offers")
        .select("id,name,offer_type,fulfillment_type,fulfillment_config")
        .eq("id", order.offer_id).eq("business_id", order.business_id)
        .eq("machine_id", order.machine_id).maybeSingle();
      if (offerError) throw offerError;
      if (!offer || (offer.offer_type !== "digital_product" && offer.fulfillment_type !== "digital")) continue;
      const key = offer.fulfillment_config?.asset_key;
      const prefix = `marketplace/${order.business_id}/${offer.id}/`;
      products.push({ orderId: order.id, title: offer.name,
        downloadable: typeof key === "string" && key.startsWith(prefix) &&
          key.length > prefix.length && !key.includes("..") && !key.includes("\\") && !/[?#]/.test(key) });
    }
    return NextResponse.json({ products }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Library unavailable" }, { status: 503 });
  }
}
