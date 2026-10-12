import { NextResponse } from "next/server";
import { requireUserSession } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { getProductById } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let session;
  try { session = await requireUserSession(req); }
  catch { return NextResponse.json({ error: "Authentication required" }, { status: 401, headers: { "Cache-Control": "no-store" } }); }
  try {
    // Identity comes only from the verified session; ignore caller userId parameters.
    const { data, error } = await getSupabaseAdminClient().from("customer_entitlements")
      .select("product_id,source,expires_at")
      .eq("user_id", session.user.id).eq("status", "active")
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
    if (error) throw error;
    const products = [...new Set((data || []).map(row => row.product_id))].flatMap(id => {
      const product = getProductById(id);
      if (!product) return [];
      const grants = (data || []).filter(row => row.product_id === id);
      const expiresAt = grants.some(row => row.expires_at === null) ? null : grants.map(row => row.expires_at!).sort().at(-1)!;
      return [{ id: product.id, title: product.title, source: grants[0].source, expiresAt, downloadable: Boolean(product.assetKey.trim()) }];
    });
    return NextResponse.json({ products }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load your vault. Please try again." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
