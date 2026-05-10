import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  if (!_stripe) {
    _stripe = new Stripe(key, { apiVersion: "2024-06-20" });
  }

  return _stripe;
}

export function getPriceIdForTier(tier: string) {
  const map: Record<string, string | undefined> = {
    basic: process.env.STRIPE_PRICE_BASIC,
    pro: process.env.STRIPE_PRICE_PRO,
    elite: process.env.STRIPE_PRICE_ELITE,
    subscription: process.env.STRIPE_PRICE_SUBSCRIPTION,
  };

  return map[tier];
}
