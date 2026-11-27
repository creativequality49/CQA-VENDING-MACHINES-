import { z } from "zod";
import { isCqaPhysicalPilotEnabled } from "@/lib/cqa-launch-gate";
import { requireCqaOwner } from "@/lib/cqa-owner-auth";
import { orderFailure, ownerOrder, ownerOrderHeaders, requestBusinessId, safeOwnerOrderError } from "@/lib/cqa-owner-orders";
import { getSupplierAdapter, type SupplierAddress } from "@/lib/cqa-supplier";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";
type Route = { params: Promise<{ orderId: string }> };
const actions = z.object({
  action: z.enum(["quote", "approve", "reconcile", "tracking"]),
  revision: z.number().int().nonnegative().max(2147483647)
}).strict();
const addressSchema = z.object({
  name: z.string().min(1), line1: z.string().min(1), line2: z.string().optional(),
  city: z.string().min(1), state: z.string(), postal_code: z.string().min(1),
  country: z.string().regex(/^[A-Z]{2}$/), phone: z.string().optional()
});
const headers = ownerOrderHeaders;
function displayQuote(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const quote = value as Record<string, unknown>;
  return { stock: quote.stock, currency: quote.currency, totalCost: quote.totalCost, estimatedDelivery: quote.estimatedDelivery };
}
function present(job: Record<string, unknown> | null) {
  if (!job) return null;
  return {
    state: job.state, revision: job.revision, supplierReference: job.supplier_order_id,
    supplierPayment: job.supplier_payment_state, quote: displayQuote(job.approval_quote)
  };
}
function failure(error: unknown) {
  const safe = safeOwnerOrderError(error);
  return Response.json({ error: safe.error }, { status: safe.status, headers });
}
async function load(request: Request, route: Route) {
  if (!isCqaPhysicalPilotEnabled()) orderFailure(404, "Supplier fulfilment pilot unavailable.");
  const context = await requireCqaOwner(request, requestBusinessId(request));
  const { orderId } = await route.params;
  const order = await ownerOrder(context, orderId);
  const admin = getCqaSupabaseAdmin();
  const { data: job, error } = await admin.from("cqa_supplier_fulfilments")
    .select("state,revision,provider,variant_sku,approval_quote,supplier_order_id,supplier_payment_state,updated_at")
    .eq("order_item_id", orderId).eq("business_id", context.business.id).maybeSingle();
  if (error) throw error;
  return { admin, context, orderId, order, job };
}
async function confirmUnrefundedPayment(context: Awaited<ReturnType<typeof load>>["context"], orderId: string) {
  const admin = getCqaSupabaseAdmin();
  const [payment, connected] = await Promise.all([
    admin.from("cqa_orders").select("stripe_payment_intent_id").eq("id", orderId)
      .eq("business_id", context.business.id).single(),
    admin.from("cqa_connected_accounts").select("stripe_account_id").eq("business_id", context.business.id).single()
  ]);
  if (payment.error || connected.error || !payment.data?.stripe_payment_intent_id || !connected.data?.stripe_account_id)
    orderFailure(409, "The Stripe payment could not be verified.");
  const intent = await getStripeClient().paymentIntents.retrieve(payment.data.stripe_payment_intent_id,
    { expand: ["latest_charge"] }, { stripeAccount: connected.data.stripe_account_id });
  const charge = intent.latest_charge;
  if (intent.livemode || intent.status !== "succeeded" || !charge || typeof charge === "string" ||
      !charge.paid || charge.disputed || charge.refunded || charge.amount_refunded > 0)
    orderFailure(409, "The order payment is no longer eligible for fulfilment.");
}

