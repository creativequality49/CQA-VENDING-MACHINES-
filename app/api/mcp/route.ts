import { requireCqaOwner } from "@/lib/cqa-owner-auth";
import { createCqaMcpHandler, type CqaMcpReader } from "@/lib/cqa-mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handle = createCqaMcpHandler({ authorize: async (req, businessId) => {
  const owner = await requireCqaOwner(req, businessId);
  // Narrow the deeply generic Supabase builder to the read-only methods this adapter uses.
  return { business: owner.business, admin: owner.admin as unknown as CqaMcpReader };
} });
export const POST = handle;
export const GET = handle;
export const DELETE = handle;
