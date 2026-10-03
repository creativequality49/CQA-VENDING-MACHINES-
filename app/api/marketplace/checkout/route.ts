import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripeClient } from "@/lib/stripe";
import {
  getPublicSupabaseClient,
  platformFeePercent,
  type PlanKey
} from "@/lib/cqa-marketplace";

const schema = z.object({
  machineSlug: z.string().min(1).max(100),
  offerId: z.string().uuid(),
  customerEmail: z.string().email().optional()
});

function getSiteUrl(req: Request) {
  return (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, "");
}

export async function POST(req: Request) {
  try {
    const payload = schema.parse(await req.json());
    const publicClient = getPublicSupabaseClient();

    const { data, error } = await publicClient.rpc("cqa_public_checkout_context", {
      p_machine_slug: payload.machineSlug,
      p_offer_id: payload.offerId
    });

    if (error) {
      console.error("[marketplace-checkout] context RPC failed", error.message);
      return NextResponse.json({ error: "Secure checkout context is unavailable." }, { status: 503 });
    }

    const context = Array.isArray(data) ? data[0] : data;
    if (!context) {
      return NextResponse.json({ error: "This offer is not available for checkout." }, { status: 404 });
    }

    if (!context.connected_account_id || !context.charges_enabled || !context.onboarding_complete) {
      return NextResponse.json(
        { error: "This business is still completing secure payment onboarding." },
        { status: 409 }
      );
    }

    const priceCents = Number(context.price_cents);
    if (!Number.isFinite(priceCents) || priceCents <= 0) {
      return NextResponse.json({ error: "This offer requires a quote rather than checkout." }, { status: 409 });
    }

    const stripe = getStripeClient();
    const connectedAccount = await stripe.accounts.retrieve(context.connected_account_id);
    if (
      connectedAccount.deleted ||
      connectedAccount.metadata?.cqaBusinessId !== context.business_id ||
      !connectedAccount.charges_enabled ||
      !connectedAccount.details_submitted
    ) {
      return NextResponse.json(
        { error: "This business is still completing secure payment onboarding." },
        { status: 409 }
      );
    }

    const plan = context.business_plan as PlanKey;
    const feePercent = platformFeePercent(plan);
    const feeCents = Math.round(priceCents * feePercent / 100);
    const subscription = context.offer_type === "subscription";
    const origin = getSiteUrl(req);

    const metadata = {
      cqaBusinessId: String(context.business_id),
      cqaMachineId: String(context.machine_id),
      cqaOfferId: String(context.offer_id),
      cqaPlan: plan
    };

    // Inline price_data is deliberate for Connect direct charges. A Price created
    // on the platform account cannot be assumed to exist on the connected account.
    const lineItem = {
      price_data: {
        currency: String(context.currency || "aud").toLowerCase(),
        unit_amount: priceCents,
        product_data: {
          name: String(context.offer_name),
          description: context.offer_description || undefined
        },
        ...(subscription ? { recurring: { interval: "month" as const } } : {})
      },
      quantity: 1
    };

    const checkout = await stripe.checkout.sessions.create(
      {
        mode: subscription ? "subscription" : "payment",
        line_items: [lineItem],
        customer_email: payload.customerEmail,
        success_url: `${origin}/checkout/success?marketplace=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/machine/${context.machine_slug}`,
        metadata,
        ...(subscription
          ? { subscription_data: { application_fee_percent: feePercent, metadata } }
          : { payment_intent_data: { application_fee_amount: feeCents, metadata } })
      },
      { stripeAccount: context.connected_account_id }
    );

    if (!checkout.url) {
      return NextResponse.json({ error: "Stripe did not return a secure checkout URL." }, { status: 502 });
    }

    // The signed Connect webhook writes the paid order. This keeps anonymous
    // storefront visitors from gaining direct write access to order records.
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Checkout failed.";
    if (message.includes("STRIPE_SECRET_KEY")) {
      return NextResponse.json({ error: "CQA Stripe platform payments are not configured yet." }, { status: 503 });
    }

    console.error("[marketplace-checkout] failed", error);
    return NextResponse.json({ error: "Secure checkout could not be started." }, { status: 500 });
  }
}
