import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicSupabaseClient } from "@/lib/cqa-marketplace";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { uploadPrivateMarketplaceAsset } from "@/lib/storage";
import {
  MARKETPLACE_ASSET_EXTENSIONS, MAX_MARKETPLACE_ASSET_BYTES, MarketplaceUploadError,
  readMarketplaceUploadForm, validateMarketplaceAsset
} from "@/lib/cqa-marketplace-assets";

export const runtime = "nodejs";
const uuid = z.string().uuid();
const privateHeaders = { "Cache-Control": "private, no-store" };

async function verifiedOwner(req: Request) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") || "");
  if (!match) return null;
  const { data, error } = await getPublicSupabaseClient().auth.getUser(match[1]);
  return !error && data?.user?.id && data.user.email_confirmed_at ? data.user : null;
}

export async function GET(req: Request) {
  try {
    const owner = await verifiedOwner(req);
    if (!owner) return NextResponse.json({ error: "Verified owner account required" }, { status: 401, headers: privateHeaders });
    const admin = getCqaSupabaseAdmin();
    const { data: businesses, error: businessError } = await admin.from("cqa_businesses")
      .select("id").eq("owner_id", owner.id).limit(100);
    if (businessError) throw businessError;
    const ids = (businesses || []).map(business => business.id);
    if (!ids.length) return NextResponse.json({ offers: [] }, { headers: privateHeaders });
    const { data: offers, error: offerError } = await admin.from("cqa_offers")
      .select("id,name,offer_type,fulfillment_type,fulfillment_config")
      .in("business_id", ids).or("offer_type.eq.digital_product,fulfillment_type.eq.digital")
      .order("created_at", { ascending: false }).limit(200);
    if (offerError) throw offerError;
    return NextResponse.json({ offers: (offers || []).filter(offer =>
      offer.offer_type === "digital_product" || offer.fulfillment_type === "digital"
    ).map(offer => ({ id: offer.id, name: offer.name, hasFile: Boolean(offer.fulfillment_config?.asset_key) })) }, { headers: privateHeaders });
  } catch {
    return NextResponse.json({ error: "Your digital products could not be loaded. Try again." }, { status: 503, headers: privateHeaders });
  }
}

export async function POST(req: Request) {
  try {
    const owner = await verifiedOwner(req);
    if (!owner) return NextResponse.json({ error: "Verified owner account required" }, { status: 401, headers: privateHeaders });
    const form = await readMarketplaceUploadForm(req);
    const offerId = form.get("offerId");
    const file = form.get("file");
    if (typeof offerId !== "string" || !uuid.safeParse(offerId).success || !(file instanceof File))
      return NextResponse.json({ error: "Invalid offer or file" }, { status: 400 });
    if (file.size > MAX_MARKETPLACE_ASSET_BYTES)
      return NextResponse.json({ error: "The file must be 4 MB or smaller." }, { status: 413 });
    const contentType = file.type === "application/x-zip-compressed" ? "application/zip" : file.type === "image/jpg" ? "image/jpeg" : file.type;
    if (!file.size || !MARKETPLACE_ASSET_EXTENSIONS[contentType])
      return NextResponse.json({ error: "Choose a PDF, ZIP, PNG, JPG or UTF-8 TXT file." }, { status: 400 });
    const admin = getCqaSupabaseAdmin();
    const { data: offer, error: offerError } = await admin.from("cqa_offers")
      .select("id,business_id,machine_id,offer_type,fulfillment_type,fulfillment_config")
      .eq("id", offerId).maybeSingle();
    if (offerError) throw offerError;
    if (!offer || (offer.offer_type !== "digital_product" && offer.fulfillment_type !== "digital"))
      return NextResponse.json({ error: "Digital offer not found" }, { status: 404 });
    const { data: business, error: ownerError } = await admin.from("cqa_businesses")
      .select("id").eq("id", offer.business_id).eq("owner_id", owner.id).maybeSingle();
    if (ownerError) throw ownerError;
    if (!business) return NextResponse.json({ error: "Digital offer not found" }, { status: 404 });
    const { data: machine, error: machineError } = await admin.from("cqa_machines")
      .select("id").eq("id", offer.machine_id).eq("business_id", business.id).maybeSingle();
    if (machineError) throw machineError;
    if (!machine) return NextResponse.json({ error: "Digital offer not found" }, { status: 404 });
    const previous = offer.fulfillment_config && typeof offer.fulfillment_config === "object" &&
      !Array.isArray(offer.fulfillment_config) ? offer.fulfillment_config : {};
    if (previous.asset_key) return NextResponse.json({
      error: "A private file is already attached. Create a new digital offer for a different file."
    }, { status: 409 });
    // A product with existing paid orders must not silently change its delivered file.
    const { data: paidOrders, error: paidError } = await admin.from("cqa_orders")
      .select("id").eq("offer_id", offer.id).eq("business_id", business.id)
      .eq("status", "paid").limit(1);
    if (paidError) throw paidError;
    if (paidOrders?.length) return NextResponse.json({
      error: "This offer has paid orders. Create a new offer to publish a replacement file."
    }, { status: 409 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validateMarketplaceAsset(bytes, contentType))
      return NextResponse.json({ error: "The file contents do not match a supported product file." }, { status: 400 });
    const key = `marketplace/${business.id}/${offer.id}/${crypto.randomUUID()}.${MARKETPLACE_ASSET_EXTENSIONS[contentType]}`;
    await uploadPrivateMarketplaceAsset(key, bytes, contentType);
    let update = admin.from("cqa_offers")
      .update({ fulfillment_config: { ...previous, asset_key: key, asset_size_bytes: bytes.length, asset_content_type: contentType } })
      .eq("id", offer.id).eq("business_id", business.id).eq("machine_id", offer.machine_id);
    update = offer.fulfillment_config == null ? update.is("fulfillment_config", null) :
      update.eq("fulfillment_config", JSON.stringify(offer.fulfillment_config));
    const { data: updated, error: updateError } = await update.select("id").maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return NextResponse.json({ error: "The product changed during upload. Refresh before trying again." }, { status: 409, headers: privateHeaders });
    return NextResponse.json({ uploaded: true, offerId: offer.id }, {
      headers: privateHeaders
    });
  } catch (failure) {
    if (failure instanceof MarketplaceUploadError)
      return NextResponse.json({ error: failure.message }, { status: failure.status, headers: privateHeaders });
    return NextResponse.json({ error: "Private upload unavailable. No file attachment was confirmed; refresh before retrying." }, { status: 503, headers: privateHeaders });
  }
}
