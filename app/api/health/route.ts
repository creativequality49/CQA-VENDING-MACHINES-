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

  const commerceReady =
    database === "ok" &&
    stripe === "ok" &&
    stripeWebhookEdge === "ok";

  const aiWorkforceReady =
    database === "ok" &&
    legacyServiceRole === "ok" &&
    ai === "ok";

  return NextResponse.json(
    {
      status: commerceReady ? "ok" : "degraded",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      database,
      stripe,
      stripeWebhookEdge,
      legacyServiceRole,
      ai,
      embeddings,
      email,
      commerceReady,
      aiWorkforceReady
    },
    {
      status: commerceReady ? 200 : 503,
      headers: { "Cache-Control": "no-store" }
    }
  );
}
