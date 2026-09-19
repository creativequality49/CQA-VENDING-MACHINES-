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
  const healthy = database === "ok" && stripe === "ok" && platformWebhook === "ok" && connectWebhook === "ok";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      database,
      stripe,
      stripePlatformWebhook: platformWebhook,
      stripeConnectWebhook: connectWebhook,
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
