import "server-only";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { getPublicSupabaseClient } from "@/lib/cqa-marketplace";
import { createSignedDownloadUrl } from "@/lib/storage";

/** Only a Supabase-verified bearer token may claim a marketplace purchase. */
export async function resolveMarketplaceDownload(token: string, orderId: string) {
  const { data: identity, error: identityError } = await getPublicSupabaseClient().auth.getUser(token);
  const user = identity?.user;
  if (identityError || !user?.id || !user.email || !user.email_confirmed_at) return { status: 401 as const };
  const admin = getCqaSupabaseAdmin();
  const { data: order, error: orderError } = await admin.from("cqa_orders")
    .select("id,business_id,machine_id,offer_id,buyer_user_id,status")
    .eq("id", orderId).maybeSingle();
  if (orderError) throw orderError;
  // Never distinguish another tenant's order from a nonexistent one.
  if (!order || order.status !== "paid" || order.buyer_user_id !== user.id ||
      !order.business_id || !order.machine_id || !order.offer_id) return { status: 404 as const };
  const { data: offer, error: offerError } = await admin.from("cqa_offers")
    .select("id,business_id,machine_id,offer_type,fulfillment_type,fulfillment_config")
    .eq("id", order.offer_id).eq("business_id", order.business_id)
    .eq("machine_id", order.machine_id).maybeSingle();
  if (offerError) throw offerError;
  if (!offer || (offer.offer_type !== "digital_product" && offer.fulfillment_type !== "digital"))
    return { status: 404 as const };
  const config = offer.fulfillment_config;
  const assetKey = config && typeof config === "object" && !Array.isArray(config) &&
    typeof config.asset_key === "string" ? config.asset_key : "";
  // Tenant-scoped private R2 keys; reject traversal, URL keys and public media.
  const prefix = `marketplace/${order.business_id}/${offer.id}/`;
  if (!assetKey.startsWith(prefix) || assetKey.length <= prefix.length ||
      assetKey.includes("..") || assetKey.includes("\\") || /[?#]/.test(assetKey))
    return { status: 409 as const };
  const signed = await createSignedDownloadUrl(assetKey);
  return { status: 200 as const, url: signed.url, expiresIn: signed.expiresIn };
}
