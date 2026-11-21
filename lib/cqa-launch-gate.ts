// Server-only launch control. A sandbox key is not proof of test isolation.
const commerceTestProject = "ndzmlywsuywkhgqdbzft";
const commerceTestUrl = /^https:\/\/ndzmlywsuywkhgqdbzft\.supabase\.co\/?$/;

function isIsolatedCqaSandbox() {
  return process.env.VERCEL_ENV === "preview" &&
    process.env.CQA_COMMERCE_TEST_PROJECT === commerceTestProject &&
    commerceTestUrl.test(process.env.SUPABASE_URL || "") &&
    process.env.SUPABASE_URL === process.env.SUPABASE_URL?.trim() &&
    commerceTestUrl.test(process.env.NEXT_PUBLIC_SUPABASE_URL || "") &&
    process.env.NEXT_PUBLIC_SUPABASE_URL === process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
}

export function isNewCqaCheckoutAllowed() {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (key !== key.trim()) return false;
  if (/^(?:sk_test_|rk_test_|rkcs_test_)[A-Za-z0-9]+$/.test(key)) {
    return isIsolatedCqaSandbox();
  }
  return process.env.VERCEL_ENV === "production" &&
    /^(?:sk_live_|rk_live_|rkcs_live_)[A-Za-z0-9]+$/.test(key) &&
    process.env.CQA_CUSTOMER_LAUNCH_APPROVED === "true";
}

// Catalogue links are already-live Stripe Payment Links. An isolated sandbox
// must not unlock them; require the same strict Production live-key gate.
export function isCqaLiveCatalogCheckoutAllowed() {
  return process.env.VERCEL_ENV === "production" &&
    /^(?:sk_live_|rk_live_|rkcs_live_)[A-Za-z0-9]+$/.test(process.env.STRIPE_SECRET_KEY || "") &&
    isNewCqaCheckoutAllowed();
}

// Separate release hold for protected digital delivery. No client input can
// grant approval, and a test key on Production never bypasses either hold.
export function isCqaDigitalCheckoutAllowed() {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (key !== key.trim()) return false;
  if (/^(?:sk_test_|rk_test_|rkcs_test_)[A-Za-z0-9]+$/.test(key)) {
    return isIsolatedCqaSandbox();
  }
  return process.env.VERCEL_ENV === "production" &&
    /^(?:sk_live_|rk_live_|rkcs_live_)[A-Za-z0-9]+$/.test(key) &&
    process.env.CQA_DIGITAL_DELIVERY_APPROVED === "true" && isNewCqaCheckoutAllowed();
}

export const CQA_PRELAUNCH_CHECKOUT_MESSAGE = "Customer payments are paused while CQA completes launch verification. Join early access or contact CQA for assisted onboarding.";

// Physical checkout is a separate rollout: deploy the inventory/shipment schema first.
export function isCqaPhysicalCheckoutAllowed() {
  return isNewCqaCheckoutAllowed() && process.env.CQA_PHYSICAL_DELIVERY_APPROVED === "true";
}
