import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicSupabaseClient } from "@/lib/cqa-marketplace";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { uploadPrivateMarketplaceAsset } from "@/lib/storage";

export const runtime = "nodejs";
const uuid = z.string().uuid();
const MAX_BYTES = 15 * 1024 * 1024;
const allowed = new Set(["application/pdf", "application/zip", "image/png", "image/jpeg", "text/plain"]);
const extensions: Record<string,string> = {
  "application/pdf": "pdf", "application/zip": "zip",
  "image/png": "png", "image/jpeg": "jpg", "text/plain": "txt"
};
export async function POST(req: Request) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") || "");
  if (!match) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { data, error } = await getPublicSupabaseClient().auth.getUser(match[1]);
  if (error || !data.user?.id || !data.user.email_confirmed_at)
    return NextResponse.json({ error: "Verified owner account required" }, { status: 401 });
  const ownerId = data.user.id;
  try {
    const form = await req.formData();
    const offerId = form.get("offerId");
    const file = form.get("file");
    if (typeof offerId !== "string" || !uuid.safeParse(offerId).success || !(file instanceof File))
      return NextResponse.json({ error: "Invalid offer or file" }, { status: 400 });
    if (!file.size || file.size > MAX_BYTES || !allowed.has(file.type))
      return NextResponse.json({ error: "Unsupported file type or size (15 MB maximum)" }, { status: 400 });
    const admin = getCqaSupabaseAdmin();
    const { data: offer, error: offerError } = await admin.from("cqa_offers")
      .select("id,business_id,machine_id,offer_type,fulfillment_type,fulfillment_config")
      .eq("id", offerId).maybeSingle();
    if (offerError) throw offerError;
    if (!offer || (offer.offer_type !== "digital_product" && offer.fulfillment_type !== "digital"))
      return NextResponse.json({ error: "Digital offer not found" }, { status: 404 });
    const { data: business, error: ownerError } = await admin.from("cqa_businesses")
      .select("id").eq("id", offer.business_id).eq("owner_id", ownerId).maybeSingle();
    if (ownerError) throw ownerError;
    if (!business) return NextResponse.json({ error: "Digital offer not found" }, { status: 404 });
    const { data: machine, error: machineError } = await admin.from("cqa_machines")
      .select("id").eq("id", offer.machine_id).eq("business_id", business.id).maybeSingle();
    if (machineError) throw machineError;
    if (!machine) return NextResponse.json({ error: "Digital offer not found" }, { status: 404 });
    // A product with existing paid orders must not silently change its delivered file.
    const { data: paidOrders, error: paidError } = await admin.from("cqa_orders")
      .select("id").eq("offer_id", offer.id).eq("business_id", business.id)
      .eq("status", "paid").limit(1);
    if (paidError) throw paidError;
    if (paidOrders?.length) return NextResponse.json({
      error: "This offer has paid orders. Create a new offer to publish a replacement file."
    }, { status: 409 });
    const key = `marketplace/${business.id}/${offer.id}/${crypto.randomUUID()}.${extensions[file.type]}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    await uploadPrivateMarketplaceAsset(key, bytes, file.type);
    const previous = offer.fulfillment_config && typeof offer.fulfillment_config === "object" &&
      !Array.isArray(offer.fulfillment_config) ? offer.fulfillment_config : {};
    const { data: updated, error: updateError } = await admin.from("cqa_offers")
      .update({ fulfillment_config: { ...previous, asset_key: key } })
      .eq("id", offer.id).eq("business_id", business.id)
      .select("id").maybeSingle();
    if (updateError || !updated) throw updateError || new Error("Offer update failed");
    return NextResponse.json({ uploaded: true, offerId: offer.id }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return NextResponse.json({ error: "Private upload unavailable" }, { status: 503 });
  }
}
