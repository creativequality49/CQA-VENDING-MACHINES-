import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const now = new Date();
  const content = await prisma.contentItem.updateMany({ where: { status: "scheduled", releaseDate: { lte: now } }, data: { status: "published", approvedBy: "cron" } });
  const dropsToPublish = await prisma.contentDrop.findMany({ where: { status: "scheduled", scheduledDate: { lte: now } }, include: { items: true } });
  for (const drop of dropsToPublish) {
    await prisma.contentDrop.update({ where: { id: drop.id }, data: { status: "published", publishedAt: now } });
    await prisma.contentItem.updateMany({ where: { id: { in: drop.items.map((item) => item.contentItemId) }, status: { in: ["scheduled", "draft"] } }, data: { status: "published", approvedBy: "cron" } });
    if (!drop.emailNotificationSent) {
      await prisma.emailLog.create({ data: { emailType: "content_drop_published", relatedDropId: drop.id, sentTo: "pending-audience", status: "queued", sentAt: now } });
      await prisma.contentDrop.update({ where: { id: drop.id }, data: { emailNotificationSent: true } });
    }
  }
  return NextResponse.json({ ok: true, contentPublished: content.count, dropsPublished: dropsToPublish.length });
}
