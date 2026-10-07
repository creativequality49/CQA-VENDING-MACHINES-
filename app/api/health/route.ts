import { NextResponse } from "next/server";
import { getPublicSupabaseClient } from "@/lib/cqa-marketplace";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ComponentStatus = "ok" | "missing" | "error";

function configured(value: string | undefined): ComponentStatus {
  return value?.trim() ? "ok" : "missing";
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

  try {
    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "https://rjxiuukphwybujuclenn.supabase.co";
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/cqa-stripe-webhook`, {
      method: "GET",
      cache: "no-store"
    });
    stripeWebhookEdge = response.status === 405 ? "ok" : "error";
  } catch {
    stripeWebhookEdge = "error";
  }

  const stripe = configured(process.env.STRIPE_SECRET_KEY);
  const ai = configured(process.env.CQA_CHAT_API_KEY || process.env.OPENAI_API_KEY);
  const embeddings = configured(
    process.env.CQA_EMBEDDING_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.CQA_CHAT_API_KEY
  );
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
    connectWebhookSecret === "ok";

  // Configuration checks do not prove delivery or successful real payments.
  const launchConfigurationReady = commerceReady && email === "ok" && emailSender === "ok";

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
      aiWorkforceReady
    },
    {
      status: launchConfigurationReady ? 200 : 503,
      headers: { "Cache-Control": "no-store" }
    }
  );
}
