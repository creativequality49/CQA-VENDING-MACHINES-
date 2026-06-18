import { cookies, headers } from "next/headers";

export type CqaRole = "owner" | "admin" | "content_admin" | "customer" | "ADMIN" | "OPERATIONS" | "FULFILLMENT" | "SUPPORT" | "FINANCE";

export type CqaUser = {
  id: string;
  email?: string;
  role: CqaRole;
};

export async function getCurrentUser(): Promise<CqaUser | null> {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const id = headerStore.get("x-cqa-user-id") ?? cookieStore.get("cqa_user_id")?.value;
  if (!id) return null;

  const role = (headerStore.get("x-cqa-role") ?? cookieStore.get("cqa_role")?.value ?? "customer") as CqaRole;
  const email = headerStore.get("x-cqa-email") ?? cookieStore.get("cqa_email")?.value;

  return { id, email: email ?? undefined, role };
}

export function isAdminRole(role?: string | null) {
  return role === "owner" || role === "admin" || role === "content_admin" || role === "ADMIN" || role === "OPERATIONS" || role === "FULFILLMENT" || role === "SUPPORT" || role === "FINANCE";
}

export function canManageOperations(role?: string | null) {
  return role === "owner" || role === "admin" || role === "ADMIN" || role === "OPERATIONS";
}
