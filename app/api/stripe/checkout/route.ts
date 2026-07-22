import { NextResponse } from "next/server";
import { requireUserSession } from "@/lib/auth";
import { getProductById, getProductReadiness } from "@/lib/catalog";
import { getStripeClient } from "@/lib/stripe";

function getSiteUrl(req: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("Missing NEXT_PUBLIC_SITE_URL");
  return new URL(req.url).origin;
}

export async function POST(req: Request) {
  try {
    const session = await requireUserSession();
    const { productId, machineSlug } = (await req.json()) as {
      productId?: string;
      machineSlug?: string;
    };

    if (!productId || !machineSlug) {
      return NextResponse.json({ error: "Missing productId or machineSlug" }, { status: 400 });
    }

    const product = getProductById(productId);
    if (!product) {
      return NextResponse.json({ error: "Unknown product" }, { status: 404 });
    }

    const readiness = getProductReadiness(product);
    if (!readiness.sellable) {
      return NextResponse.json(
        { error: "This product has not passed CQA fulfilment and payment quality checks", checks: readiness.checks },
        { status: 409 }
      );
    }

    const priceId = process.env[product.stripePriceEnv]?.trim();
    if (!priceId) {
      return NextResponse.json({ error: "Stripe price is not configured for this product" }, { status: 409 });
    }

    const siteUrl = getSiteUrl(req);
    const mode = product.subscriberOnly || product.tier === "subscription" ? "subscription" : "payment";
    const metadata = {
      userId: session.user.id,
      productId: product.id,
      tier: product.tier,
      machineSlug,
      catalogVersion: product.version,
      assetKey: product.assetKey
    };

    const checkoutSession = await getStripeClient().checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/machine/${machineSlug}`,
      client_reference_id: session.user.id,
      customer_email: session.user.email ?? undefined,
      allow_promotion_codes: true,
      metadata,
      ...(mode === "subscription"
        ? { subscription_data: { metadata } }
        : { payment_intent_data: { metadata } })
    });

    if (!checkoutSession.url) throw new Error("Stripe did not return a checkout URL");
    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout error";
    const status = message === "Authentication required" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
