import "server-only";
import { z } from "zod";
import { getPublicSupabaseClient } from "@/lib/cqa-marketplace";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { createSignedDownloadUrl } from "@/lib/storage";

type Admin = ReturnType<typeof getCqaSupabaseAdmin>;
type Row = Record<string, unknown>;
const orderColumns = "id,business_id,machine_id,offer_id,buyer_user_id,customer_user_id,status,amount_cents,currency,created_at,purchase_snapshot";
const workspaceColumns = "order_id,business_id,state,intake,delivery_message,asset_key,asset_name,revision,updated_at";
const idSchema = z.string().uuid();
const intakeSchema = z.object({
  businessName: z.string().trim().min(1).max(160),
  goals: z.string().trim().min(1).max(3000),
  details: z.string().trim().max(6000),
  expectedRevision: z.number().int().min(0).max(2147483647)
}).strict();

export class CustomerOrderError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function fail(status: number, message: string): never { throw new CustomerOrderError(status, message); }
function checkId(id: string) { if (!idSchema.safeParse(id).success) fail(400, "Invalid order reference"); }
function text(value: unknown) { return typeof value === "string" ? value : ""; }
function record(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {}; }
function purchaseSnapshot(value: unknown) {
  const snapshot = record(value);
  const offerTypes = ["service", "booking", "physical_product", "digital_product", "subscription", "quote", "consultation"];
  const fulfillmentTypes = ["none", "digital", "shipping", "booking", "service", "subscription", "external"];
  if (typeof snapshot.title !== "string" || !snapshot.title.trim() || snapshot.title.length > 300 ||
      typeof snapshot.offerType !== "string" || !offerTypes.includes(snapshot.offerType) ||
      !(snapshot.fulfillmentType === null || (typeof snapshot.fulfillmentType === "string" && fulfillmentTypes.includes(snapshot.fulfillmentType)))) return null;
  return { title: snapshot.title.trim(), offerType: snapshot.offerType, fulfillmentType: snapshot.fulfillmentType as string | null,
    terms: Object.fromEntries(["deliveryDescription", "deliveryTiming", "supportDetails", "refundTerms"].flatMap(key => {
      const terms = snapshot.terms && typeof snapshot.terms === "object" && !Array.isArray(snapshot.terms) ? snapshot.terms as Record<string, unknown> : {};
      const value = terms[key]; return typeof value === "string" && value.length <= 5000 ? [[key, value]] : [];
    })) };
}

/** Verify the bearer with Supabase; never infer ownership from a checkout reference or email. */
export async function requireCustomerOrderUser(request: Request): Promise<string> {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") || "");
  if (!match) fail(401, "Authentication required");
  const { data, error } = await getPublicSupabaseClient().auth.getUser(match[1]);
  const user = data?.user;
  if (error || !user?.id || !idSchema.safeParse(user.id).success || !user.email || !user.email_confirmed_at || user.is_anonymous)
    fail(401, "Verified account required");
  return user.id;
}

export function customerOrderPagination(url: string) {
  const params = new URL(url).searchParams;
  const rawLimit = params.get("limit") ?? "20";
  const rawCursor = params.get("cursor") ?? params.get("offset") ?? "0";
  if (!/^\d+$/.test(rawLimit) || !/^\d+$/.test(rawCursor)) fail(400, "Invalid pagination");
  const limit = Number(rawLimit), offset = Number(rawCursor);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50 || !Number.isSafeInteger(offset) || offset > 1000000)
    fail(400, "Invalid pagination");
  return { limit, offset };
}

async function ownedOrder(admin: Admin, userId: string, orderId: string): Promise<Row> {
  checkId(orderId);
  if (!idSchema.safeParse(userId).success) fail(401, "Verified account required");
  const { data, error } = await admin.from("cqa_orders").select(orderColumns)
    .eq("id", orderId).or(`customer_user_id.eq.${userId},buyer_user_id.eq.${userId}`).maybeSingle();
  if (error) throw error;
  if (!data || (data.customer_user_id || data.buyer_user_id) !== userId || !data.business_id || !data.machine_id || !data.offer_id)
    fail(404, "Order not found");
  return data;
}

