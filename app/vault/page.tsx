"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/cqa-marketplace";

type VaultProduct = { id: string; title: string; source: string; expiresAt: string | null; downloadable: boolean };

export default function VaultPage() {
  const [products, setProducts] = useState<VaultProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const loadSequence = useRef(0);

  const loadVault = useCallback(async (background = false) => {
    const sequence = ++loadSequence.current;
    if (!background) setLoading(true);
    setError("");
    if (!background) setProducts([]);
    try {
      const { data, error: sessionError } = await getBrowserSupabaseClient().auth.getSession();
      if (sequence !== loadSequence.current) return;
      if (sessionError) throw sessionError;
      if (!data.session) { setProducts([]); setNeedsLogin(true); return; }
      const response = await fetch("/api/vault", { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store" });
      if (sequence !== loadSequence.current) return;
      if (response.status === 401) { setProducts([]); setNeedsLogin(true); return; }
      const result = await response.json();
      if (sequence !== loadSequence.current) return;
      if (!response.ok) throw new Error(result.error || "Unable to load your vault.");
      setNeedsLogin(false);
      setProducts(result.products);
    } catch {
      if (sequence === loadSequence.current) setError("Unable to load your vault. Please try again.");
    } finally { if (sequence === loadSequence.current) setLoading(false); }
  }, []);

  useEffect(() => {
    const sequenceRef = loadSequence;
    void loadVault();
    const { data } = getBrowserSupabaseClient().auth.onAuthStateChange(() => {
      ++loadSequence.current;
      setProducts([]);
      setLoading(true);
      setTimeout(() => { void loadVault(); }, 0);
    });
    return () => { ++sequenceRef.current; data.subscription.unsubscribe(); };
  }, [loadVault]);

  useEffect(() => {
    if (loading || needsLogin || products.length) return;
    let attempts = 0;
    // Confirmed access appears automatically during the usual webhook delay.
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (++attempts >= 12) clearInterval(timer);
      void loadVault(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [loadVault, loading, needsLogin, products.length]);

  async function download(productId: string) {
    const sequence = loadSequence.current;
    setDownloading(productId);
    setError("");
    try {
      const { data } = await getBrowserSupabaseClient().auth.getSession();
      if (sequence !== loadSequence.current) return;
      if (!data.session) { setNeedsLogin(true); setProducts([]); return; }
      const response = await fetch(`/api/signed-download?productId=${encodeURIComponent(productId)}`, {
        headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store"
      });
      const result = await response.json();
      if (sequence !== loadSequence.current) return;
      if (!response.ok) throw new Error(result.error || "Unable to prepare your download.");
      const url = new URL(result.url);
      if (url.protocol !== "https:") throw new Error("Invalid download link.");
      window.location.assign(url.href);
    } catch (failure) {
      if (sequence === loadSequence.current) setError(failure instanceof Error ? failure.message : "Unable to prepare your download. Please try again.");
    } finally { setDownloading(null); }
  }

  return (
    <main className="container" style={{ paddingBottom: "2rem" }}>
      <h1 className="section-title">Customer Vault</h1>
      <p className="small">Your confirmed purchases and active access appear here after payment confirmation.</p>
      {error && <p role="alert">{error}</p>}
      {loading ? <p role="status">Loading your vault…</p> : needsLogin ? (
        <Link className="cta" href="/login?next=/vault">Sign in to your vault</Link>
      ) : (
        <section className="glass-card" style={{ padding: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>Your downloads</h2>
          {!products.length && !error && <p className="small">No active purchases yet. If you just paid, refresh after Stripe confirms your payment.</p>}
          {products.map(product => (
            <div key={product.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", padding: "0.7rem 0" }}>
              <span>{product.title}{product.expiresAt && <small> · Access until {new Date(product.expiresAt).toLocaleDateString()}</small>}</span>
              <button className="cta secondary" disabled={!product.downloadable || downloading !== null} onClick={() => void download(product.id)}>
                {downloading === product.id ? "Preparing…" : product.downloadable ? "Secure download" : "Delivery being prepared"}
              </button>
            </div>
          ))}
          <button className="cta secondary" disabled={loading || downloading !== null} onClick={() => void loadVault()}>Refresh access</button>
        </section>
      )}
      <p><Link href="/machine/store">Browse products</Link></p>
    </main>
  );
}
