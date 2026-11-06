"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/cqa-marketplace";

type Purchase = { orderId: string; title: string; downloadable: boolean };
async function accessToken() {
  const { data } = await getBrowserSupabaseClient().auth.getSession();
  return data.session?.access_token || "";
}
export default function MarketplaceLibraryPage() {
  const [products, setProducts] = useState<Purchase[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(true);
  const mounted = useRef(false);
  const authEpoch = useRef(0);
  const loadEpoch = useRef(0);
  const loadAbort = useRef<AbortController | null>(null);
  const downloads = useRef(new Set<AbortController>());
  const invalidateSession = useCallback(() => {
    authEpoch.current++;
    loadEpoch.current++;
    loadAbort.current?.abort();
    downloads.current.forEach(controller => controller.abort());
    downloads.current.clear();
  }, []);
  const load = useCallback(async () => {
    const auth = authEpoch.current;
    const request = ++loadEpoch.current;
    loadAbort.current?.abort();
    const controller = new AbortController();
    loadAbort.current = controller;
    const current = () => mounted.current && auth === authEpoch.current &&
      request === loadEpoch.current && !controller.signal.aborted;
    setLoading(true); setError(""); setProducts([]);
    try {
      const access = await accessToken();
      if (!current()) return;
      if (!access) { setSignedIn(false); return; }
      setSignedIn(true);
      const response = await fetch("/api/marketplace/library", {
        headers: { Authorization: `Bearer ${access}` }, cache: "no-store", signal: controller.signal
      });
      if (!current()) return;
      if (response.status === 401) { setSignedIn(false); return; }
      if (!response.ok) throw Error("Could not load your purchases.");
      const result = await response.json();
      if (!current()) return;
      if (!Array.isArray(result.products) || result.products.some((item: Purchase) =>
        !item || typeof item.orderId !== "string" || typeof item.title !== "string" ||
        typeof item.downloadable !== "boolean")) throw Error("Invalid purchase response.");
      setProducts(result.products);
    } catch { if (current()) setError("Could not load your purchases. Please retry."); }
    finally { if (current()) setLoading(false); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void load();
    let reload: ReturnType<typeof setTimeout> | undefined;
    const { data } = getBrowserSupabaseClient().auth.onAuthStateChange(() => {
      invalidateSession();
      setProducts([]); setError(""); setSignedIn(false); setLoading(true);
      if (reload) clearTimeout(reload);
      reload = setTimeout(() => { if (mounted.current) void load(); }, 0);
    });
    return () => {
      mounted.current = false;
      invalidateSession();
      if (reload) clearTimeout(reload);
      data.subscription.unsubscribe();
    };
  }, [load, invalidateSession]);
  async function download(orderId: string) {
    const auth = authEpoch.current;
    const controller = new AbortController();
    downloads.current.add(controller);
    const current = () => mounted.current && auth === authEpoch.current && !controller.signal.aborted;
    setError("");
    try {
      const access = await accessToken();
      if (!current()) return;
      if (!access) { setSignedIn(false); setProducts([]); return; }
      const response = await fetch(`/api/marketplace/download?orderId=${encodeURIComponent(orderId)}`, {
        headers: { Authorization: `Bearer ${access}` }, cache: "no-store", signal: controller.signal
      });
      if (!current()) return;
      if (!response.ok) throw Error("Secure download unavailable.");
      const result = await response.json();
      if (!current()) return;
      const url = new URL(result.url);
      if (url.protocol !== "https:") throw Error("Invalid download link.");
      window.location.assign(url.href);
    } catch { if (current()) setError("Secure download unavailable. Please retry."); }
    finally { downloads.current.delete(controller); }
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