/** Asset keys are never serialized; only a tenant/order-bound key can be signed. */
export function validCustomerDeliveryKey(key: unknown, businessId: string, orderId: string): key is string {
  const prefix = `fulfillment/${businessId}/${orderId}/`;
  return typeof key === "string" && key.startsWith(prefix) && key.length > prefix.length &&
    !key.includes("..") && !/[\\?#%\u0000-\u0020\u007f]/.test(key);
}

async function enrichOrders(admin: Admin, orders: Row[]) {
  if (!orders.length) return [];
  const businessIds = [...new Set(orders.map(order => text(order.business_id)))];
  const machineIds = [...new Set(orders.map(order => text(order.machine_id)))];
  const offerIds = [...new Set(orders.map(order => text(order.offer_id)))];
  const orderIds = orders.map(order => text(order.id));
  const [offerResult, businessResult, machineResult, workspaceResult] = await Promise.all([
    admin.from("cqa_offers").select("id,business_id,machine_id,name,offer_type,fulfillment_type").in("id", offerIds).in("business_id", businessIds),
    admin.from("cqa_businesses").select("id,name").in("id", businessIds),
    admin.from("cqa_machines").select("id,business_id,slug").in("id", machineIds).in("business_id", businessIds),
    admin.from("cqa_order_workspaces").select(workspaceColumns).in("order_id", orderIds).in("business_id", businessIds)
  ]);
  for (const result of [offerResult, businessResult, machineResult, workspaceResult]) if (result.error) throw result.error;
  const offers = new Map((offerResult.data || []).map(row => [row.id, row]));
  const businesses = new Map((businessResult.data || []).map(row => [row.id, row]));
  const machines = new Map((machineResult.data || []).map(row => [row.id, row]));
  const workspaces = new Map((workspaceResult.data || []).map(row => [row.order_id, row]));
  return orders.map(order => {
    const businessId = text(order.business_id), orderId = text(order.id);
    const offer = offers.get(order.offer_id), machine = machines.get(order.machine_id);
    const validOffer = offer?.business_id === businessId && offer?.machine_id === order.machine_id ? offer : null;
    const validMachine = machine?.business_id === businessId ? machine : null;
    const row = workspaces.get(order.id);
    const workspace = row?.business_id === businessId ? row : null;
    const snapshot = purchaseSnapshot(order.purchase_snapshot);
    const offerType = snapshot ? snapshot.offerType : validOffer?.offer_type || null;
    const fulfillmentType = snapshot ? snapshot.fulfillmentType : validOffer?.fulfillment_type || null;
    const intake = record(workspace?.intake);
    const canDeliver = order.status === "paid" && order.buyer_user_id === (order.customer_user_id || order.buyer_user_id);
    return {
      id: orderId, title: snapshot?.title || validOffer?.name || "Order", businessName: businesses.get(order.business_id)?.name || "Business",
      businessId, machineSlug: validMachine?.slug || null, offerType,
      fulfillmentType, purchaseTerms: snapshot?.terms || {}, paymentStatus: text(order.status),
      amountCents: typeof order.amount_cents === "number" ? order.amount_cents : 0,
      currency: text(order.currency) || "aud", createdAt: text(order.created_at),
      workspace: {
        state: workspace?.state || (offerType === "digital_product" || fulfillmentType === "digital" ? "delivered" : "awaiting_intake"),
        intake: { businessName: text(intake.businessName), goals: text(intake.goals), details: text(intake.details) },
        deliveryMessage: canDeliver ? text(workspace?.delivery_message) : "",
        hasAsset: canDeliver && workspace?.state === "delivered" && validCustomerDeliveryKey(workspace?.asset_key, businessId, orderId),
        assetName: canDeliver && workspace?.state === "delivered" ? text(workspace.asset_name) : "",
        revision: typeof workspace?.revision === "number" ? workspace.revision : 0,
        updatedAt: text(workspace?.updated_at) || text(order.created_at)
      },
      events: [] as { id: string; kind: string; message: string; createdAt: string }[]
    };
  });
}

export async function listCustomerOrders(userId: string, limit: number, offset: number) {
  if (!idSchema.safeParse(userId).success) fail(401, "Verified account required");
  const admin = getCqaSupabaseAdmin();
  const { data, error } = await admin.from("cqa_orders").select(orderColumns).or(`customer_user_id.eq.${userId},buyer_user_id.eq.${userId}`)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + limit);
  if (error) throw error;
  const page = (data || []).filter(row => (row.customer_user_id || row.buyer_user_id) === userId && row.business_id && row.machine_id && row.offer_id);
  const orders = await enrichOrders(admin, page.slice(0, limit));
  const hasMore = (data || []).length > limit;
  return { orders, hasMore, nextOffset: hasMore ? offset + limit : null, nextCursor: hasMore ? String(offset + limit) : null };
}

