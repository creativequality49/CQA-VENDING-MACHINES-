"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/cqa-marketplace";

export function MarketplaceCheckoutButton({ machineSlug, offerId, label = "Buy securely", requiresBuyerAccount = false }: { machineSlug: string; offerId: string; label?: string; requiresBuyerAccount?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const inFlight = useRef(false);
  const loginUrl = `/login?next=${encodeURIComponent(`/machine/${encodeURIComponent(machineSlug)}`)}`;

  async function startCheckout() {
    if (inFlight.current) return;
    inFlight.current = true;
    setError("");
    setNeedsLogin(false);
    setLoading(true);
    let redirecting = false;
    try {
      let token: string | undefined;
      try {
        const { data: sessionData, error: sessionError } = await getBrowserSupabaseClient().auth.getSession();
        if (sessionError) throw sessionError;
        token = sessionData.session?.access_token;
      } catch {
        if (requiresBuyerAccount) throw new Error("Your account could not be checked. Please try again.");
      }
      if (requiresBuyerAccount && !token) {
        setNeedsLogin(true);
        throw new Error("Sign in to your buyer account to purchase and collect this download.");
      }
      const response = await fetch("/api/marketplace/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ machineSlug, offerId })
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) setNeedsLogin(true);
      if (!response.ok || typeof data.url !== "string") throw new Error(typeof data.error === "string" ? data.error : "Unable to start checkout. Please try again.");
      const destination = new URL(data.url);
      if (destination.origin !== "https://checkout.stripe.com" || destination.username || destination.password) throw new Error("A secure Stripe checkout could not be confirmed. Please try again.");
      window.location.assign(data.url);
      redirecting = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout");
    } finally { if (!redirecting) { inFlight.current = false; setLoading(false); } }
  }

  return (
    <div style={{ display: "grid", gap: ".5rem" }}>
      <button className="button primary" type="button" onClick={startCheckout} disabled={loading} style={{ justifyContent: "center" }}>
        {loading ? "Opening secure checkout…" : label}
      </button>
      {error ? <span className="small" role="alert" style={{ color: "#ffb6df" }}>{error}</span> : null}
      {needsLogin ? <Link className="button ghost" href={loginUrl}>Sign in and return to this product</Link> : null}
    </div>
  );
}
