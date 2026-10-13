import Stripe from "stripe";

let _stripe: Stripe | null = null;

export class StripeConfigurationError extends Error {
  constructor() {
    super("STRIPE_SECRET_KEY is missing or malformed.");
    this.name = "StripeConfigurationError";
  }
}

// Shape validation only: this never proves that a key is active or permitted.
export function getStripeKeyConfigurationStatus(key = process.env.STRIPE_SECRET_KEY): "ok" | "missing" | "error" {
  if (!key) return "missing";
  return /^(?:(?:sk|rk)_(?:test|live)|rkcs_test)_[A-Za-z0-9]{16,}$/.test(key) ? "ok" : "error";
}

export function isStripeConfigurationError(error: unknown) {
  return error instanceof StripeConfigurationError ||
    (typeof error === "object" && error !== null && "type" in error && error.type === "StripeAuthenticationError");
}

export function sanitizedStripeError(error: unknown) {
  const value = (typeof error === "object" && error !== null ? error : {}) as { type?: unknown; name?: unknown; code?: unknown; statusCode?: unknown };
  const type = typeof value.type === "string" ? value.type : value.name;
  const code = typeof value.code === "string" && /^[a-z][a-z0-9_]{0,63}$/.test(value.code) && !/(?:sk|rk|rkcs|pk|whsec)_/.test(value.code) ? value.code : undefined;
  return {
    type: typeof type === "string" && ["Error", "StripeError", "StripeAPIError", "StripeConnectionError", "StripeAuthenticationError", "StripeInvalidRequestError", "StripePermissionError", "StripeRateLimitError", "StripeIdempotencyError", "StripeCardError", "StripeConfigurationError"].includes(type) ? type : "UnknownError",
    ...(code ? { code } : {}),
    ...(typeof value.statusCode === "number" && Number.isInteger(value.statusCode) && value.statusCode >= 100 && value.statusCode <= 599 ? { statusCode: value.statusCode } : {})
  };
}

export function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (getStripeKeyConfigurationStatus(key) !== "ok" || !key) {
    throw new StripeConfigurationError();
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
