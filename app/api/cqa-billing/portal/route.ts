import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicSupabaseClient } from "@/lib/cqa-marketplace";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { getStripeClient } from "@/lib/stripe";

const schema = z.object({ businessId: z.string().uuid() });

function siteUrl(req: Request) {
  return (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, "");
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const { businessId } = schema.parse(await req.json());
    const authClient = getPublicSupabaseClient();
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    const user = userData.user;
    if (userError || !user) return NextResponse.json({ error: "Your login session is no longer valid." }, { status: 401 });

    const admin = getCqaSupabaseAdmin();
    const { data: business } = await admin
      .from("cqa_businesses")
      .select("id")
      .eq("id", businessId)
      .eq("owner_id", user.id)
      .single();
    if (!business) return NextResponse.json({ error: "Business not found or not owned by this account." }, { status: 403 });

    const [{ data: planBilling }, { data: workerBilling }] = await Promise.all([
      admin.from("cqa_plan_subscriptions").select("stripe_customer_id").eq("business_id", business.id).not("stripe_customer_id", "is", null).maybeSingle(),
      admin.from("cqa_worker_subscriptions").select("stripe_customer_id").eq("business_id", business.id).not("stripe_customer_id", "is", null).limit(1).maybeSingle()
    ]);
    const customerId = planBilling?.stripe_customer_id || workerBilling?.stripe_customer_id;
    if (!customerId) return NextResponse.json({ error: "No CQA billing customer exists for this business yet." }, { status: 409 });

    const portal = await getStripeClient().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl(req)}/owner/dashboard`
    });
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid billing request." }, { status: 400 });
    console.error("[cqa-billing] portal failed", error);
    return NextResponse.json({ error: "Billing management could not be opened." }, { status: 500 });
  }
}
