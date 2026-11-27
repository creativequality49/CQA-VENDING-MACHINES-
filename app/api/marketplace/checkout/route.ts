import type Stripe from "stripe";
import { reserveProductInventory, bindProductInventory, releaseUnboundProductInventory } from "@/lib/cqa-product-fulfillment";
import { getCqaOfferCheckoutHold, physicalShippingConfig } from "@/lib/cqa-offer-readiness";
import { getCqaSiteUrl } from "@/lib/cqa-site-url";
import { isCqaPhysicalCheckoutAllowed, isCqaPhysicalPilotEnabled, isNewCqaCheckoutAllowed, isCqaDigitalCheckoutAllowed, CQA_PRELAUNCH_CHECKOUT_MESSAGE } from "@/lib/cqa-launch-gate";
import { verifyPrivateMarketplaceAsset } from "@/lib/storage";
import { MAX_MARKETPLACE_ASSET_BYTES, MARKETPLACE_ASSET_EXTENSIONS } from "@/lib/cqa-marketplace-assets";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripeClient } from "@/lib/stripe";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { isActiveBillingStatus } from "@/lib/cqa-billing";
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
  return getCqaSiteUrl(req);
}

export async function POST(req: Request) {
  let reservationId: string | null = null;
  let stripeCreateAttempted = false;
  let createdCheckout: { id: string; account: string } | null = null;
  try {
    const payload = schema.parse(await req.json());
    const publicClient = getPublicSupabaseClient();

    const { data, error } = await publicClient.rpc("cqa_public_checkout_context", {
      p_machine_slug: payload.machineSlug,
      p_offer_id: payload.offerId
    });

    if (error) {
      return NextResponse.json({ error: "Secure checkout context is unavailable." }, { status: 503 });
    }

    const context = Array.isArray(data) ? data[0] : data;
    if (!context) {
      return NextResponse.json({ error: "This offer is not available for checkout." }, { status: 404 });
    }
    // Read the server-owned offer row so legacy digital checkout also works
    // during an additive rollout before the new optional columns exist.
    const { data: offer, error: offerError } = await getCqaSupabaseAdmin().from("cqa_offers").select("*")
      .eq("id", context.offer_id).eq("business_id", context.business_id).eq("machine_id", context.machine_id).maybeSingle();
    if (offerError) throw offerError;
    if (!offer || context.offer_id !== payload.offerId || context.machine_slug !== payload.machineSlug || offer.offer_type !== context.offer_type) return NextResponse.json({ error: "This offer is no longer available." }, { status: 404 });
    if (offer.fulfilment_type === "affiliate_link") {
      return NextResponse.json({ error: "Open the seller's referral link to purchase this offer.", code: "CQA_AFFILIATE_EXTERNAL" }, { status: 409 });
    }
    const readinessHold = getCqaOfferCheckoutHold(offer) || getCqaOfferCheckoutHold({ ...offer, offer_type: context.offer_type });
    if (readinessHold) return NextResponse.json({ error: readinessHold.message, code: readinessHold.code }, { status: 409 });
    const physical = offer.offer_type === "physical_product";
    const pilotPhysicalCheckout = physical && Boolean(offer.fulfilment_type);
    const supplier = physical && offer.fulfilment_type === "supplier_shipped";
    const fulfilmentType = physical ? (supplier ? "supplier_shipped" : "seller_shipped") : null;
    const provider = supplier ? offer.supplier_provider : "merchant";
    const sku = supplier ? offer.supplier_variant_sku : offer.id;
    const shipping = physical ? physicalShippingConfig(offer.fulfillment_config) : null;
    if (physical && (!shipping || !isCqaPhysicalCheckoutAllowed()))
      return NextResponse.json({ error: "Physical delivery is paused until inventory and merchant dispatch are verified.", code: "CQA_PHYSICAL_DELIVERY_PENDING" }, { status: 409 });
    if (pilotPhysicalCheckout && !isCqaPhysicalPilotEnabled())
      return NextResponse.json({ error: "Physical pilot checkout is only available in isolated Preview.", code: "CQA_PHYSICAL_DELIVERY_PENDING" }, { status: 409 });
    if (supplier && (!["mock", "cjdropshipping"].includes(provider) || typeof sku !== "string" || !sku))
      return NextResponse.json({ error: "This offer is not ready for supplier fulfilment." }, { status: 409 });
    const digital = context.offer_type === "digital_product" || offer.offer_type === "digital_product" || offer.fulfillment_type === "digital";
    if (digital && !isCqaDigitalCheckoutAllowed()) {
      return NextResponse.json({ error: "Protected digital delivery is paused while customer launch checks are completed.", code: "CQA_DIGITAL_DELIVERY_PENDING" }, { status: 409 });
    }
    if (digital && context.offer_type === "subscription") return NextResponse.json({ error: "Private digital products currently support one-time purchases only." }, { status: 409 });
    if (!isNewCqaCheckoutAllowed()) {
      return NextResponse.json({ error: CQA_PRELAUNCH_CHECKOUT_MESSAGE, code: "CQA_LAUNCH_PENDING" }, { status: 503 });
    }

    const authorization = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") || "");
    let buyerUserId: string | null = null;
    let buyerEmail: string | undefined;
    if (!authorization) return NextResponse.json({ error: "Sign in to a verified buyer account before purchasing this offer.", code: "CQA_BUYER_LOGIN_REQUIRED" }, { status: 401 });
    if (authorization) {
      const { data: identity, error: identityError } = await publicClient.auth.getUser(authorization[1]);
      const buyer = identity?.user;
      if (identityError || !buyer?.id || !buyer.email || !buyer.email_confirmed_at || buyer.is_anonymous ||
          (payload.customerEmail && buyer.email.trim().toLowerCase() !== payload.customerEmail.trim().toLowerCase())) {
        return NextResponse.json({ error: "Sign in to a verified buyer account with the correct checkout email.", code: "CQA_BUYER_LOGIN_REQUIRED" }, { status: 401 });
      }
      buyerUserId = buyer.id;
      buyerEmail = buyer.email.trim().toLowerCase();
    }
    if (digital) {
      const config = offer.fulfillment_config;
      const key = config && typeof config === "object" && !Array.isArray(config) ? config.asset_key : null;
      const size = config?.asset_size_bytes;
      const contentType = config?.asset_content_type;
      const prefix = `marketplace/${context.business_id}/${context.offer_id}/`;
      if (context.offer_id !== payload.offerId || context.machine_slug !== payload.machineSlug ||
          offer.id !== context.offer_id || offer.business_id !== context.business_id || offer.machine_id !== context.machine_id ||
          typeof key !== "string" || !key.startsWith(prefix) || key.length <= prefix.length ||
          key.includes("..") || key.includes("\\") || /[?#]/.test(key) ||
          !Number.isSafeInteger(size) || size < 1 || size > MAX_MARKETPLACE_ASSET_BYTES ||
          typeof contentType !== "string" || !Object.hasOwn(MARKETPLACE_ASSET_EXTENSIONS, contentType)) {
        return NextResponse.json({ error: "This product is not ready for protected delivery." }, { status: 409 });
      }
      try {
        if (!await verifyPrivateMarketplaceAsset(key, size, contentType))
          return NextResponse.json({ error: "This product is not ready for protected delivery." }, { status: 409 });
      } catch {
        return NextResponse.json({ error: "The private product file could not be verified. Please try again later.", code: "CQA_DIGITAL_ASSET_UNAVAILABLE" }, { status: 503 });
      }
    }
    const { data: billing, error: billingError } = await getCqaSupabaseAdmin().from("cqa_plan_subscriptions")
      .select("status").eq("business_id", context.business_id).maybeSingle();
    if (billingError) throw billingError;
    if (!isActiveBillingStatus(billing?.status)) {
      return NextResponse.json({ error: "This machine is not currently accepting payments." }, { status: 409 });
    }

    if (!context.connected_account_id || !context.charges_enabled || !context.onboarding_complete) {
      return NextResponse.json(
        { error: "This business is still completing secure payment onboarding." },
        { status: 409 }
      );
    }

    const priceCents = Number(context.price_cents);
    if (!Number.isSafeInteger(priceCents) || priceCents <= 0) {
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

    if (physical || (digital && offer.inventory_tracking === true)) reservationId = await reserveProductInventory(context.offer_id, buyerUserId!, { title: context.offer_name, offerType: context.offer_type, fulfillmentType: offer.fulfillment_type, priceCents, currency: String(context.currency || "aud").toLowerCase(), terms: Object.fromEntries(["deliveryDescription", "deliveryTiming", "supportDetails", "refundTerms"].map(key => [key, offer.fulfillment_config?.[key] || ""])), ...(physical ? { shipping: offer.fulfillment_config.shipping, ...(pilotPhysicalCheckout ? { productRevision: offer.product_revision } : {}) } : {}) });
    const metadata = {
      cqaBusinessId: String(context.business_id),
      cqaMachineId: String(context.machine_id),
      cqaOfferId: String(context.offer_id),
      cqaPlan: plan,
      ...(digital ? { cqaDigitalDelivery: "1" } : {}),
      ...(physical ? { cqaPhysicalDelivery: "1" } : {}),
      ...(reservationId ? { cqaInventoryReservationId: reservationId } : {}),
      ...(buyerUserId ? { cqaBuyerUserId: buyerUserId } : {})
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

    stripeCreateAttempted = true;
    const checkout = await stripe.checkout.sessions.create(
      {
        mode: subscription ? "subscription" : "payment",
        line_items: [lineItem],
        ...(physical && shipping ? {
          expires_at: Math.floor(Date.now() / 1000) + (pilotPhysicalCheckout ? 35 : 30) * 60,
          shipping_address_collection: { allowed_countries: shipping.shippingCountries as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] },
          ...(supplier ? { phone_number_collection: { enabled: true } } : {}),
          shipping_options: [{ shipping_rate_data: { type: "fixed_amount" as const, fixed_amount: { amount: shipping.shippingRateCents, currency: String(context.currency || "aud").toLowerCase() }, display_name: supplier ? "Supplier delivery" : "Merchant delivery" } }]
        } : {}),
        customer_email: buyerEmail || payload.customerEmail,
        ...(buyerUserId ? { client_reference_id: buyerUserId } : {}),
        success_url: `${origin}/checkout/success?marketplace=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/machine/${context.machine_slug}`,
        metadata,
        ...(subscription
          ? { subscription_data: { application_fee_percent: feePercent, metadata } }
          : { payment_intent_data: { application_fee_amount: feeCents, metadata } })
      },
      { stripeAccount: context.connected_account_id, ...(reservationId ? { idempotencyKey: `cqa-product-${reservationId}`, maxNetworkRetries: 2 } : {}) }
    );

    createdCheckout = { id: checkout.id, account: context.connected_account_id };
    if (!checkout.url) throw Object.assign(new Error("Stripe checkout URL unavailable."), { status: 502 });

    if (digital || buyerUserId) {
      const { data: pendingOrder, error: bindingError } = await getCqaSupabaseAdmin().from("cqa_orders").insert({
        business_id: context.business_id, machine_id: context.machine_id, offer_id: context.offer_id,
        buyer_user_id: buyerUserId, customer_user_id: buyerUserId, customer_email: buyerEmail, amount_cents: priceCents + (shipping?.shippingRateCents || 0),
        purchase_snapshot: { title: String(context.offer_name).slice(0, 300), offerType: String(context.offer_type), fulfillmentType: String(offer.fulfillment_type || "none"), quantity: 1, unitPriceCents: priceCents, terms: Object.fromEntries(["deliveryDescription", "deliveryTiming", "supportDetails", "refundTerms"].map(key => [key, offer.fulfillment_config?.[key] || ""])), ...(shipping ? { fulfilmentType, sku, ...(pilotPhysicalCheckout ? { pilotPhysicalCheckout: true } : {}), currency: String(context.currency || "aud").toLowerCase(), shipping: { provider, rateCents: shipping.shippingRateCents, countries: shipping.shippingCountries, dispatchTiming: offer.fulfillment_config.shipping.dispatchTiming, reservationId } } : {}) },
        currency: String(context.currency || "aud").toLowerCase(), stripe_checkout_session_id: checkout.id,
        status: "pending"
      }).select("id").single();
      if (bindingError || !pendingOrder?.id) {
        throw Object.assign(new Error("Purchase binding failed."), { status: 503 });
      }
      if (reservationId) await bindProductInventory(reservationId, checkout.id, pendingOrder.id);
    }

    // The signed Connect webhook writes the paid order. This keeps anonymous
    // storefront visitors from gaining direct write access to order records.
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    // Only release an unbound hold after Stripe confirms the session cannot be paid.
    // If expiry fails, keep the hold for reconciliation; never oversell silently.
    let safeToRelease = !createdCheckout && !stripeCreateAttempted;
    if (createdCheckout) {
      try { await getStripeClient().checkout.sessions.expire(createdCheckout.id, {}, { stripeAccount: createdCheckout.account }); safeToRelease = true; } catch { /* retain reservation */ }
    }
    if (reservationId && safeToRelease) { try { await releaseUnboundProductInventory(reservationId); } catch { /* durable hold needs reconciliation */ } }
    if (error && typeof error === "object" && "status" in error && error.status === 409)
      return NextResponse.json({ error: "This product is unavailable or out of stock." }, { status: 409 });
    if (error && typeof error === "object" && "status" in error && [502, 503].includes(Number(error.status)))
      return NextResponse.json({ error: "Secure checkout could not be prepared. Please try again." }, { status: Number(error.status) });
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Checkout failed.";
    if (message.includes("STRIPE_SECRET_KEY")) {
      return NextResponse.json({ error: "CQA Stripe platform payments are not configured yet." }, { status: 503 });
    }

    return NextResponse.json({ error: "Secure checkout could not be started." }, { status: 500 });
  }
}
