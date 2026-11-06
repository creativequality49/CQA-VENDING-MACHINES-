import { getCqaSiteUrl } from "@/lib/cqa-site-url";
import { isNewCqaCheckoutAllowed, CQA_PRELAUNCH_CHECKOUT_MESSAGE } from "@/lib/cqa-launch-gate";
import { NextResponse } from "next/server";
import { requireUserSession } from "@/lib/auth";
import { getMachine, getProductById, getProductReadiness } from "@/lib/catalog";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getStripeClient } from "@/lib/stripe";

async function assertDeliverableExists(assetKey: string) {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) throw new Error("Digital delivery storage is not configured.");
  const client = new S3Client({ endpoint: `https://${accountId}.r2.cloudflarestorage.com`, region: "auto", credentials: { accessKeyId, secretAccessKey } });
  try {
    const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: assetKey }));
    if (result.ContentLength === 0) throw new Error("Digital product file is empty.");
  } finally { client.destroy(); }
}

function getSiteUrl(req: Request) {
  return getCqaSiteUrl(req);
}

export async function POST(req: Request) {
  try {
    const session = await requireUserSession(req);
    const { productId, machineSlug } = (await req.json()) as {
      productId?: string;
      machineSlug?: string;
    };

    if (!productId || !machineSlug) {
      return NextResponse.json({ error: "Missing productId or machineSlug" }, { status: 400 });
    }

    const machine = getMachine(machineSlug);
    if (!machine || !machine.products.some(item => item.id === productId)) {
      return NextResponse.json({ error: "Product does not belong to the requested machine." }, { status: 404 });
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

    if (!isNewCqaCheckoutAllowed()) {
      return NextResponse.json({ error: CQA_PRELAUNCH_CHECKOUT_MESSAGE, code: "CQA_LAUNCH_PENDING" }, { status: 503 });
    }

    const priceId = process.env[product.stripePriceEnv]?.trim();
    if (!priceId) {
      return NextResponse.json({ error: "Stripe price is not configured for this product" }, { status: 409 });
    }

    // A configured asset key alone does not prove a downloadable object exists.
    // Fail closed before creating a paid Stripe session if storage is missing or inaccessible.
    try { await assertDeliverableExists(product.assetKey); }
    catch {
      return NextResponse.json({ error: "Secure product delivery is unavailable. No payment was taken." }, { status: 503 });
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
