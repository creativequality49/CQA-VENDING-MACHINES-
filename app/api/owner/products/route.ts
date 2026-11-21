import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPrivateMarketplaceAsset } from "@/lib/storage";
import { requireCqaOwner } from "@/lib/cqa-owner-auth";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { requireVerifiedOrderOwner, requestBusinessId } from "@/lib/cqa-owner-orders";
import { isPrivateProductAssetReady, ownerProductHeaders, ownerProductSchema, productSaveFailure, readOwnerProductBody } from "@/lib/cqa-owner-products";

export const runtime = "nodejs";
const fields = "id,business_id,machine_id,name,description,price_cents,currency,offer_type,fulfillment_type,image_url,active,inventory_tracking,inventory_quantity,product_revision,fulfillment_config";

function presentationProduct(row: Record<string, unknown>) {
  const raw = row.fulfillment_config;
  const config = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const terms: Record<string, unknown> = {};
  for (const key of ["deliveryDescription", "deliveryTiming", "supportDetails", "refundTerms"])
    terms[key] = typeof config[key] === "string" ? config[key] : "";
  const rawShipping = config.shipping;
  if (rawShipping && typeof rawShipping === "object" && !Array.isArray(rawShipping)) {
    const shipping = rawShipping as Record<string, unknown>;
    terms.shipping = {
      supportedRegions: Array.isArray(shipping.supportedRegions) ? shipping.supportedRegions.filter(v => typeof v === "string" && /^[A-Z]{2}$/.test(v)) : [],
      flatFeeCents: Number.isSafeInteger(shipping.flatFeeCents) ? shipping.flatFeeCents : 0,
      dispatchTiming: typeof shipping.dispatchTiming === "string" ? shipping.dispatchTiming : ""
    };
  }
  return { ...row, fulfillment_config: terms, assetReady: isPrivateProductAssetReady(String(row.business_id), String(row.id), raw) };
}

function errorResponse(failure: unknown) {
  const status = failure && typeof failure === "object" && "status" in failure ? Number(failure.status) : 503;
  const known = [400, 401, 403, 404, 409, 413].includes(status) && failure instanceof Error;
  return NextResponse.json({ error: known ? failure.message : "Products are unavailable. No change was confirmed; refresh before retrying." },
    { status: known ? status : 503, headers: ownerProductHeaders });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") || "0");
    const limit = Number(url.searchParams.get("limit") || "50");
    if (!Number.isSafeInteger(page) || page < 0 || page > 10000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      productSaveFailure(400, "Choose a valid product page (up to 100 products).");
    const context = await requireCqaOwner(request, requestBusinessId(request));
    requireVerifiedOrderOwner(context);
    const [products, machines] = await Promise.all([
      context.admin.from("cqa_offers").select(fields).eq("business_id", context.business.id)
        .in("offer_type", ["digital_product", "physical_product"])
        .order("created_at", { ascending: false }).order("id", { ascending: false }).range(page * limit, page * limit + limit),
      context.admin.from("cqa_machines").select("id,title").eq("business_id", context.business.id).order("created_at").limit(100)
    ]);
    if (products.error || machines.error) throw products.error || machines.error;
    const visible = (products.data || []).slice(0, limit);
    const inventory = visible.length ? await getCqaSupabaseAdmin().rpc("cqa_owner_product_inventory", {
      p_business_id: context.business.id, p_actor_user_id: context.user.id, p_offer_ids: visible.map(row => row.id)
    }) : { data: { inventory: [] }, error: null };
    if (inventory.error) throw inventory.error;
    const summary = z.object({ inventory: z.array(z.object({ offer_id: z.string().uuid(), reserved_quantity: z.number().int().nonnegative(),
      available_quantity: z.number().int().nonnegative().nullable() })) }).safeParse(inventory.data);
    if (!summary.success || summary.data.inventory.length !== visible.length || new Set(summary.data.inventory.map(row => row.offer_id)).size !== visible.length)
      throw new Error("Inventory read not confirmed");
    const held = new Map(summary.data.inventory.map(row => [row.offer_id, row]));
    if (visible.some(row => !held.has(row.id))) throw new Error("Inventory binding not confirmed");
    return NextResponse.json({ business: { id: context.business.id, name: context.business.name },
      machines: (machines.data || []).map(machine => ({ id: machine.id, name: machine.title || "Storefront" })),
      products: visible.map(row => ({ ...presentationProduct(row),
        reserved_quantity: held.get(row.id)!.reserved_quantity, available_quantity: held.get(row.id)!.available_quantity })), page, hasMore: (products.data || []).length > limit
    }, { headers: ownerProductHeaders });
  } catch (failure) { return errorResponse(failure); }
}

