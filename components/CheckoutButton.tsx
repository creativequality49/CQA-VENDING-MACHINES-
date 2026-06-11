"use client";

import { useState } from "react";

export function CheckoutButton({ productId, tier, machineSlug, label }: { productId: string; tier: string; machineSlug: string; label?: string }) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, tier, machineSlug }),
      });
      const data = await response.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="cta" onClick={onClick} disabled={loading}>
      {loading ? "Redirecting…" : label ?? "Buy Now"}
    </button>
  );
}
