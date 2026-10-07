import "server-only";
import type Stripe from "stripe";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";

export async function claimCqaWebhookEvent(event: Stripe.Event) {
  const admin = getCqaSupabaseAdmin();
  const claimedAt = new Date().toISOString();
  const { error } = await admin.from("cqa_stripe_webhook_events").insert({
    event_id: event.id, event_type: event.type, status: "processing", processed_at: claimedAt
  });
  if (!error) return { duplicate: false, claimedAt };
  if (error.code !== "23505") throw error;
  const { data: existing, error: readError } = await admin.from("cqa_stripe_webhook_events")
    .select("status,processed_at").eq("event_id", event.id).single();
  if (readError) throw readError;
  if (existing.status === "processed") return { duplicate: true, claimedAt: null };
  // A crashed request may be reclaimed after its processing lease expires.
  const expired = existing.processed_at && Date.parse(existing.processed_at) < Date.now() - 10 * 60 * 1000;
  if (existing.status === "failed" || (existing.status === "processing" && expired)) {
    let query = admin.from("cqa_stripe_webhook_events").update({ status: "processing", last_error: null, processed_at: claimedAt })
      .eq("event_id", event.id).eq("status", existing.status);
    query = existing.processed_at ? query.eq("processed_at", existing.processed_at) : query.is("processed_at", null);
    const { data: reclaimed, error: reclaimError } = await query.select("event_id").maybeSingle();
    if (reclaimError) throw reclaimError;
    if (reclaimed) return { duplicate: false, claimedAt };
  }
  throw new Error("Webhook event is already being processed.");
}

export async function finishCqaWebhookEvent(eventId: string, claimedAt: string, errorMessage?: string) {
  const { error } = await getCqaSupabaseAdmin().from("cqa_stripe_webhook_events")
    .update({ status: errorMessage ? "failed" : "processed", last_error: errorMessage?.slice(0, 500) || null })
    .eq("event_id", eventId).eq("status", "processing").eq("processed_at", claimedAt);
  if (error) throw error;
}
