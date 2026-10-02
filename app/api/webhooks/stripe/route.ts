import { POST as handleLegacyStripeWebhook } from "@/app/api/stripe/webhook/route";

// Canonical Stripe event destination. Keep the original route active because
// existing Stripe event destinations may still use it during a safe migration.
export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleLegacyStripeWebhook(request);
}
