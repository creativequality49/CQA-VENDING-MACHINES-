import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireCqaOwner } from "@/lib/cqa-owner-auth";
import { requestBusinessId, requireVerifiedOrderOwner, safeOwnerOrderError } from "@/lib/cqa-owner-orders";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { summarizeCqaOperations, type OperationRow } from "@/lib/cqa-operations";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const pageSize = 500, rowCap = 10000;
async function readOperationsRows(client: SupabaseClient, businessId: string, table: string, fields: string, order = "id") {
  const rows: OperationRow[] = [];
  let expectedCount: number | null = null;
  for (let offset = 0; offset <= rowCap; offset += pageSize) {
    const result = await client.from(table).select(fields, { count: "exact" }).eq("business_id", businessId).order(order).range(offset, offset + pageSize - 1);
    if (result.error || !Array.isArray(result.data)) throw Error("Operations data unavailable");
    if (!Number.isSafeInteger(result.count) || result.count === null || result.count < 0 || (expectedCount !== null && result.count !== expectedCount)) throw Error("Operations records changed during refresh");
    expectedCount = result.count;
    if (expectedCount > rowCap || rows.length + result.data.length > rowCap) throw Error("Operations overview capacity exceeded");
    const page = (result.data as unknown[]).map(value => {
      if (!value || typeof value !== "object" || Array.isArray(value) || (value as OperationRow).business_id !== businessId) throw Error("Operations row scope mismatch");
      return value as OperationRow;
    });
    rows.push(...page);
    if (result.data.length < pageSize) {
      if (rows.length !== expectedCount) throw Error("Operations rows were truncated");
      const keys = rows.map(row => row[order]);
      if (keys.some(key => typeof key !== "string" || !key) || new Set(keys).size !== keys.length) throw Error("Operations rows were repeated");
      return rows;
    }
  }
  throw Error("Operations overview capacity exceeded");
}
export async function GET(request: Request) {
  try {
    const context = await requireCqaOwner(request, requestBusinessId(request)); requireVerifiedOrderOwner(context);
    const [machines, offers, orders, shipments, workspaces] = await Promise.all([
      readOperationsRows(context.admin, context.business.id, "cqa_machines", "id,business_id,title,slug,status"),
      readOperationsRows(context.admin, context.business.id, "cqa_offers", "id,business_id,machine_id,name,offer_type,fulfillment_type,active,inventory_tracking,inventory_quantity"),
      readOperationsRows(context.admin, context.business.id, "cqa_orders", "id,business_id,machine_id,offer_id,buyer_user_id,status,amount_cents,currency,created_at,purchase_snapshot"),
      readOperationsRows(context.admin, context.business.id, "cqa_order_shipments", "order_id,business_id,state", "order_id"),
      readOperationsRows(context.admin, context.business.id, "cqa_order_workspaces", "order_id,business_id,state", "order_id")
    ]);
    const tracked = offers.filter(row => row.active === true && row.offer_type === "physical_product" && row.inventory_tracking === true);
    const inventory: { offer_id: string; reserved_quantity: number; available_quantity: number | null }[] = [];
    const schema = z.object({ inventory: z.array(z.object({ offer_id: z.string().uuid(), reserved_quantity: z.number().int().nonnegative(), available_quantity: z.number().int().nonnegative().nullable() })) });
    for (let offset = 0; offset < tracked.length; offset += 100) {
      const ids = tracked.slice(offset, offset + 100).map(row => String(row.id));
      const result = await getCqaSupabaseAdmin().rpc("cqa_owner_product_inventory", { p_business_id: context.business.id, p_actor_user_id: context.user.id, p_offer_ids: ids });
      const parsed = schema.safeParse(result.data);
      if (result.error || !parsed.success || parsed.data.inventory.length !== ids.length || new Set(parsed.data.inventory.map(row => row.offer_id)).size !== ids.length || parsed.data.inventory.some(row => !ids.includes(row.offer_id))) throw Error("Inventory summary unavailable");
      inventory.push(...parsed.data.inventory);
    }
    return NextResponse.json(summarizeCqaOperations({ business: { id: context.business.id, name: context.business.name, status: context.business.status }, machines, offers, orders, shipments, workspaces, inventory }), { headers });
  } catch (failure) { const result = safeOwnerOrderError(failure); return NextResponse.json({ error: result.status === 503 ? "Your operations overview could not be loaded completely. No partial totals are shown. Refresh or contact support if your catalogue exceeds 10,000 records." : result.error }, { status: result.status, headers }); }
}
