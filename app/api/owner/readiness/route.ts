import { isCqaPhysicalPilotEnabled } from "@/lib/cqa-launch-gate";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCqaOwner } from "@/lib/cqa-owner-auth";
import { evaluateCqaMachineReadiness, type MachineReadinessOffer } from "@/lib/cqa-machine-readiness";
import { isActiveBillingStatus } from "@/lib/cqa-billing";
import { getStripeClient } from "@/lib/stripe";
import { getCqaSiteUrl } from "@/lib/cqa-site-url";
import { isCqaDigitalCheckoutAllowed, isCqaPhysicalCheckoutAllowed, isNewCqaCheckoutAllowed } from "@/lib/cqa-launch-gate";
import { verifyPrivateMarketplaceAsset } from "@/lib/storage";
export const runtime = "nodejs";
export async function GET(req: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const raw = new URL(req.url).searchParams.get("businessId");
    const id = raw ? z.string().uuid().parse(raw) : undefined;
    const { business, admin } = await requireCqaOwner(req, id);
    const [machine, offers, billing, connection] = await Promise.all([
      admin.from("cqa_machines").select("id,title").eq("business_id", business.id).single(),
      admin.from("cqa_offers").select(isCqaPhysicalPilotEnabled() ? "id,machine_id,name,active,price_cents,offer_type,fulfillment_type,fulfillment_config,shipping_required,inventory_tracking,inventory_quantity,fulfilment_type,supplier_provider,supplier_variant_sku,external_url" : "id,machine_id,name,active,price_cents,offer_type,fulfillment_type,fulfillment_config,shipping_required,inventory_tracking,inventory_quantity").eq("business_id", business.id).eq("active", true),
      admin.from("cqa_plan_subscriptions").select("status").eq("business_id", business.id).maybeSingle(),
      admin.from("cqa_connected_accounts").select("stripe_account_id").eq("business_id", business.id).maybeSingle()
    ]);
    if ([machine, offers, billing, connection].some(result => result.error) || !machine.data) throw Error("Readiness data unavailable");
    let siteUrl: string | undefined; try { siteUrl = getCqaSiteUrl(req); } catch { /* returned as actionable check */ }
    const readiness = await evaluateCqaMachineReadiness({ businessId: business.id, machineId: machine.data.id, title: machine.data.title, offers: (offers.data || []) as unknown as MachineReadinessOffer[], siteUrl, environment: process.env, verifyAsset: verifyPrivateMarketplaceAsset });
    if (!isActiveBillingStatus(billing.data?.status)) readiness.checks.push({ code: "ACTIVE_PLAN_REQUIRED", message: "Activate your machine plan before publishing." });
    if (!connection.data?.stripe_account_id) readiness.checks.push({ code: "STRIPE_CONNECTION_REQUIRED", message: "Connect the business Stripe account." });
    else {
      try {
        const account = await getStripeClient().accounts.retrieve(connection.data.stripe_account_id);
        if (account.deleted || account.metadata?.cqaBusinessId !== business.id || !account.charges_enabled || !account.details_submitted)
          readiness.checks.push({ code: "STRIPE_ONBOARDING_REQUIRED", message: "Complete Stripe payment onboarding for this business." });
      } catch { readiness.checks.push({ code: "STRIPE_UNVERIFIED", message: "Stripe account readiness could not be verified. Retry after checking the connection." }); }
    }
    return NextResponse.json({ ...readiness, merchantReady: readiness.checks.length === 0, globalCheckoutHeld: !isNewCqaCheckoutAllowed(), digitalCheckoutHeld: !isCqaDigitalCheckoutAllowed(), physicalCheckoutHeld: !isCqaPhysicalCheckoutAllowed() }, { headers });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : typeof (error as { status?: number })?.status === "number" ? (error as { status: number }).status : 503;
    return NextResponse.json({ error: status === 503 ? "Launch readiness could not be checked. Refresh before publishing." : error instanceof z.ZodError ? "Choose a valid business." : (error as Error).message }, { status, headers });
  }
}
