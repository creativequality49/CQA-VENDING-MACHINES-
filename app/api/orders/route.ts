import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ orders: [] });
  const orders = await prisma.order.findMany({ where: { userId: user.id }, include: { product: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ orders });
}
