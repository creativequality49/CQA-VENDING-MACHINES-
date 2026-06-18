import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasContentAccess } from "@/lib/content-service";
import { isDatabaseConfigured } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { createSupabaseSignedUrl } from "@/lib/supabase-storage";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Content database is not configured" }, { status: 503 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { id } = await params;
  const content = await prisma.contentItem.findUnique({ where: { id } });
  if (!content || content.status !== "published" || content.accessType === "admin") return NextResponse.json({ error: "Content unavailable" }, { status: 404 });
  const now = new Date();
  if ((content.releaseDate && content.releaseDate > now) || (content.expiryDate && content.expiryDate <= now)) return NextResponse.json({ error: "Content unavailable" }, { status: 404 });
  const allowed = await hasContentAccess(user, content);
  if (!allowed) {
    await prisma.downloadLog.create({ data: { userId: user.id, contentItemId: content.id, productId: content.assignedProductId, machineId: content.assignedMachineId, accessType: content.accessType, downloadStatus: "denied" } });
    return NextResponse.json({ error: "locked/access denied" }, { status: 403 });
  }
  if (!content.filePath) return NextResponse.json({ error: "No file attached" }, { status: 404 });
  const url = await createSupabaseSignedUrl(content.filePath, 900);
  await prisma.downloadLog.create({ data: { userId: user.id, contentItemId: content.id, productId: content.assignedProductId, machineId: content.assignedMachineId, accessType: content.accessType, downloadStatus: "signed_url_created" } });
  return NextResponse.redirect(url);
}
