// Read-only configuration evidence, never a payment/fulfilment readiness claim.
// No account fields, secrets, provider error messages or URLs leave this helper.
export async function getCqaPreviewIsolationDiagnostics(
  env: Record<string, string | undefined>,
  request: typeof fetch = fetch
) {
  if (env.VERCEL_ENV !== "preview") return undefined;
  const testProject = "ndzmlywsuywkhgqdbzft";
  const testUrl = /^https:\/\/ndzmlywsuywkhgqdbzft\.supabase\.co\/?$/;
  const serverDatabaseMatches = testUrl.test(env.SUPABASE_URL || "") && env.SUPABASE_URL === env.SUPABASE_URL?.trim();
  const browserDatabaseMatches = testUrl.test(env.NEXT_PUBLIC_SUPABASE_URL || "") && env.NEXT_PUBLIC_SUPABASE_URL === env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const acknowledgementMatches = env.CQA_COMMERCE_TEST_PROJECT === testProject;
  const rawKey = env.STRIPE_SECRET_KEY || "";
  const key = rawKey === rawKey.trim() ? rawKey : "invalid-whitespace";
  const keyMode = !key ? "missing" : /^(?:sk_test_|rk_test_|rkcs_test_)[A-Za-z0-9]{16,}$/.test(key) ? "test"
    : /^(?:sk_live_|rk_live_|rkcs_live_)[A-Za-z0-9]{16,}$/.test(key) ? "live" : "invalid";
  let stripeAccountCheck: "skipped" | "matched" | "mismatched" | "error" = "skipped";
  // Never send a live key, or contact Stripe from a mismapped Preview.
  if (serverDatabaseMatches && browserDatabaseMatches && acknowledgementMatches && keyMode === "test") {
    try {
      const response = await request("https://api.stripe.com/v1/account", {
        method: "GET", headers: { Authorization: `Bearer ${key}` }, cache: "no-store",
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) stripeAccountCheck = "error";
      else {
        const account = await response.json();
        stripeAccountCheck = account?.id === "acct_1UPzM6P6kjGSpjgk" ? "matched" : "mismatched";
      }
    } catch { stripeAccountCheck = "error"; }
  }
  const present = (name: string) => Boolean(env[name]?.trim());
  return {
    serverDatabaseMatches, browserDatabaseMatches, acknowledgementMatches, stripeKeyMode: keyMode,
    stripeAccountCheck, stripeTestAccountMatches: stripeAccountCheck === "matched",
    r2Configured: ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"].every(present),
    r2PublicUrlAbsent: !present("R2_PUBLIC_URL"),
    emailConfigured: present("RESEND_API_KEY") && (present("CQA_EMAIL_FROM") || present("CQA_AUTOMATION_FROM_EMAIL")),
    platformWebhookConfigured: present("STRIPE_WEBHOOK_SECRET"),
    connectWebhookConfigured: present("STRIPE_CONNECT_WEBHOOK_SECRET")
  };
}
