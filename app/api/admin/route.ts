import { NextResponse } from "next/server";
import { getCurrentUser, isAdminRole } from "@/lib/auth";
import { getAdminStats } from "@/lib/content-service";

export async function GET() {
  const user = await getCurrentUser();
  if (!isAdminRole(user?.role)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  return NextResponse.json({ stats: await getAdminStats() });
}
