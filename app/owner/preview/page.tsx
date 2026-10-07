"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatAud, getBrowserSupabaseClient } from "@/lib/cqa-marketplace";

type Preview = { business: { name: string }; machine: { title: string; subtitle: string | null; hero_image_url: string | null; customization: { primaryColor?: string } | null } | null; offers: { id: string; name: string; price_cents: number | null; active: boolean; image_url: string | null }[] };

export default function OwnerPreviewPage() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    async function load() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) { window.location.assign("/login?next=/owner/preview"); return; }
        const response = await fetch("/api/owner/setup", { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Preview could not load.");
        if (!disposed) setPreview(result);
      } catch (e) { if (!disposed) setError(e instanceof Error ? e.message : "Preview could not load."); }
    }
    void load();
    return () => { disposed = true; };
  }, [supabase]);
  return <main className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
    <p className="small">Private draft preview · payments are disabled here. Review your offers before publishing.</p>
    <Link href="/owner/setup" className="button ghost">Back to setup</Link>
    {error ? <p role="alert">{error}</p> : !preview ? <p>Loading your draft…</p> : <>
      <section className="glass-card" style={{ padding: "2rem", margin: "1rem 0", borderColor: preview.machine?.customization?.primaryColor || undefined }}>
        {preview.machine?.hero_image_url ? <img src={preview.machine.hero_image_url} alt={preview.business.name} style={{ width: "100%", maxHeight: 360, objectFit: "cover" }} /> : null}
        <span className="eyebrow">{preview.business.name}</span><h1>{preview.machine?.title || preview.business.name}</h1><p>{preview.machine?.subtitle}</p>
      </section>
      <section className="grid grid-3">{preview.offers.map((offer) => <article key={offer.id} className="glass-card" style={{ padding: "1rem" }}>
        {offer.image_url ? <img src={offer.image_url} alt={offer.name} style={{ width: "100%", maxHeight: 240, objectFit: "cover" }} /> : null}
        <h2>{offer.name}</h2><p>{offer.price_cents === null ? "Enquire for pricing" : formatAud(offer.price_cents)}</p><p className="small">{offer.active ? "Active offer" : "Draft — activate before publishing"}</p><button className="button ghost" disabled>Preview only</button>
      </article>)}</section>
      {!preview.offers.length ? <p>Add your first offer in the owner dashboard.</p> : null}
    </>}
  </main>;
}
