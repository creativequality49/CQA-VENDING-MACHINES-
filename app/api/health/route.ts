import { getCqaPreviewIsolationDiagnostics } from "@/lib/cqa-preview-isolation";
import { getStripeKeyConfigurationStatus } from "@/lib/stripe";
import { getCqaChatProvider, getCqaEmbeddingProvider } from "@/lib/cqa-ai-provider";
import { NextResponse } from "next/server";
import { getPublicSupabaseClient } from "@/lib/cqa-marketplace";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";
import { requireCqaSupabaseUrl } from "@/lib/cqa-supabase-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ComponentStatus = "ok" | "missing" | "error";

function configured(value: string | undefined): ComponentStatus {
  return value?.trim() ? "ok" : "missing";
}

async function isolatedWebhookResponds(origin: string): Promise<boolean> {
  const checks = await Promise.all(["platform", "connect"].map(async route => {
    // GET returns 405 even on unknown relay paths. An empty unsigned POST
    // reaches each route's signature guard and cannot forward a Stripe event.
    const response = await fetch(`${origin}/functions/v1/cqa-test-webhook/${route}`, {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000)
    });
    if (response.status !== 401 || !response.headers.get("content-type")?.startsWith("text/plain")) {
      await response.body?.cancel();
      return false;
    }
    return (await response.text()) === "Invalid signature";
  }));
  return checks.every(Boolean);
}

export async function GET() {
  let database: ComponentStatus = "missing";
  let legacyServiceRole: ComponentStatus = "missing";
  let stripeWebhookEdge: ComponentStatus = "missing";
  let commerceSchema: ComponentStatus = "missing";

  try {
    const publicClient = getPublicSupabaseClient();
    const { error } = await publicClient.from("cqa_businesses").select("id").limit(1);
    database = error ? "error" : "ok";
  } catch {
    database = "error";
  }

  try {
    const admin = getCqaSupabaseAdmin();
    const { error } = await admin.from("cqa_businesses").select("id").limit(1);
    legacyServiceRole = error ? "error" : "ok";
    if (!error) {
      const checks = await Promise.all([
        admin.from("cqa_orders").select("id,stripe_checkout_session_id,status,amount_cents,currency").limit(1),
        admin.from("cqa_plan_subscriptions").select("business_id,stripe_subscription_id,status").limit(1),
        admin.from("cqa_stripe_webhook_events").select("event_id,status,processed_at,last_error").limit(1)
      ]);
      commerceSchema = checks.some(check => check.error) ? "error" : "ok";
    }
  } catch {
    legacyServiceRole = "missing";
  }

  const previewIsolation = process.env.VERCEL_ENV === "preview"
    ? await getCqaPreviewIsolationDiagnostics({ ...process.env, NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL })
    : undefined;
  const testPreview = previewIsolation && (previewIsolation.acknowledgementMatches ||
    previewIsolation.serverDatabaseMatches || previewIsolation.browserDatabaseMatches) ? previewIsolation : undefined;

  try {
    const supabaseUrl = requireCqaSupabaseUrl(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    );
    if (testPreview) {
      const isolated = testPreview.serverDatabaseMatches && testPreview.browserDatabaseMatches && testPreview.acknowledgementMatches;
      stripeWebhookEdge = isolated && (await isolatedWebhookResponds(supabaseUrl)) ? "ok" : "error";
    } else {
      const response = await fetch(`${supabaseUrl}/functions/v1/cqa-stripe-webhook`, {
        method: "GET", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000)
      });
      await response.body?.cancel();
      stripeWebhookEdge = response.status === 405 ? "ok" : "error";
    }
  } catch {
    stripeWebhookEdge = "error";
  }

  const stripe = getStripeKeyConfigurationStatus();
  const ai: ComponentStatus = (await getCqaChatProvider()) ? "ok" : "missing";
  const embeddings: ComponentStatus = (await getCqaEmbeddingProvider()) ? "ok" : "missing";
  const email = configured(process.env.RESEND_API_KEY);
  const emailSender = configured(process.env.CQA_AUTOMATION_FROM_EMAIL || process.env.CQA_EMAIL_FROM);
  const platformWebhookSecret = configured(process.env.STRIPE_WEBHOOK_SECRET);
  const connectWebhookSecret = configured(process.env.STRIPE_CONNECT_WEBHOOK_SECRET);

  const commerceReady =
    database === "ok" &&
    stripe === "ok" &&
    legacyServiceRole === "ok" &&
    commerceSchema === "ok" &&
    platformWebhookSecret === "ok" &&
    connectWebhookSecret === "ok" &&
    (!testPreview || (stripeWebhookEdge === "ok" && testPreview.stripeTestAccountMatches));

  // Configuration checks do not prove delivery or successful real payments.
  const launchConfigurationReady = commerceReady && email === "ok" && emailSender === "ok" &&
    (!testPreview || (testPreview.r2Configured && testPreview.r2PublicUrlAbsent));

  const aiWorkforceReady =
    database === "ok" &&
    legacyServiceRole === "ok" &&
    ai === "ok";

  return NextResponse.json(
    {
      status: launchConfigurationReady ? "ok" : "degraded",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      database,
      stripe,
      stripeWebhookEdge,
      legacyServiceRole,
      commerceSchema,
      ai,
      embeddings,
      email,
      emailSender,
      platformWebhookSecret,
      connectWebhookSecret,
      launchConfigurationReady,
      commerceReady,
      aiWorkforceReady,
      ...(previewIsolation ? { previewIsolation } : {})
    },
    {
      status: launchConfigurationReady ? 200 : 503,
      headers: { "Cache-Control": "no-store" }
    }
  );
}
