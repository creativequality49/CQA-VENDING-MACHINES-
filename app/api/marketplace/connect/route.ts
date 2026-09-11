import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripeClient } from "@/lib/stripe";
import { getPublicSupabaseClient } from "@/lib/cqa-marketplace";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";

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
    const authClient = getPublicSupabaseClient();
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    const user = userData.user;
    if (userError || !user) return NextResponse.json({ error: "Your login session is no longer valid." }, { status: 401 });

    const admin = getCqaSupabaseAdmin();
    const { data: business, error: businessError } = await admin
      .from("cqa_businesses")
      .select("id,name,email,owner_id")
      .eq("id", businessId)
      .eq("owner_id", user.id)
      .single();
    if (businessError || !business) return NextResponse.json({ error: "Business not found or not owned by this account." }, { status: 403 });

    const stripe = getStripeClient();
    const { data: existing } = await admin.from("cqa_connected_accounts").select("stripe_account_id").eq("business_id", business.id).maybeSingle();
    let stripeAccountId = existing?.stripe_account_id as string | null | undefined;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "standard",
        country: "AU",
        email: business.email || user.email || undefined,
        business_profile: { name: business.name },
        metadata: { cqaBusinessId: business.id, cqaOwnerId: user.id }
      });
      stripeAccountId = account.id;
      const { error: saveError } = await admin.from("cqa_connected_accounts").upsert({ business_id: business.id, stripe_account_id: stripeAccountId, details_submitted: account.details_submitted, charges_enabled: account.charges_enabled, payouts_enabled: account.payouts_enabled, onboarding_complete: Boolean(account.details_submitted && account.charges_enabled) });
      if (saveError) return NextResponse.json({ error: "Stripe account was created but CQA could not save the connection." }, { status: 500 });
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
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid business request." }, { status: 400 });
    const message = error instanceof Error ? error.message : "Unable to start Stripe Connect onboarding.";
    if (message.includes("STRIPE_SECRET_KEY")) return NextResponse.json({ error: "CQA Stripe platform payments are not configured yet." }, { status: 503 });
    if (message.includes("Supabase server key")) return NextResponse.json({ error: "CQA secure database access is not configured on the deployment." }, { status: 503 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
