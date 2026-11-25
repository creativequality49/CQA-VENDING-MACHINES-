import "server-only";
import { resolvePurchasedDigitalAsset } from "@/lib/cqa-marketplace-assets";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { getPublicSupabaseClient } from "@/lib/cqa-marketplace";
import { createSignedDownloadUrl } from "@/lib/storage";

/** Only a Supabase-verified bearer token may claim a marketplace purchase. */
export async function resolveMarketplaceDownload(token: string, orderId: string) {
  const { data: identity, error: identityError } = await getPublicSupabaseClient().auth.getUser(token);
  const user = identity?.user;
  if (identityError || !user?.id || !user.email || !user.email_confirmed_at || user.is_anonymous) return { status: 401 as const };
  const admin = getCqaSupabaseAdmin();
  const { data: order, error: orderError } = await admin.from("cqa_orders")
    .select("id,business_id,machine_id,offer_id,buyer_user_id,status,purchase_snapshot")
    .eq("id", orderId).maybeSingle();
  if (orderError) throw orderError;
  // Never distinguish another tenant's order from a nonexistent one.
  if (!order || order.status !== "paid" || order.buyer_user_id !== user.id ||
      !order.business_id || !order.machine_id || !order.offer_id) return { status: 404 as const };
  const binding = resolvePurchasedDigitalAsset(order);
  if (binding === null) return { status: 409 as const };
  if (!binding) {
    const { data: offer, error: offerError } = await admin.from("cqa_offers")
      .select("id,business_id,machine_id,offer_type,fulfillment_type")
      .eq("id", order.offer_id).eq("business_id", order.business_id)
      .eq("machine_id", order.machine_id).maybeSingle();
    if (offerError) throw offerError;
    if (!offer || (offer.offer_type !== "digital_product" && offer.fulfillment_type !== "digital"))
      return { status: 404 as const };
    // The catalogue provides no historical attachment record for this purchase.
    return { status: 409 as const };
  }
  const signed = await createSignedDownloadUrl(binding.key);
  // A refund/dispute may arrive while resolving the private asset. Do not hand
  // out a newly prepared URL after that entitlement has become terminal.
  const { data: current, error: currentError } = await admin.from("cqa_orders")
    .select("id").eq("id", order.id).eq("buyer_user_id", user.id).eq("status", "paid").maybeSingle();
  if (currentError) throw currentError;
  if (!current) return { status: 404 as const };
  return { status: 200 as const, url: signed.url, expiresIn: signed.expiresIn };
}
