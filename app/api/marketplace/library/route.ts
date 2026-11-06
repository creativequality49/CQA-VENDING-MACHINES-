import { NextResponse } from "next/server";
import { getPublicSupabaseClient } from "@/lib/cqa-marketplace";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";

export const runtime = "nodejs";

const ORDER_PAGE_SIZE = 500;

export async function GET(req: Request) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") || "");
  if (!match) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data, error } = await getPublicSupabaseClient().auth.getUser(match[1]);
  const user = data?.user;
  if (error || !user?.id || !user.email || !user.email_confirmed_at)
    return NextResponse.json({ error: "Verified account required" }, { status: 401 });
  try {
    const admin = getCqaSupabaseAdmin();
    const products = [];
    for (let offset = 0; ; offset += ORDER_PAGE_SIZE) {
      const { data: orders, error: ordersError } = await admin.from("cqa_orders")
        .select("id,business_id,machine_id,offer_id,status,buyer_user_id,created_at")
        .eq("status", "paid").eq("buyer_user_id", user.id)
        .order("created_at", { ascending: false }).order("id", { ascending: false })
        .range(offset, offset + ORDER_PAGE_SIZE - 1);
      if (ordersError) throw ordersError;
      if (!orders?.length) break;

      const validOrders = orders.filter(order => order.business_id && order.machine_id && order.offer_id);
      const offerIds = [...new Set(validOrders.map(order => order.offer_id))];
      const offersById = new Map();
      if (offerIds.length) {
        const { data: offers, error: offerError } = await admin.from("cqa_offers")
          .select("id,business_id,machine_id,name,offer_type,fulfillment_type,fulfillment_config")
          .in("id", offerIds);
        if (offerError) throw offerError;
        for (const offer of offers || []) offersById.set(offer.id, offer);
      }

      for (const order of validOrders) {
        const offer = offersById.get(order.offer_id);
        if (!offer || offer.business_id !== order.business_id || offer.machine_id !== order.machine_id) continue;
        if (offer.offer_type !== "digital_product" && offer.fulfillment_type !== "digital") continue;
        const key = offer.fulfillment_config?.asset_key;
        const prefix = `marketplace/${order.business_id}/${offer.id}/`;
        products.push({ orderId: order.id, title: offer.name,
          downloadable: typeof key === "string" && key.startsWith(prefix) &&
            key.length > prefix.length && !key.includes("..") && !key.includes("\\") && !/[?#]/.test(key) });
      }

      if (orders.length < ORDER_PAGE_SIZE) break;
    }
    return NextResponse.json({ products }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Library unavailable" }, { status: 503 });
  }
}
