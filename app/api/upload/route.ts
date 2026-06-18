import { NextResponse } from "next/server";
import { getCurrentUser, isAdminRole } from "@/lib/auth";
import { uploadPrivateSupabaseObject } from "@/lib/supabase-storage";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!isAdminRole(user?.role)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const path = String(form.get("path") ?? "");
  if (!file?.size || !path) return NextResponse.json({ error: "file and path are required" }, { status: 400 });
  const filePath = await uploadPrivateSupabaseObject(path, file);
  return NextResponse.json({ filePath });
}
