import { NextResponse } from "next/server";
import { getCqaSupabaseAdmin } from "@/lib/cqa-supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ComponentStatus = "ok" | "missing" | "error";

function configured(value: string | undefined): ComponentStatus {
  return value?.trim() ? "ok" : "missing";
}

export async function GET() {
  let database: ComponentStatus = "missing";

  try {
    const admin = getCqaSupabaseAdmin();
    const { error } = await admin.from("cqa_businesses").select("id").limit(1);
    database = error ? "error" : "ok";
  } catch {
    database = "missing";
  }

  const stripe = configured(process.env.STRIPE_SECRET_KEY);
  const platformWebhook = configured(process.env.STRIPE_WEBHOOK_SECRET);
  const connectWebhook = configured(process.env.STRIPE_CONNECT_WEBHOOK_SECRET);
  const ai = configured(process.env.CQA_CHAT_API_KEY || process.env.OPENAI_API_KEY);
  const embeddings = configured(
    process.env.CQA_EMBEDDING_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.CQA_CHAT_API_KEY
  );
  const email = configured(process.env.RESEND_API_KEY);

  const commerceReady =
    database === "ok" &&
    stripe === "ok" &&
    platformWebhook === "ok" &&
    connectWebhook === "ok";
  const aiWorkforceReady = database === "ok" && ai === "ok";

  return NextResponse.json(
    {
      status: commerceReady ? "ok" : "degraded",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      database,
      stripe,
      stripePlatformWebhook: platformWebhook,
      stripeConnectWebhook: connectWebhook,
      ai,
      embeddings,
      email,
      commerceReady,
      aiWorkforceReady
    },
    { status: commerceReady ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
