import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDatabaseConfigured } from "@/lib/env";

export async function GET() {
  if (!isDatabaseConfigured()) return NextResponse.json({ products: [] });
  const products = await prisma.product.findMany({ where: { status: "active" }, include: { machine: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ products });
}
