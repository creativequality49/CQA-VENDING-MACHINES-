"use client";

import { useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/cqa-marketplace";

export function CheckoutButton({ productId, tier, machineSlug, label }: { productId: string; tier: string; machineSlug: string; label?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onClick() {
    setLoading(true);
    setError("");
    try {
      const { data } = await getBrowserSupabaseClient().auth.getSession();
      if (!data.session) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ productId, tier, machineSlug }),
      });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || "Checkout could not be started.");
      window.location.href = result.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout could not be started.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div><button className="cta" onClick={onClick} disabled={loading}>
      {loading ? "Redirecting…" : label ?? "Buy Now"}
    </button>{error && <p role="alert" className="small">{error}</p>}</div>
  );
}
