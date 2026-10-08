import { sendCqaTransactionalEmail } from "@/lib/cqa-transactional-email";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCqaOwner } from "@/lib/cqa-owner-auth";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { isActiveBillingStatus } from "@/lib/cqa-billing";
import { getStripeClient } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const { businessId } = z.object({ businessId: z.string().uuid() }).parse(await req.json());
    const { business, user } = await requireCqaOwner(req, businessId);
    const admin = getCqaSupabaseAdmin();
    const [billing, connection, machine, offers] = await Promise.all([
      admin.from("cqa_plan_subscriptions").select("status").eq("business_id", business.id).maybeSingle(),
      admin.from("cqa_connected_accounts").select("stripe_account_id").eq("business_id", business.id).maybeSingle(),
      admin.from("cqa_machines").select("id,slug,title,customization").eq("business_id", business.id).single(),
      admin.from("cqa_offers").select("id").eq("business_id", business.id).eq("active", true).limit(1)
    ]);
    const failed = [billing, connection, machine, offers].find((result) => result.error);
    if (failed?.error) throw failed.error;
    if (!isActiveBillingStatus(billing.data?.status)) return NextResponse.json({ error: "Activate your machine plan before publishing." }, { status: 409 });
    if (!machine.data?.title || !offers.data?.length) return NextResponse.json({ error: "Add and activate your first offer before publishing." }, { status: 409 });
    if (!connection.data?.stripe_account_id) return NextResponse.json({ error: "Connect Stripe before publishing." }, { status: 409 });
    const account = await getStripeClient().accounts.retrieve(connection.data.stripe_account_id);
    if (account.deleted || account.metadata?.cqaBusinessId !== business.id || !account.charges_enabled || !account.details_submitted) {
      return NextResponse.json({ error: "Complete Stripe payment onboarding before publishing." }, { status: 409 });
    }
    const updatedAt = new Date().toISOString();
    const { error: businessError } = await admin.from("cqa_businesses").update({ status: "live", updated_at: updatedAt }).eq("id", business.id);
    if (businessError) throw businessError;
    const { error: machineError } = await admin.from("cqa_machines").update({ status: "live", updated_at: updatedAt }).eq("id", machine.data.id);
    if (machineError) throw machineError;
    let notificationWarning: string | undefined;
    // Read after publication, so edits that arrived before the status update
    // are included in the snapshot used by the confirmation marker.
    const notificationSnapshot = await admin.from("cqa_machines").select("customization,updated_at").eq("id", machine.data.id).single();
    if (notificationSnapshot.error) return NextResponse.json({ ok: true, url: `/machine/${machine.data.slug}`, notificationWarning: "Your machine is live. The confirmation email is pending; publish again to retry it." });
    const customization = (notificationSnapshot.data.customization || {}) as Record<string, unknown>;
    if (!customization.publishConfirmationSentAt) {
      try {
        if (!user.email) throw new Error("Owner email unavailable.");
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
        if (!siteUrl) throw new Error("Site URL unavailable.");
        await sendCqaTransactionalEmail(`machine/${machine.data.id}/first-publish`, user.email, "Your CQA machine is published", `Your ${business.name} machine is live: ${siteUrl}/machine/${machine.data.slug}\n\nManage offers, orders and your included services from ${siteUrl}/owner/dashboard.`);
        const { data: notifiedMachine, error: notificationError } = await admin.from("cqa_machines").update({ customization: { ...customization, publishConfirmationSentAt: updatedAt } })
          .eq("id", machine.data.id).eq("updated_at", notificationSnapshot.data.updated_at).select("id").maybeSingle();
        if (notificationError || !notifiedMachine) throw notificationError || new Error("Machine changed while confirmation was being sent.");
      } catch {
        notificationWarning = "Your machine is live. The confirmation email is pending; publish again to retry it.";
      }
    }
    return NextResponse.json({ ok: true, url: `/machine/${machine.data.slug}`, notificationWarning });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid publication request." }, { status: 400 });
    const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
    console.error("[owner/publish] failed", error);
    return NextResponse.json({ error: status === 500 ? "Your machine could not be published. Please try again." : (error as Error).message }, { status });
  }
}
