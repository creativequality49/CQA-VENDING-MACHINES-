import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveMarketplaceDownload } from "@/lib/cqa-marketplace-delivery";

export const runtime = "nodejs";
const orderSchema = z.string().uuid();

export async function GET(req: Request) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") || "");
  if (!match) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const orderId = new URL(req.url).searchParams.get("orderId");
  if (!orderId || !orderSchema.safeParse(orderId).success)
    return NextResponse.json({ error: "Invalid order reference" }, { status: 400 });
  try {
    const result = await resolveMarketplaceDownload(match[1], orderId);
    if (result.status !== 200)
      return NextResponse.json({ error: result.status === 401 ? "Authentication required" :
        result.status === 409 ? "Digital asset is not ready" : "Order not found" }, { status: result.status });
    return NextResponse.json({ url: result.url, expiresIn: result.expiresIn }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return NextResponse.json({ error: "Download unavailable" }, { status: 503 });
  }
}
