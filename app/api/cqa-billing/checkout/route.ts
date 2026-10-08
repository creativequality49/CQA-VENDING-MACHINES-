import { getCqaChatProvider } from "@/lib/cqa-ai-provider";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAuthenticatedSupabaseClient,
  getPublicSupabaseClient,
  type PlanKey
} from "@/lib/cqa-marketplace";
import { getStripeClient } from "@/lib/stripe";
import { getPlanDefinition, getWorkerDefinition, isActiveBillingStatus } from "@/lib/cqa-billing";

const schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("plan"),
    businessId: z.string().uuid(),
    plan: z.enum(["starter", "pro", "elite"]),
    launchPackage: z.boolean().optional().default(false)
  }),
  z.object({
    kind: z.literal("worker"),
    businessId: z.string().uuid(),
    workerId: z.string().min(1).max(80)
  })
]);

function siteUrl(req: Request) {
  return (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, "");
}

function planPriceId(plan: PlanKey) {
  if (plan === "starter") return process.env.STRIPE_PRICE_BASIC;
  if (plan === "pro") return process.env.STRIPE_PRICE_PRO;
  return process.env.STRIPE_PRICE_ELITE;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const payload = schema.parse(await req.json());
    const publicClient = getPublicSupabaseClient();
    const { data: userData, error: userError } = await publicClient.auth.getUser(token);
    const user = userData.user;
    if (userError || !user) {
      return NextResponse.json({ error: "Your login session is no longer valid." }, { status: 401 });
    }

    const ownerClient = getAuthenticatedSupabaseClient(token);
    const { data: business, error: businessError } = await ownerClient
      .from("cqa_businesses")
      .select("id,name,email,owner_id,plan")
      .eq("id", payload.businessId)
      .eq("owner_id", user.id)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ error: "Business not found or not owned by this account." }, { status: 403 });
    }

    const [{ data: planBilling }, { data: workerBilling }] = await Promise.all([
      ownerClient
        .from("cqa_plan_subscriptions")
        .select("stripe_customer_id,status")
        .eq("business_id", business.id)
        .maybeSingle(),
      ownerClient
        .from("cqa_worker_subscriptions")
        .select("stripe_customer_id,status")
        .eq("business_id", business.id)
        .not("stripe_customer_id", "is", null)
        .limit(1)
        .maybeSingle()
    ]);

    const existingCustomerId = planBilling?.stripe_customer_id || workerBilling?.stripe_customer_id || null;
    const aiWorkforceReady = Boolean(
      getCqaChatProvider() &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)
    );

    if (payload.kind === "worker" && !aiWorkforceReady) {
      return NextResponse.json(
        { error: "AI worker paid activations are temporarily paused while the production AI provider is being activated." },
        { status: 503 }
      );
    }

    let itemName: string;
    let amountCents: number;
    let stripePriceId: string | undefined;
    let metadata: Record<string, string>;

    if (payload.kind === "plan") {
      if (payload.launchPackage && payload.plan !== "pro") {
        return NextResponse.json({ error: "The Launch Package is available with Pro." }, { status: 400 });
      }
      if (isActiveBillingStatus(planBilling?.status)) {
        return NextResponse.json({ error: "This machine plan is already active." }, { status: 409 });
      }

      const plan = getPlanDefinition(payload.plan);
      if (!plan) return NextResponse.json({ error: "Unknown CQA plan." }, { status: 400 });

      itemName = `CQA ${plan.name} Business Machine`;
      amountCents = plan.price * 100;
      stripePriceId = planPriceId(payload.plan);
      metadata = {
        cqaBillingType: "plan",
        cqaBusinessId: business.id,
        cqaPlan: payload.plan,
        cqaOwnerId: user.id,
        cqaLaunchPackage: String(payload.launchPackage)
      };
    } else {
      if (!["receptionist", "sales", "marketing"].includes(payload.workerId)) return NextResponse.json({ error: "This worker is unavailable for new subscriptions." }, { status: 409 });
      const worker = getWorkerDefinition(payload.workerId);
      if (!worker) return NextResponse.json({ error: "Unknown CQA AI worker." }, { status: 400 });

      const { data: currentWorker } = await ownerClient
        .from("cqa_worker_subscriptions")
        .select("status")
        .eq("business_id", business.id)
        .eq("worker_id", payload.workerId)
        .maybeSingle();

      if (isActiveBillingStatus(currentWorker?.status)) {
        return NextResponse.json({ error: "This AI worker subscription is already active." }, { status: 409 });
      }

      itemName = `CQA ${worker[1]}`;
      amountCents = worker[2] * 100;
      const envKey = `STRIPE_PRICE_WORKER_${payload.workerId.toUpperCase().replaceAll("-", "_")}`;
      stripePriceId = process.env[envKey];
      metadata = {
        cqaBillingType: "worker",
        cqaBusinessId: business.id,
        cqaWorkerId: payload.workerId,
        cqaOwnerId: user.id
      };
    }

    const stripe = getStripeClient();
    if (stripePriceId) {
      const configuredPrice = await stripe.prices.retrieve(stripePriceId);
      if (!configuredPrice.active || configuredPrice.currency !== "aud" || configuredPrice.unit_amount !== amountCents || configuredPrice.recurring?.interval !== "month" || configuredPrice.recurring.interval_count !== 1) {
        return NextResponse.json({ error: "The configured Stripe price does not match the current monthly AUD offer. Contact CQA support." }, { status: 503 });
      }
    }
    const origin = siteUrl(req);
    const lineItem = stripePriceId
      ? { price: stripePriceId, quantity: 1 }
      : {
          price_data: {
            currency: "aud",
            unit_amount: amountCents,
            recurring: { interval: "month" as const },
            product_data: { name: itemName }
          },
          quantity: 1
        };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [lineItem, ...(payload.kind === "plan" && payload.launchPackage ? [{
        price_data: {
          currency: "aud",
          unit_amount: 99700,
          product_data: { name: "CQA Pro Launch Package — one-time implementation" }
        },
        quantity: 1
      }] : [])],
      client_reference_id: user.id,
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : { customer_email: user.email || business.email || undefined }),
      allow_promotion_codes: true,
      success_url:
        payload.kind === "plan"
          ? `${origin}/owner/setup?billing=success&session_id={CHECKOUT_SESSION_ID}`
          : `${origin}/owner/dashboard?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:
        payload.kind === "plan"
          ? `${origin}/owner/setup?billing=cancelled`
          : `${origin}/owner/dashboard?billing=cancelled`,
      metadata,
      subscription_data: { metadata }
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a secure checkout URL." }, { status: 502 });
    }

    // Subscription state is written only from the signed Stripe webhook running
    // inside Supabase. The browser never receives permission to self-activate.
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid billing request." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Billing checkout failed.";
    if (message.includes("STRIPE_SECRET_KEY")) {
      return NextResponse.json({ error: "CQA billing is not configured on this deployment." }, { status: 503 });
    }

    console.error("[cqa-billing] checkout failed", error);
    return NextResponse.json({ error: "Secure subscription checkout could not be started." }, { status: 500 });
  }
}
