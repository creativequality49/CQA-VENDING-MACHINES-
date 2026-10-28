"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/cqa-marketplace";

type Purchase = { orderId: string; title: string; downloadable: boolean };
export default function MarketplaceLibraryPage() {
  const [products, setProducts] = useState<Purchase[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(true);
  async function token() {
    const { data } = await getBrowserSupabaseClient().auth.getSession();
    return data.session?.access_token || "";
  }
  async function load() {
    setLoading(true); setError(""); setProducts([]);
    try {
      const access = await token();
      if (!access) { setSignedIn(false); return; }
      setSignedIn(true);
      const response = await fetch("/api/marketplace/library", {
        headers: { Authorization: `Bearer ${access}` }, cache: "no-store"
      });
      if (response.status === 401) { setSignedIn(false); return; }
      if (!response.ok) throw Error("Could not load your purchases.");
      const result = await response.json();
      setProducts(result.products || []);
    } catch { setError("Could not load your purchases. Please retry."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    void load();
    const { data } = getBrowserSupabaseClient().auth.onAuthStateChange(() => {
      setProducts([]); setSignedIn(false); setLoading(true);
      setTimeout(() => void load(), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  async function download(orderId: string) {
    setError("");
    try {
      const access = await token();
      if (!access) { setSignedIn(false); setProducts([]); return; }
      const response = await fetch(`/api/marketplace/download?orderId=${encodeURIComponent(orderId)}`, {
        headers: { Authorization: `Bearer ${access}` }, cache: "no-store"
      });
      if (!response.ok) throw Error("Secure download unavailable.");
      const result = await response.json();
      const url = new URL(result.url);
      if (url.protocol !== "https:") throw Error("Invalid download link.");
      window.location.assign(url.href);
    } catch { setError("Secure download unavailable. Please retry."); }
  }
  return <main className="container" style={{ paddingBottom: "2rem" }}>
    <h1 className="section-title">Marketplace Purchases</h1>
    <p className="small">Sign in with the verified email used at checkout to see eligible digital orders.</p>
    {error && <p role="alert">{error}</p>}
    {loading ? <p>Loading purchases…</p> : !signedIn ?
      <Link href="/login?next=/marketplace/library" className="cta">Sign in</Link> :
      <section className="glass-card" style={{ padding: "1rem" }}>
        {!products.length && <p>No eligible digital purchases found.</p>}
        {products.map(p => <div key={p.orderId} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: "0.7rem 0" }}>
          <span>{p.title}</span><button className="cta secondary" disabled={!p.downloadable} onClick={() => void download(p.orderId)}>
            {p.downloadable ? "Secure download" : "Delivery being prepared"}
          </button>
        </div>)}
        <button className="cta secondary" onClick={() => void load()}>Refresh</button>
      </section>}
  </main>;
}
