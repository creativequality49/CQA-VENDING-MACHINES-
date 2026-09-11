import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripeClient } from "@/lib/stripe";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { platformFeePercent, type PlanKey } from "@/lib/cqa-marketplace";

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
    const admin = getCqaSupabaseAdmin();

    const { data: machine } = await admin
      .from("cqa_machines")
      .select("id,business_id,slug,status")
      .eq("slug", payload.machineSlug)
      .eq("status", "live")
      .single();
    if (!machine) return NextResponse.json({ error: "This machine is not available for checkout." }, { status: 404 });

    const { data: offer } = await admin
      .from("cqa_offers")
      .select("id,name,description,offer_type,price_cents,currency,stripe_price_id,business_id,active")
      .eq("id", payload.offerId)
      .eq("machine_id", machine.id)
      .eq("active", true)
      .single();
    if (!offer || offer.business_id !== machine.business_id) return NextResponse.json({ error: "This offer is not available." }, { status: 404 });
    if (offer.price_cents === null || offer.price_cents <= 0) return NextResponse.json({ error: "This offer requires a quote rather than checkout." }, { status: 409 });

    const [{ data: business }, { data: connected }] = await Promise.all([
      admin.from("cqa_businesses").select("id,name,plan,status").eq("id", machine.business_id).single(),
      admin.from("cqa_connected_accounts").select("stripe_account_id,charges_enabled,onboarding_complete").eq("business_id", machine.business_id).single()
    ]);
    if (!business || business.status !== "live") return NextResponse.json({ error: "This business is not currently accepting marketplace payments." }, { status: 409 });
    if (!connected?.stripe_account_id || !connected.charges_enabled || !connected.onboarding_complete) return NextResponse.json({ error: "This business is still completing secure payment onboarding." }, { status: 409 });

    const stripe = getStripeClient();
    const plan = business.plan as PlanKey;
    const feePercent = platformFeePercent(plan);
    const feeCents = Math.round(offer.price_cents * feePercent / 100);
    const subscription = offer.offer_type === "subscription";
    const origin = getSiteUrl(req);
    const metadata = { cqaBusinessId: business.id, cqaMachineId: machine.id, cqaOfferId: offer.id, cqaPlan: plan };

    const lineItem = offer.stripe_price_id
      ? { price: offer.stripe_price_id, quantity: 1 }
      : {
          price_data: {
            currency: (offer.currency || "aud").toLowerCase(),
            unit_amount: offer.price_cents,
            product_data: { name: offer.name, description: offer.description || undefined },
            ...(subscription ? { recurring: { interval: "month" as const } } : {})
          },
          quantity: 1
        };

    const checkout = await stripe.checkout.sessions.create({
      mode: subscription ? "subscription" : "payment",
      line_items: [lineItem],
      customer_email: payload.customerEmail,
      success_url: `${origin}/checkout/success?marketplace=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/machine/${machine.slug}`,
      metadata,
      ...(subscription
        ? { subscription_data: { application_fee_percent: feePercent, metadata } }
        : { payment_intent_data: { application_fee_amount: feeCents, metadata } })
    }, { stripeAccount: connected.stripe_account_id });

    if (!checkout.url) return NextResponse.json({ error: "Stripe did not return a secure checkout URL." }, { status: 502 });

    await admin.from("cqa_orders").insert({
      business_id: business.id,
      machine_id: machine.id,
      offer_id: offer.id,
      customer_email: payload.customerEmail || null,
      amount_cents: offer.price_cents,
      platform_fee_cents: subscription ? 0 : feeCents,
      currency: (offer.currency || "aud").toLowerCase(),
      status: "pending",
      stripe_checkout_session_id: checkout.id
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
    const message = error instanceof Error ? error.message : "Checkout failed.";
    if (message.includes("STRIPE_SECRET_KEY")) return NextResponse.json({ error: "CQA Stripe platform payments are not configured yet." }, { status: 503 });
    if (message.includes("Supabase server key")) return NextResponse.json({ error: "CQA secure database access is not configured on the deployment." }, { status: 503 });
    return NextResponse.json({ error: "Secure checkout could not be started." }, { status: 500 });
  }
}
