"use client";

import { useState } from "react";

export function MarketplaceCheckoutButton({ machineSlug, offerId, label = "Buy securely" }: { machineSlug: string; offerId: string; label?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/marketplace/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineSlug, offerId })
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || "Unable to start checkout");
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout");
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: ".5rem" }}>
      <button className="button primary" type="button" onClick={startCheckout} disabled={loading} style={{ justifyContent: "center" }}>
        {loading ? "Opening secure checkout…" : label}
      </button>
      {error ? <span className="small" role="alert" style={{ color: "#ffb6df" }}>{error}</span> : null}
    </div>
  );
}
