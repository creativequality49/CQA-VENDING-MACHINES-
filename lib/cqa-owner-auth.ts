import "server-only";
import { getPublicSupabaseClient } from "@/lib/cqa-marketplace";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";

export async function requireCqaOwner(req: Request, businessId?: string) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) throw Object.assign(new Error("Authentication required."), { status: 401 });

  const authClient = getPublicSupabaseClient();
  const { data, error } = await authClient.auth.getUser(token);
  const user = data.user;
  if (error || !user) throw Object.assign(new Error("Your login session is no longer valid."), { status: 401 });

  const admin = getCqaSupabaseAdmin();
  let query = admin.from("cqa_businesses").select("id,name,slug,category,description,plan,status,owner_id");
  if (businessId) query = query.eq("id", businessId);
  query = query.eq("owner_id", user.id).order("created_at", { ascending: true }).limit(1);
  const { data: businesses, error: businessError } = await query;
  if (businessError) throw Object.assign(new Error("Unable to load the business workspace."), { status: 500 });

  const business = businesses?.[0] || null;
  if (!business) throw Object.assign(new Error("Business not found or not owned by this account."), { status: 403 });

  return { user, business, admin, token };
}
