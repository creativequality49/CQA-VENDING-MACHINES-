import { getSupabaseAdminClient } from "@/lib/supabase";

export async function requireFanXUser(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) throw new Error("Authentication required");

  const supabase = getSupabaseAdminClient() as any;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) throw new Error("Authentication required");
  return data.user as { id: string; email?: string | null; user_metadata?: Record<string, unknown> };
}

export function bearerError(error: unknown) {
  const message = error instanceof Error ? error.message : "Authentication error";
  return { message, status: message === "Authentication required" ? 401 : 500 };
}
