import "server-only";
import { requireCqaOwner } from "@/lib/cqa-owner-auth";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { z } from "zod";

export const ownerOrderHeaders = { "Cache-Control": "private, no-store" };
export const orderIdSchema = z.string().uuid();
export const orderFields = "id,business_id,machine_id,offer_id,customer_email,status,amount_cents,currency,created_at,purchase_snapshot";
export const workspaceFields = "order_id,business_id,state,intake,delivery_message,asset_key,asset_name,revision,updated_at";
export type OwnerContext = Awaited<ReturnType<typeof requireCqaOwner>>;
function purchaseSnapshot(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as Record<string, unknown>;
  const offerTypes = ["service", "booking", "physical_product", "digital_product", "subscription", "quote", "consultation"];
  const fulfillmentTypes = ["none", "digital", "shipping", "booking", "service", "subscription", "external"];
  if (typeof snapshot.title !== "string" || !snapshot.title.trim() || snapshot.title.length > 300 ||
      typeof snapshot.offerType !== "string" || !offerTypes.includes(snapshot.offerType) ||
      !(snapshot.fulfillmentType === null || (typeof snapshot.fulfillmentType === "string" && fulfillmentTypes.includes(snapshot.fulfillmentType)))) return null;
  return { supplierShipped: snapshot.fulfilmentType === "supplier_shipped", title: snapshot.title.trim(), offerType: snapshot.offerType, fulfillmentType: snapshot.fulfillmentType as string | null,
    terms: Object.fromEntries(["deliveryDescription", "deliveryTiming", "supportDetails", "refundTerms"].flatMap(key => {
      const terms = snapshot.terms && typeof snapshot.terms === "object" && !Array.isArray(snapshot.terms) ? snapshot.terms as Record<string, unknown> : {};
      const value = terms[key]; return typeof value === "string" && value.length <= 5000 ? [[key, value]] : [];
    })) };
}

export function orderFailure(status: number, message: string): never {
  throw Object.assign(new Error(message), { status });
}

/** The service RPC receives only an identity already verified by Supabase Auth. */
export function requireVerifiedOrderOwner(context: OwnerContext) {
  if (!context.user.email_confirmed_at || !context.user.email?.trim() || context.user.is_anonymous)
    orderFailure(401, "A verified, non-anonymous owner account is required.");
}

export function requestBusinessId(request: Request) {
  const value = new URL(request.url).searchParams.get("businessId");
  if (value && !orderIdSchema.safeParse(value).success) orderFailure(400, "Choose a valid business.");
  return value || undefined;
}

export function safeOwnerOrderError(failure: unknown) {
  const status = typeof failure === "object" && failure !== null && "status" in failure ? Number(failure.status) : 503;
  const allowed = [400, 401, 403, 404, 409, 413];
  if (allowed.includes(status) && failure instanceof Error) return { status, error: failure.message };
  return { status: 503, error: "Orders are unavailable. No change was confirmed; refresh before trying again." };
}

export async function ownerOrder(context: OwnerContext, orderId: string) {
  requireVerifiedOrderOwner(context);
  if (!orderIdSchema.safeParse(orderId).success) orderFailure(400, "Choose a valid order.");
  const { data, error } = await context.admin.from("cqa_orders").select(orderFields)
    .eq("id", orderId).eq("business_id", context.business.id).maybeSingle();
  if (error) throw error;
  if (!data) orderFailure(404, "Order not found in this business.");
  return data;
}

