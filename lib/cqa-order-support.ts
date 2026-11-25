import "server-only";
import { z } from "zod";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { CustomerOrderError, getCustomerOrder, requireCustomerOrderUser } from "@/lib/cqa-customer-orders";
import { requireCqaOwner } from "@/lib/cqa-owner-auth";
import { ownerOrder, requestBusinessId } from "@/lib/cqa-owner-orders";

type Audience = "customer" | "owner";
type Access = { orderId: string; businessId: string; userId: string; canConfirmDelivery: boolean };
const headers = { "Cache-Control": "private, no-store" };
const inputSchema = z.object({
  action: z.enum(["message", "resolve", "reopen", "confirm_delivery"]),
  message: z.string().trim().max(3000).optional().default(""),
  expectedRevision: z.number().int().min(0).max(2147483646),
  requestId: z.string().uuid()
}).strict().refine(value => value.action === "message" ? Boolean(value.message) : !value.message);

/** Resolve actor/order/tenant from verified identities, never from the POST body. */
async function requireSupportAccess(request: Request, orderId: string, audience: Audience): Promise<Access> {
  if (audience === "customer") {
    const userId = await requireCustomerOrderUser(request);
    const order = await getCustomerOrder(userId, orderId);
    return { orderId: order.id, businessId: order.businessId, userId,
      canConfirmDelivery: order.paymentStatus === "paid" && order.workspace.state === "delivered" &&
        order.offerType !== "digital_product" && order.fulfillmentType !== "digital" &&
        order.offerType !== "physical_product" && order.fulfillmentType !== "shipping" };
  }
  const context = await requireCqaOwner(request, requestBusinessId(request));
  await ownerOrder(context, orderId);
  return { orderId, businessId: context.business.id, userId: context.user.id, canConfirmDelivery: false };
}

async function readSupport(access: Access, messagePage: number) {
  const admin = getCqaSupabaseAdmin();
  const { data: thread, error: threadError } = await admin.from("cqa_order_support")
    .select("order_id,business_id,state,revision,delivery_confirmed_at")
    .eq("order_id", access.orderId).eq("business_id", access.businessId).maybeSingle();
  if (threadError) throw threadError;
  if (!thread) return { support: { state: "none", revision: 0, deliveryConfirmedAt: null, messages: [], hasMore: false, messagePage }, canConfirmDelivery: access.canConfirmDelivery };
  if (thread.order_id !== access.orderId || thread.business_id !== access.businessId ||
    !["none", "waiting_owner", "waiting_customer", "resolved"].includes(thread.state) || !Number.isSafeInteger(thread.revision))
    throw new Error("Support record could not be confirmed");
  const { data: messages, error: messageError } = await admin.from("cqa_order_support_messages")
    .select("id,order_id,actor_role,message,created_at").eq("order_id", access.orderId)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).range(messagePage * 100, messagePage * 100 + 100);
  if (messageError) throw messageError;
  if ((messages || []).some(row => row.order_id !== access.orderId || !["buyer", "owner"].includes(row.actor_role)))
    throw new Error("Support messages could not be confirmed");
  return { support: { state: thread.state, revision: thread.revision, deliveryConfirmedAt: thread.delivery_confirmed_at,
    messages: (messages || []).slice(0, 100).reverse().map(row => ({ id: row.id, actorRole: row.actor_role, message: row.message, createdAt: row.created_at })),
    hasMore: (messages || []).length > 100, messagePage }, canConfirmDelivery: access.canConfirmDelivery };
}

function supportError(error: unknown) {
  const status = error instanceof CustomerOrderError ? error.status :
    error && typeof error === "object" && "status" in error ? Number(error.status) : 503;
  const safeStatus = [400, 401, 403, 404, 409, 413, 429].includes(status) ? status : 503;
  return Response.json({ error: safeStatus !== 503 && error instanceof Error ? error.message :
    "Order support is temporarily unavailable. Your message has not been confirmed; refresh before retrying." }, { status: safeStatus, headers });
}

export async function handleOrderSupport(request: Request, orderId: string, audience: Audience) {
  try {
    const access = await requireSupportAccess(request, orderId, audience);
    const rawPage = new URL(request.url).searchParams.get("messagePage") || "0";
    const messagePage = request.method === "POST" ? 0 : Number(rawPage);
    if (!/^\d+$/.test(rawPage) || !Number.isSafeInteger(messagePage) || messagePage < 0 || messagePage > 10000)
      throw new CustomerOrderError(400, "Choose a valid support history page");
    if (request.method === "POST") {
      const body = await request.text();
      if (body.length > 14000) throw new CustomerOrderError(413, "Support message is too large");
      let json: unknown;
      try { json = JSON.parse(body); } catch { throw new CustomerOrderError(400, "Invalid support request"); }
      const parsed = inputSchema.safeParse(json);
      if (!parsed.success) throw new CustomerOrderError(400, "Enter a message of up to 3,000 characters and refresh before retrying");
      const input = parsed.data;
      if (input.action === "confirm_delivery" && !access.canConfirmDelivery)
        throw new CustomerOrderError(409, "A paid service delivery is required before confirming receipt");
      const { data, error } = await getCqaSupabaseAdmin().rpc("cqa_update_order_support", {
        p_order_id: access.orderId, p_actor_user_id: access.userId, p_action: input.action, p_message: input.message,
        p_expected_revision: input.expectedRevision, p_request_id: input.requestId
      });
      if (error) {
        if (["42501", "P0002"].includes(error.code)) throw new CustomerOrderError(404, "Order not found");
        if (error.code === "54000") throw new CustomerOrderError(429, "Please wait a minute before sending another support message");
        if (["40001", "23514", "23505"].includes(error.code)) throw new CustomerOrderError(409, "This conversation changed. Refresh it before trying again");
        throw error;
      }
      if (data?.request_id !== input.requestId || !data.support || data.support.order_id !== access.orderId || data.support.business_id !== access.businessId ||
        !Number.isSafeInteger(data.support.revision) || data.support.revision < input.expectedRevision)
        throw new Error("Support change could not be confirmed");
    }
    return Response.json(await readSupport(access, messagePage), { headers });
  } catch (error) { return supportError(error); }
}
