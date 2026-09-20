import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicSupabaseClient, type PlanKey } from "@/lib/cqa-marketplace";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { getStripeClient } from "@/lib/stripe";
import { getPlanDefinition, getWorkerDefinition, isActiveBillingStatus } from "@/lib/cqa-billing";

const schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("plan"),
    businessId: z.string().uuid(),
    plan: z.enum(["starter", "pro", "elite"])
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
    const authClient = getPublicSupabaseClient();
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    const user = userData.user;
    if (userError || !user) return NextResponse.json({ error: "Your login session is no longer valid." }, { status: 401 });

    const admin = getCqaSupabaseAdmin();
    const { data: business, error: businessError } = await admin
      .from("cqa_businesses")
      .select("id,name,email,owner_id,plan")
      .eq("id", payload.businessId)
      .eq("owner_id", user.id)
      .single();
    if (businessError || !business) return NextResponse.json({ error: "Business not found or not owned by this account." }, { status: 403 });

    const [{ data: planBilling }, { data: workerBilling }] = await Promise.all([
      admin.from("cqa_plan_subscriptions").select("stripe_customer_id,status").eq("business_id", business.id).maybeSingle(),
      admin.from("cqa_worker_subscriptions").select("stripe_customer_id,status").eq("business_id", business.id).not("stripe_customer_id", "is", null).limit(1).maybeSingle()
    ]);
    const existingCustomerId = planBilling?.stripe_customer_id || workerBilling?.stripe_customer_id || null;

    let itemName: string;
    let amountCents: number;
    let stripePriceId: string | undefined;
    let metadata: Record<string, string>;

    if (payload.kind === "plan") {
      if (business.plan !== payload.plan) {
        return NextResponse.json({ error: "The requested plan does not match this business." }, { status: 409 });
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
        cqaOwnerId: user.id
      };
    } else {
      const worker = getWorkerDefinition(payload.workerId);
      if (!worker) return NextResponse.json({ error: "Unknown CQA AI worker." }, { status: 400 });

      const { data: currentWorker } = await admin
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
      line_items: [lineItem],
      client_reference_id: user.id,
      ...(existingCustomerId ? { customer: existingCustomerId } : { customer_email: user.email || business.email || undefined }),
      allow_promotion_codes: true,
      success_url: `${origin}/owner/dashboard?billing=success`,
      cancel_url: `${origin}/owner/dashboard?billing=cancelled`,
      metadata,
      subscription_data: { metadata }
    });

    if (!session.url) return NextResponse.json({ error: "Stripe did not return a secure checkout URL." }, { status: 502 });

    if (payload.kind === "plan") {
      const { error } = await admin.from("cqa_plan_subscriptions").upsert({
        business_id: business.id,
        plan: payload.plan,
        stripe_checkout_session_id: session.id,
        status: "incomplete",
        updated_at: new Date().toISOString()
      }, { onConflict: "business_id" });
      if (error) throw error;
    } else {
      const worker = getWorkerDefinition(payload.workerId)!;
      const { error } = await admin.from("cqa_worker_subscriptions").upsert({
        business_id: business.id,
        worker_id: payload.workerId,
        stripe_checkout_session_id: session.id,
        status: "incomplete",
        price_cents: worker[2] * 100,
        updated_at: new Date().toISOString()
      }, { onConflict: "business_id,worker_id" });
      if (error) throw error;
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid billing request." }, { status: 400 });
    const message = error instanceof Error ? error.message : "Billing checkout failed.";
    if (message.includes("STRIPE_SECRET_KEY")) return NextResponse.json({ error: "CQA billing is not configured on this deployment." }, { status: 503 });
    if (message.includes("Supabase server key")) return NextResponse.json({ error: "Secure database access is not configured." }, { status: 503 });
    console.error("[cqa-billing] checkout failed", error);
    return NextResponse.json({ error: "Secure subscription checkout could not be started." }, { status: 500 });
  }
}