export async function presentOwnerOrders(context: OwnerContext, orders: Record<string, unknown>[]) {
  if (!orders.length) return [];
  const [offerResult, machineResult, workspaceResult] = await Promise.all([
    context.admin.from("cqa_offers").select("id,name,machine_id,offer_type,fulfillment_type").eq("business_id", context.business.id)
      .in("id", [...new Set(orders.map(order => String(order.offer_id)))]),
    context.admin.from("cqa_machines").select("id").eq("business_id", context.business.id)
      .in("id", [...new Set(orders.map(order => String(order.machine_id)))]),
    context.admin.from("cqa_order_workspaces").select(workspaceFields).eq("business_id", context.business.id)
      .in("order_id", orders.map(order => String(order.id)))
  ]);
  if (offerResult.error || machineResult.error || workspaceResult.error)
    throw offerResult.error || machineResult.error || workspaceResult.error;
  return orders.map(order => {
    const offer = offerResult.data?.find(row => row.id === order.offer_id && row.machine_id === order.machine_id);
    const machine = machineResult.data?.find(row => row.id === order.machine_id);
    const workspace = workspaceResult.data?.find(row => row.order_id === order.id);
    const snapshot = purchaseSnapshot(order.purchase_snapshot);
    const offerType = snapshot ? snapshot.offerType : offer && machine ? offer.offer_type : null;
    const fulfillmentType = snapshot ? snapshot.fulfillmentType : offer && machine ? offer.fulfillment_type : null;
    const digital = offerType === "digital_product" || fulfillmentType === "digital";
    return {
      id: order.id, status: order.status, amountCents: order.amount_cents, currency: order.currency,
      createdAt: order.created_at, customerEmail: order.customer_email,
      offerName: snapshot?.title || (offer && machine ? offer.name : "Offer unavailable"),
      digital, offerType, fulfillmentType, supplierShipped: snapshot?.supplierShipped ?? false, purchaseTerms: snapshot?.terms || {},
      workspace: {
        state: workspace?.state || "awaiting_intake", revision: workspace?.revision ?? 0,
        intake: workspace?.intake && typeof workspace.intake === "object" && !Array.isArray(workspace.intake) ? workspace.intake : {},
        deliveryMessage: workspace?.delivery_message || "", hasAsset: Boolean(workspace?.asset_key),
        assetName: workspace?.asset_name || null, updatedAt: workspace?.updated_at || null
      }
    };
  });
}

export async function requireManualOrder(context: OwnerContext, order: Record<string, unknown>) {
  const { data: offer, error } = await context.admin.from("cqa_offers")
    .select("id,offer_type,fulfillment_type").eq("id", order.offer_id)
    .eq("business_id", context.business.id).eq("machine_id", order.machine_id).maybeSingle();
  if (error) throw error;
  if (!offer) orderFailure(404, "Order offer not found in this business.");
  const snapshot = purchaseSnapshot(order.purchase_snapshot);
  if ((snapshot ? snapshot.offerType : offer.offer_type) === "digital_product" || (snapshot ? snapshot.fulfillmentType : offer.fulfillment_type) === "digital")
    orderFailure(409, "Digital purchases use protected library delivery, not service fulfilment.");
}

export async function presentOwnerOrder(context: OwnerContext, order: Record<string, unknown>) {
  return (await presentOwnerOrders(context, [order]))[0];
}

export async function updateOwnerOrder(context: OwnerContext, orderId: string, action: string, payload: Record<string, unknown>, revision: number) {
  requireVerifiedOrderOwner(context);
  const { data, error } = await getCqaSupabaseAdmin().rpc("cqa_update_order_workspace", {
    p_order_id: orderId, p_actor_user_id: context.user.id, p_action: action,
    p_payload: payload, p_expected_revision: revision
  });
  if (error) {
    if (error.code === "42501") orderFailure(403, "You cannot update this order.");
    if (error.code === "P0002") orderFailure(404, "Order not found in this business.");
    if (["40001", "23514", "P0001"].includes(error.code)) orderFailure(409, "The order changed or is no longer eligible. Refresh before trying again.");
    throw error;
  }
  const workspace = data && typeof data === "object" && !Array.isArray(data) ? data.workspace : null;
  if (!workspace || typeof workspace !== "object" || workspace.order_id !== orderId || workspace.business_id !== context.business.id ||
      !Number.isSafeInteger(workspace.revision) || workspace.revision !== revision + 1 ||
      workspace.state !== (action === "deliver" ? "delivered" : "in_progress"))
    orderFailure(409, "The change was not confirmed. Refresh the order before trying again.");
}
