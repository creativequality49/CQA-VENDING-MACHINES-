import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripeClient } from "@/lib/stripe";
import {
  getAuthenticatedSupabaseClient,
  getPublicSupabaseClient
} from "@/lib/cqa-marketplace";

const bodySchema = z.object({ businessId: z.string().uuid() });

function siteUrl(req: Request) {
  return (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, "");
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const { businessId } = bodySchema.parse(await req.json());
    const publicClient = getPublicSupabaseClient();
    const { data: userData, error: userError } = await publicClient.auth.getUser(token);
    const user = userData.user;
    if (userError || !user) {
      return NextResponse.json({ error: "Your login session is no longer valid." }, { status: 401 });
    }

    const ownerClient = getAuthenticatedSupabaseClient(token);
    const { data: business, error: businessError } = await ownerClient
      .from("cqa_businesses")
      .select("id,name,email,owner_id")
      .eq("id", businessId)
      .eq("owner_id", user.id)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ error: "Business not found or not owned by this account." }, { status: 403 });
    }

    const { data: planBilling } = await ownerClient
      .from("cqa_plan_subscriptions")
      .select("status")
      .eq("business_id", business.id)
      .maybeSingle();

    if (!planBilling || !["active", "trialing"].includes(planBilling.status)) {
      return NextResponse.json(
        { error: "Activate the CQA machine plan before connecting customer payments." },
        { status: 402 }
      );
    }

    const stripe = getStripeClient();
    const { data: existing } = await ownerClient
      .from("cqa_connected_accounts")
      .select("stripe_account_id")
      .eq("business_id", business.id)
      .maybeSingle();

    let stripeAccountId = existing?.stripe_account_id as string | null | undefined;

    if (stripeAccountId) {
      const account = await stripe.accounts.retrieve(stripeAccountId);
      if (account.deleted || account.metadata?.cqaBusinessId !== business.id) {
        return NextResponse.json(
          { error: "The saved Stripe connection could not be verified. Contact CQA support." },
          { status: 409 }
        );
      }
    } else {
      const account = await stripe.accounts.create({
        type: "standard",
        country: "AU",
        email: business.email || user.email || undefined,
        business_profile: { name: business.name },
        metadata: { cqaBusinessId: business.id, cqaOwnerId: user.id }
      });

      stripeAccountId = account.id;

      // Owners may only insert a pending connection. Stripe-signed webhook events
      // are the only path that can mark the account as payment-ready.
      const { error: saveError } = await ownerClient.from("cqa_connected_accounts").insert({
        business_id: business.id,
        stripe_account_id: stripeAccountId,
        details_submitted: false,
        charges_enabled: false,
        payouts_enabled: false,
        onboarding_complete: false
      });

      if (saveError && saveError.code !== "23505") {
        return NextResponse.json(
          { error: "Stripe account was created but CQA could not save the pending connection." },
          { status: 500 }
        );
      }
    }

    const origin = siteUrl(req);
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${origin}/owner/dashboard?stripe=refresh`,
      return_url: `${origin}/owner/dashboard?stripe=return`,
      type: "account_onboarding"
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid business request." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Unable to start Stripe Connect onboarding.";
    if (message.includes("STRIPE_SECRET_KEY")) {
      return NextResponse.json({ error: "CQA Stripe platform payments are not configured yet." }, { status: 503 });
    }

    console.error("[cqa-connect] onboarding failed", error);
    return NextResponse.json({ error: "Unable to start secure Stripe onboarding." }, { status: 500 });
  }
}
