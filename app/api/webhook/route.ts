import crypto from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { findProductByPriceId } from "@/lib/products";
import { createDownloadToken, upsertOrder, upsertProfile } from "@/lib/supabase-rest";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event;

  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, getEnv().STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return NextResponse.json(
      { error: `Webhook verification failed: ${(error as Error).message}` },
      { status: 400 },
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const lineItems = await getStripeClient().checkout.sessions.listLineItems(session.id, { limit: 1 });
    const priceId = lineItems.data[0]?.price?.id;
    const customerEmail = session.customer_details?.email;

    if (!priceId || !customerEmail) {
      return NextResponse.json({ error: "Missing price or email in checkout session." }, { status: 400 });
    }

    const product = findProductByPriceId(priceId);

    if (!product) {
      return NextResponse.json({ error: "No internal product mapping for Stripe price." }, { status: 400 });
    }

        const userHash = crypto.createHash("sha256").update(customerEmail).digest("hex");
    const userId = `${userHash.slice(0, 8)}-${userHash.slice(8, 12)}-${userHash.slice(12, 16)}-${userHash.slice(16, 20)}-${userHash.slice(20, 32)}`;

    await upsertProfile({
      userId,
      email: customerEmail,
    });

    await upsertOrder({
      userId,
      productId: product.id,
      stripeSessionId: session.id,
      status: "paid",
    });

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

    await createDownloadToken({
      userId,
      productId: product.id,
      token,
      expiresAt,
    });
  }

  return NextResponse.json({ received: true });
}
