import { NextResponse } from "next/server";
import { requireUserSession } from "@/lib/auth";
import { getPriceIdForTier, getStripeClient } from "@/lib/stripe";

const ALLOWED_TIERS = new Set(["basic", "pro", "elite", "subscription"]);

function getSiteUrl(req: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing NEXT_PUBLIC_SITE_URL");
  }

  return new URL(req.url).origin;
}

export async function POST(req: Request) {
  try {
    const session = await requireUserSession();
    const { productId, tier, machineSlug } = (await req.json()) as {
      productId?: string;
      tier?: string;
      machineSlug?: string;
    };

    if (!productId || !tier || !machineSlug) {
      return NextResponse.json({ error: "Missing productId, tier or machineSlug" }, { status: 400 });
    }

    if (!ALLOWED_TIERS.has(tier)) {
      return NextResponse.json({ error: `Unsupported checkout tier: ${tier}` }, { status: 400 });
    }

    const priceId = getPriceIdForTier(tier);
    if (!priceId) {
      return NextResponse.json({ error: `Missing Stripe price for tier: ${tier}` }, { status: 400 });
    }

    const siteUrl = getSiteUrl(req);
    const mode = tier === "subscription" ? "subscription" : "payment";
    const metadata = {
      userId: session.user.id,
      productId,
      tier,
      machineSlug,
    };

    const stripe = getStripeClient();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout/cancel`,
      client_reference_id: session.user.id,
      customer_email: session.user.email ?? undefined,
      allow_promotion_codes: true,
      metadata,
      ...(mode === "subscription"
        ? { subscription_data: { metadata } }
        : { payment_intent_data: { metadata } }),
    });

    if (!checkoutSession.url) {
      throw new Error("Stripe did not return a checkout URL");
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout error";
    const status = message === "Authentication required" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
