import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getStripePriceId, products } from "@/lib/products";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const productId = Number(formData.get("productId"));

  const product = products.find((item) => item.id === productId);

  if (!product) {
    return NextResponse.json({ error: "Invalid product selected." }, { status: 400 });
  }

    const stripePriceId = getStripePriceId(product.id);

  if (!stripePriceId) {
    return NextResponse.json({ error: "Price mapping missing for product." }, { status: 500 });
  }

  const session = await getStripeClient().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price: stripePriceId,
        quantity: 1,
      },
    ],
    success_url: `${getEnv().NEXT_PUBLIC_SITE_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getEnv().NEXT_PUBLIC_SITE_URL}/?cancelled=true`,
    metadata: {
      product_id: String(product.id),
      product_name: product.name,
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Unable to create checkout session." }, { status: 500 });
  }

  return NextResponse.redirect(session.url, { status: 303 });
}
