import { NextResponse } from "next/server";
import { ProductType } from "@prisma/client";
import { getStripeClient } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { isDatabaseConfigured } from "@/lib/env";
import { assertPurchasable } from "@/services/inventory.service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { productId, userId, customerId, quantity = 1 } = (await req.json()) as { productId?: string; userId?: string; customerId?: string; quantity?: number };
    if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });
    if (!isDatabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    const product = await prisma.product.findUnique({ where: { id: productId }, include: { machine: true } });
    if (!product || (product.status !== "active" && product.status !== "ACTIVE")) return NextResponse.json({ error: "Product unavailable" }, { status: 404 });
    if (!product.stripePriceId) return NextResponse.json({ error: "Product is missing stripe_price_id" }, { status: 400 });
    await assertPurchasable(product, quantity);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const mode = product.productType === ProductType.SUBSCRIPTION || product.isSubscription || product.accessType === "subscription" ? "subscription" : "payment";
    const stripe = getStripeClient();
    const metadata = { userId: userId ?? "", customerId: customerId ?? userId ?? "", productId: product.id, productType: product.productType, machineId: product.machineId ?? "", machineSlug: product.machine?.slug ?? "", tier: product.tier ?? "", accessType: product.accessType };
    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: product.stripePriceId, quantity }],
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout/cancel`,
      metadata,
      subscription_data: mode === "subscription" ? { metadata } : undefined,
      shipping_address_collection: product.productType === ProductType.PHYSICAL ? { allowed_countries: ["AU", "NZ", "US", "GB", "CA"] } : undefined,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
