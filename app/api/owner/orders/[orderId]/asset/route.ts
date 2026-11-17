import { NextResponse } from "next/server";
import { requireCqaOwner } from "@/lib/cqa-owner-auth";
import { MAX_MARKETPLACE_ASSET_BYTES, MARKETPLACE_ASSET_EXTENSIONS, MarketplaceUploadError, readMarketplaceUploadForm, validateMarketplaceAsset } from "@/lib/cqa-marketplace-assets";
import { uploadPrivateMarketplaceAsset } from "@/lib/storage";
import { ownerOrder, ownerOrderHeaders, orderFailure, presentOwnerOrder, requestBusinessId, requireManualOrder, safeOwnerOrderError, updateOwnerOrder } from "@/lib/cqa-owner-orders";

export const runtime = "nodejs";

export async function POST(request: Request, route: { params: Promise<{ orderId: string }> }) {
  try {
    const context = await requireCqaOwner(request, requestBusinessId(request));
    const { orderId } = await route.params;
    const order = await ownerOrder(context, orderId);
    if (order.status !== "paid") orderFailure(409, "Only paid orders can receive a delivery file.");
    await requireManualOrder(context, order);
    const form = await readMarketplaceUploadForm(request);
    const revisionValue = form.get("expectedRevision");
    const revision = typeof revisionValue === "string" && /^\d+$/.test(revisionValue) ? Number(revisionValue) : NaN;
    if (!Number.isSafeInteger(revision) || revision < 0 || revision > 2147483647) orderFailure(400, "Refresh the order before uploading.");
    const { data: workspace, error: workspaceError } = await context.admin.from("cqa_order_workspaces")
      .select("revision,state").eq("order_id", orderId).eq("business_id", context.business.id).maybeSingle();
    if (workspaceError) throw workspaceError;
    if (!workspace || workspace.state !== "in_progress" || workspace.revision !== revision)
      orderFailure(409, "Start work on the current order revision before uploading a delivery file.");
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) orderFailure(400, "Choose a delivery file.");
    if (file.size > MAX_MARKETPLACE_ASSET_BYTES) orderFailure(413, "The file must be 4 MB or smaller.");
    const contentType = file.type === "application/x-zip-compressed" ? "application/zip" : file.type === "image/jpg" ? "image/jpeg" : file.type;
    if (!MARKETPLACE_ASSET_EXTENSIONS[contentType]) orderFailure(400, "Choose a PDF, ZIP, PNG, JPG or UTF-8 TXT file.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validateMarketplaceAsset(bytes, contentType)) orderFailure(400, "The file contents do not match the selected file type.");
    const name = file.name.replace(/[\\/\x00-\x1f\x7f]/g, "_").slice(0, 180) || `delivery.${MARKETPLACE_ASSET_EXTENSIONS[contentType]}`;
    const key = `fulfillment/${context.business.id}/${orderId}/${crypto.randomUUID()}.${MARKETPLACE_ASSET_EXTENSIONS[contentType]}`;
    await uploadPrivateMarketplaceAsset(key, bytes, contentType);
    await updateOwnerOrder(context, orderId, "attach_asset", { asset_key: key, asset_name: name, asset_size: bytes.length, asset_type: contentType }, revision);
    return NextResponse.json({ uploaded: true, order: await presentOwnerOrder(context, await ownerOrder(context, orderId)) }, { headers: ownerOrderHeaders });
  } catch (failure) {
    const result = failure instanceof MarketplaceUploadError ? { status: failure.status, error: failure.message } : safeOwnerOrderError(failure);
    return NextResponse.json({ error: result.error }, { status: result.status, headers: ownerOrderHeaders });
  }
}