export async function GET(request: Request, route: Route) {
  try {
    const { job } = await load(request, route);
    return Response.json({ supplier: present(job) }, { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request, route: Route) {
  try {
    const { admin, context, order, orderId, job } = await load(request, route);
    const input = actions.safeParse(await request.json().catch(() => null));
    if (!input.success) orderFailure(400, "Choose a valid supplier action.");
    if (!job) orderFailure(404, "Supplier fulfilment is unavailable for this order.");
    const { action, revision } = input.data;
    if (job.revision !== revision) orderFailure(409, "The supplier order changed. Refresh before continuing.");
    const supplier = getSupplierAdapter(job.provider);
    const saveResult = async (reference: string | null) => {
      const { data, error } = await admin.rpc("cqa_supplier_submission_result", {
        p_order_id: orderId, p_reference: reference
      });
      if (error || !data) throw error || new Error("Submission result unavailable.");
      return data;
    };
    if (action === "reconcile") {
      const staleSubmission = job.state === "submitting" && Date.now() - Date.parse(job.updated_at) >= 60_000;
      if (job.supplier_order_id || (!staleSubmission && !["reconciliation_required", "returns_review"].includes(job.state)))
        orderFailure(409, "This supplier order is not awaiting reconciliation.");
      const match = await supplier.reconcile(orderId);
      const updated = await saveResult(match?.supplierReference ?? null);
      return Response.json({ supplier: present(updated), message: match
        ? "Supplier order confirmed." : "No supplier order was confirmed. The order remains on hold for review." }, { headers });
    }
    if (action === "tracking") {
      if (!job.supplier_order_id || !["submitted", "returns_review"].includes(job.state))
        orderFailure(409, "No submitted supplier order is available.");
      const tracking = await supplier.track(job.supplier_order_id);
      const { error } = await admin.rpc("cqa_supplier_tracking_update", {
        p_order_id: orderId, p_supplier_reference: job.supplier_order_id, p_tracking: tracking
      });
      if (error) throw error;
      return Response.json({ supplier: present((await load(request, route)).job), message: "Tracking refreshed." }, { headers });
    }
    if (order.status !== "paid" || job.state !== "awaiting_approval")
      orderFailure(409, "Only confirmed paid orders awaiting approval can be submitted.");
    const { data: shipment, error: shipmentError } = await admin.from("cqa_order_shipments")
      .select("shipping_address").eq("order_id", orderId).eq("business_id", context.business.id).single();
    if (shipmentError) throw shipmentError;
    const parsed = addressSchema.safeParse(shipment?.shipping_address);
    if (!parsed.success) orderFailure(409, "The verified shipping details are incomplete.");
    const source = parsed.data;
    const address: SupplierAddress = { name: source.name, line1: source.line1, line2: source.line2,
      city: source.city, region: source.state, postalCode: source.postal_code, countryCode: source.country, phone: source.phone };
    const requestDetails = { sku: job.variant_sku, quantity: 1, address };
    const quote = await supplier.quote(requestDetails);
    if (action === "approve" && job.approval_quote) await confirmUnrefundedPayment(context, orderId);
    const { data, error } = await admin.rpc("cqa_supplier_approval", {
      p_order_id: orderId, p_actor_user_id: context.user.id, p_revision: revision, p_action: action, p_quote: quote
    });
    if (error?.code === "40001") orderFailure(409, "The order changed or its payment was revoked. Refresh before continuing.");
    if (error || !data?.job) throw error || new Error("Approval could not be confirmed.");
    if (data.job.state !== "submitting") {
      return Response.json({ supplier: present(data.job), previousQuote: data.changed ? displayQuote(job.approval_quote) : null,
        message: quote.stock < 1 ? "Supplier stock is unavailable. No order was submitted."
          : data.changed && job.approval_quote ? "The supplier quote changed. Review the new stock and cost before approving again."
          : "Review the current supplier quote before approving." }, { headers });
    }
    let reference: string;
    try {
      const { data: current, error: currentError } = await admin.from("cqa_supplier_fulfilments")
        .select("state").eq("order_item_id", orderId).eq("business_id", context.business.id).single();
      if (currentError || current?.state !== "submitting") orderFailure(409, "The supplier submission was stopped. Refresh this order.");
      reference = (await supplier.submit({ ...requestDetails, quote, reference: orderId })).supplierReference;
    } catch {
      return Response.json({ supplier: present(await saveResult(null)),
        message: "Submission could not be confirmed. Reconcile the supplier reference before proceeding." }, { headers });
    }
    return Response.json({ supplier: present(await saveResult(reference)),
      message: "Supplier order recorded. Supplier payment is handled separately." }, { headers });
  } catch (error) { return failure(error); }
}
