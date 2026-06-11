import { getSupabaseAdminClient } from "@/lib/supabase";

export type EntitlementSource = "checkout" | "subscription" | "manual";
export type EntitlementStatus = "active" | "inactive" | "expired" | "cancelled";

export async function hasEntitlement(userId: string, productId: string) {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("customer_entitlements")
    .select("id")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .limit(1);

  if (error) throw new Error(error.message);
  return Boolean(data?.length);
}

export async function upsertCheckoutEntitlement(input: {
  userId: string;
  productId: string;
  tier: string;
  machineSlug: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeSessionId?: string | null;
  source: EntitlementSource;
  status?: EntitlementStatus;
}) {
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase.from("customer_entitlements").upsert(
    {
      user_id: input.userId,
      product_id: input.productId,
      tier_key: input.tier,
      machine_slug: input.machineSlug,
      stripe_customer_id: input.stripeCustomerId ?? null,
      stripe_subscription_id: input.stripeSubscriptionId ?? null,
      stripe_checkout_session_id: input.stripeSessionId ?? null,
      source: input.source,
      status: input.status ?? "active",
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id,product_id,source" }
  );

  if (error) throw new Error(error.message);
}

export async function updateSubscriptionEntitlement(input: {
  userId: string;
  stripeSubscriptionId: string;
  status: EntitlementStatus;
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("customer_entitlements")
    .update({
      status: input.status,
      expires_at: input.status === "active" ? null : new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("user_id", input.userId)
    .eq("stripe_subscription_id", input.stripeSubscriptionId);

  if (error) throw new Error(error.message);
}

export async function hasProcessedStripeEvent(eventId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("stripe_events").select("id").eq("id", eventId).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function markStripeEventProcessed(eventId: string, eventType: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("stripe_events").insert({ id: eventId, event_type: eventType });
  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function logDownload(input: {
  userId: string;
  productId: string;
  assetKey: string;
  status: "signed" | "denied" | "error";
  expiresAt?: string | null;
  userAgent?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("download_logs").insert({
    user_id: input.userId,
    product_id: input.productId,
    asset_key: input.assetKey,
    signed_url_expires_at: input.expiresAt ?? null,
    user_agent: input.userAgent ?? null,
    metadata: { status: input.status }
  });

  if (error) throw new Error(error.message);
}
