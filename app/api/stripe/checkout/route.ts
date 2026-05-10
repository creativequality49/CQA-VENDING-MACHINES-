import { NextResponse } from "next/server";
import { getPriceIdForTier, getStripeClient } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const { productId, tier, machineSlug, userId } = (await req.json()) as {
      productId?: string;
      tier?: string;
      machineSlug?: string;
      userId?: string;
    };

    if (!productId || !tier || !machineSlug) {
      return NextResponse.json({ error: "Missing productId, tier or machineSlug" }, { status: 400 });
    }

    const priceId = getPriceIdForTier(tier);
    if (!priceId) {
      return NextResponse.json({ error: `Missing Stripe price for tier: ${tier}` }, { status: 400 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const mode = tier === "subscription" ? "subscription" : "payment";

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout/cancel`,
      metadata: {
        userId: userId ?? "anonymous",
        productId,
        tier,
        machineSlug,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