export async function getCustomerOrder(userId: string, orderId: string) {
  const admin = getCqaSupabaseAdmin();
  const order = await ownedOrder(admin, userId, orderId);
  const [safe] = await enrichOrders(admin, [order]);
  const { data, error } = await admin.from("cqa_order_events").select("id,kind,message,created_at")
    .eq("order_id", orderId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50);
  if (error) throw error;
  safe.events = (data || []).map(row => ({ id: text(row.id), kind: text(row.kind), message: text(row.message), createdAt: text(row.created_at) })).reverse();
  return safe;
}

export async function submitCustomerOrderIntake(userId: string, orderId: string, payload: unknown) {
  const parsed = intakeSchema.safeParse(payload);
  if (!parsed.success) fail(400, "Complete the business name and goals; keep intake within the field limits and supply its revision");
  const admin = getCqaSupabaseAdmin();
  const order = await ownedOrder(admin, userId, orderId);
  if (order.status !== "paid") fail(409, "A paid order is required before submitting intake");
  const { data: offer, error: offerError } = await admin.from("cqa_offers")
    .select("id,business_id,machine_id,offer_type,fulfillment_type")
    .eq("id", order.offer_id).eq("business_id", order.business_id).eq("machine_id", order.machine_id).maybeSingle();
  if (offerError) throw offerError;
  if (!offer || offer.business_id !== order.business_id || offer.machine_id !== order.machine_id) fail(404, "Order not found");
  const snapshot = purchaseSnapshot(order.purchase_snapshot);
  if ((snapshot ? snapshot.offerType : offer.offer_type) === "digital_product" || (snapshot ? snapshot.fulfillmentType : offer.fulfillment_type) === "digital")
    fail(409, "Digital purchases use the download library and do not require service intake");
  const { expectedRevision, ...intake } = parsed.data;
  const { data, error } = await admin.rpc("cqa_update_order_workspace", {
    p_order_id: orderId, p_actor_user_id: userId, p_action: "submit_intake", p_payload: intake, p_expected_revision: expectedRevision
  });
  if (error) {
    if (["40001", "23505", "23514"].includes(error.code) || /conflict|revision|already.*submitted|not paid/i.test(error.message))
      fail(409, "This order changed. Refresh it before trying again");
    if (["42501", "P0002"].includes(error.code) || /not found|not authorized|forbidden/i.test(error.message)) fail(404, "Order not found");
    throw error;
  }
  const workspace = record(record(data).workspace);
  if (workspace.order_id !== orderId || workspace.business_id !== order.business_id ||
      workspace.revision !== expectedRevision + 1 || workspace.state !== "queued")
    fail(409, "The saved brief could not be confirmed. Refresh this order before trying again");
  return getCustomerOrder(userId, orderId);
}

export async function downloadCustomerOrderAsset(userId: string, orderId: string) {
  const admin = getCqaSupabaseAdmin();
  const order = await ownedOrder(admin, userId, orderId);
  if (order.status !== "paid" || order.buyer_user_id !== userId) fail(404, "Order not found");
  const { data: workspace, error } = await admin.from("cqa_order_workspaces").select("state,asset_key,business_id")
    .eq("order_id", orderId).eq("business_id", order.business_id).maybeSingle();
  if (error) throw error;
  if (!workspace || workspace.business_id !== order.business_id || workspace.state !== "delivered" ||
      !validCustomerDeliveryKey(workspace.asset_key, text(order.business_id), orderId)) fail(409, "Delivery is not ready");
  const signed = await createSignedDownloadUrl(workspace.asset_key);
  const { data: current, error: currentError } = await admin.from("cqa_orders").select("id")
    .eq("id", orderId).eq("buyer_user_id", userId).eq("status", "paid").maybeSingle();
  if (currentError) throw currentError;
  if (!current) fail(404, "Order not found");
  return { url: signed.url, expiresIn: signed.expiresIn };
}

export function customerOrderErrorResponse(error: unknown) {
  const status = error instanceof CustomerOrderError ? error.status : 503;
  const message = error instanceof CustomerOrderError ? error.message : "Orders are temporarily unavailable";
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
