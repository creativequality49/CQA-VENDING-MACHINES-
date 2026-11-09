// Server-only launch control. Test credentials allow isolated verification;
// production payment creation requires an explicit, reviewed launch decision.
export function isNewCqaCheckoutAllowed() {
  if (process.env.CQA_CUSTOMER_LAUNCH_APPROVED === "true") return true;
  return /^(?:sk_test_|rk_test_|rkcs_test_)/.test(process.env.STRIPE_SECRET_KEY || "");
}

// Catalogue links are already-live Stripe Payment Links. Sandbox credentials
// must never unlock them, even when sandbox server checkout is allowed.
export function isCqaLiveCatalogCheckoutAllowed() {
  return process.env.CQA_CUSTOMER_LAUNCH_APPROVED === "true" &&
    /^(?:sk_live_|rk_live_|rkcs_live_)/.test(process.env.STRIPE_SECRET_KEY || "") &&
    isNewCqaCheckoutAllowed();
}

// Separate server-only release hold for protected digital delivery. Never set
// either approval from client input; sandbox credentials allow isolated tests.
export function isCqaDigitalCheckoutAllowed() {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (/^(?:sk_test_|rk_test_|rkcs_test_)/.test(key)) return true;
  return /^(?:sk_live_|rk_live_|rkcs_live_)/.test(key) &&
    process.env.CQA_DIGITAL_DELIVERY_APPROVED === "true" && isNewCqaCheckoutAllowed();
}

export const CQA_PRELAUNCH_CHECKOUT_MESSAGE = "Customer payments are paused while CQA completes launch verification. Join early access or contact CQA for assisted onboarding.";