export async function POST(request: Request) {
  try {
    const parsed = ownerProductSchema.safeParse(await readOwnerProductBody(request));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Check the product form.",
      fields: parsed.error.issues.map(issue => ({ field: issue.path.join("."), message: issue.message })) }, { status: 400, headers: ownerProductHeaders });
    const input = parsed.data;
    const context = await requireCqaOwner(request, input.businessId);
    requireVerifiedOrderOwner(context);
    const { data: machine, error: machineError } = await context.admin.from("cqa_machines").select("id")
      .eq("id", input.machineId).eq("business_id", context.business.id).maybeSingle();
    if (machineError) throw machineError;
    if (!machine) productSaveFailure(404, "Choose a storefront in this business.");
    if (input.id) {
      const { data: existing, error } = await context.admin.from("cqa_offers")
        .select("id,offer_type,machine_id,fulfillment_config,product_revision")
        .eq("id", input.id).eq("business_id", context.business.id).eq("machine_id", input.machineId).maybeSingle();
      if (error) throw error;
      if (!existing) productSaveFailure(404, "Product not found in this storefront.");
      if (existing.offer_type !== (input.kind === "physical" ? "physical_product" : "digital_product"))
        productSaveFailure(409, "Create a new product to change between digital and physical fulfilment.");
      if (existing.product_revision !== input.expectedRevision) productSaveFailure(409, "This product changed. Refresh before saving again.");
      if (input.active && input.kind === "digital") {
        if (!isPrivateProductAssetReady(context.business.id, input.id, existing.fulfillment_config))
          productSaveFailure(409, "Attach a supported private product file before publishing this digital product.");
        const asset = existing.fulfillment_config as Record<string, unknown>;
        if (!await verifyPrivateMarketplaceAsset(String(asset.asset_key), Number(asset.asset_size_bytes), String(asset.asset_content_type)))
          productSaveFailure(409, "The private product file could not be verified. Check the upload before publishing.");
      }
    } else if (input.active && input.kind === "digital") {
      productSaveFailure(409, "Save a draft, attach the private file, then publish the digital product.");
    }
    // Stock and revision changes happen together under a database offer lock. Client
    // stock totals and asset keys are never accepted; SQL preserves existing assets.
    const { data, error } = await getCqaSupabaseAdmin().rpc("cqa_owner_save_product", {
      p_business_id: context.business.id, p_machine_id: input.machineId, p_actor_user_id: context.user.id,
      p_offer_id: input.id || null, p_expected_revision: input.expectedRevision ?? null,
      p_inventory_delta: input.inventoryDelta,
      p_product: { name: input.name, description: input.description, price_cents: input.priceCents, currency: input.currency,
        offer_type: input.kind === "physical" ? "physical_product" : "digital_product",
        fulfillment_type: input.kind === "physical" ? "shipping" : "digital", shipping_required: input.kind === "physical",
        inventory_tracking: input.kind === "physical", image_url: input.imageUrl, active: input.active,
        fulfillment_config: { ...(input.kind === "physical" ? { provider: "merchant" } : {}), deliveryDescription: input.deliveryDescription, deliveryTiming: input.deliveryTiming,
          supportDetails: input.supportDetails, refundTerms: input.refundTerms, ...(input.shipping ? { shipping: input.shipping } : {}) } }
    });
    if (error) {
      // Never expose provider SQL details or treat a failed RPC as a saved product.
      if (["40001", "23514", "P0001"].includes(error.code)) productSaveFailure(409, "The product changed or stock is reserved. Refresh and check stock before saving.");
      if (error.code === "42501") productSaveFailure(403, "This account cannot change that product.");
      throw error;
    }
    const confirmed = z.object({ product: z.object({ id: z.string().uuid(), business_id: z.string().uuid(), machine_id: z.string().uuid(),
      product_revision: z.number().int().positive(), offer_type: z.string(), fulfillment_type: z.string(),
      inventory_tracking: z.boolean(), inventory_quantity: z.number().int().nonnegative().nullable(),
      name: z.string(), price_cents: z.number().int(), currency: z.literal("aud"), active: z.boolean()
    }).passthrough(), reserved_quantity: z.number().int().nonnegative(), available_quantity: z.number().int().nonnegative().nullable() }).safeParse(data);
    if (!confirmed.success || confirmed.data.product.business_id !== context.business.id || confirmed.data.product.machine_id !== input.machineId ||
        (input.id && confirmed.data.product.id !== input.id) || confirmed.data.product.product_revision !== (input.expectedRevision ?? 0) + 1 ||
        confirmed.data.product.offer_type !== (input.kind === "physical" ? "physical_product" : "digital_product") ||
        confirmed.data.product.fulfillment_type !== (input.kind === "physical" ? "shipping" : "digital") ||
        confirmed.data.product.name !== input.name || confirmed.data.product.price_cents !== input.priceCents || confirmed.data.product.active !== input.active ||
        confirmed.data.product.inventory_tracking !== (input.kind === "physical") ||
        (input.kind === "physical" && (confirmed.data.product.inventory_quantity === null || confirmed.data.available_quantity !== confirmed.data.product.inventory_quantity - confirmed.data.reserved_quantity)) ||
        (input.kind === "digital" && (confirmed.data.product.inventory_quantity !== null || confirmed.data.available_quantity !== null || confirmed.data.reserved_quantity !== 0)))
      throw new Error("Product save not confirmed");
    return NextResponse.json({ product: { ...presentationProduct(data.product), reserved_quantity: data.reserved_quantity, available_quantity: data.available_quantity } }, { status: input.id ? 200 : 201, headers: ownerProductHeaders });
  } catch (failure) { return errorResponse(failure); }
}
