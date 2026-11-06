"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/cqa-marketplace";
import { MAX_MARKETPLACE_ASSET_BYTES } from "@/lib/cqa-marketplace-assets";

type DigitalOffer = { id: string; name: string; hasFile: boolean };

export default function MarketplaceUploadPage() {
  const [offers, setOffers] = useState<DigitalOffer[]>([]);
  const [offerId, setOfferId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const selected = offers.find(offer => offer.id === offerId);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data, error: sessionError } = await getBrowserSupabaseClient().auth.getSession();
        if (sessionError) throw new Error("Your login could not be checked. Refresh to try again.");
        if (!data.session) return;
        if (active) setSignedIn(true);
        const response = await fetch("/api/owner/marketplace-asset", {
          headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store"
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(result.offers)) throw new Error(result.error || "Your digital products could not be loaded.");
        if (active) {
          const list: DigitalOffer[] = result.offers;
          const requested = new URLSearchParams(window.location.search).get("offerId");
          setOffers(list); setOfferId(list.find(offer => offer.id === requested)?.id || list[0]?.id || "");
        }
      } catch (failure) {
        if (active) setError(failure instanceof Error ? failure.message : "Your digital products could not be loaded.");
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setMessage(""); setError(""); setBusy(true);
    try {
      if (!selected || selected.hasFile) throw new Error("Choose a digital product that needs a file.");
      if (!file || !file.size) throw new Error("Choose a product file.");
      if (file.size > MAX_MARKETPLACE_ASSET_BYTES) throw new Error("The file must be 4 MB or smaller.");
      const { data, error: sessionError } = await getBrowserSupabaseClient().auth.getSession();
      if (sessionError || !data.session) throw new Error("Sign in to your owner account again.");
      const body = new FormData(); body.set("offerId", offerId); body.set("file", file);
      const response = await fetch("/api/owner/marketplace-asset", {
        method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}` }, body
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.uploaded !== true || result.offerId !== offerId)
        throw new Error(result.error || "The file could not be confirmed. Refresh the product list before trying again.");
      setOffers(current => current.map(offer => offer.id === offerId ? { ...offer, hasFile: true } : offer));
      setMessage(`Your file for ${selected.name} was saved privately.`);
      setFile(null); if (fileInput.current) fileInput.current.value = "";
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Upload failed. Refresh before trying again.");
    } finally { inFlight.current = false; setBusy(false); }
  }

  return <main className="container" style={{ paddingTop: "2rem", paddingBottom: "3rem", maxWidth: 760 }}>
    <h1 className="section-title">Your private product files</h1>
    <p>Attach a file to a digital product in your machine. PDF, ZIP, PNG, JPG or UTF-8 TXT, up to 4 MB.</p>
    {loading ? <p role="status">Loading your digital products…</p> : !signedIn ?
      <Link className="button primary" href="/login?next=/owner/marketplace-upload">Sign in to upload</Link> : !offers.length ? error ?
        <button className="button ghost" type="button" onClick={() => window.location.reload()}>Reload products</button> :
        <p>Create a digital product in your <Link href="/owner/dashboard">owner dashboard</Link>, then return here to attach its file.</p> :
        <form onSubmit={upload} aria-busy={busy} className="glass-card" style={{ padding: "1.25rem", display: "grid", gap: "1rem" }}>
          <label htmlFor="digital-product">Digital product</label>
          <select id="digital-product" required value={offerId} disabled={busy} onChange={event => { setOfferId(event.target.value); setFile(null); setError(""); setMessage(""); if (fileInput.current) fileInput.current.value = ""; }}>
            {offers.map(offer => <option value={offer.id} key={offer.id}>{offer.name}{offer.hasFile ? " — file attached" : ""}</option>)}
          </select>
          {selected?.hasFile ? <p role="status">This product already has a private file. Create a new offer for a different file.</p> : <>
            <label htmlFor="product-file">Product file</label>
            <input id="product-file" ref={fileInput} required type="file" accept=".pdf,.zip,.png,.jpg,.jpeg,.txt" disabled={busy}
              aria-describedby="product-file-help" onChange={event => { setFile(event.target.files?.[0] || null); setError(""); setMessage(""); }} />
            <p id="product-file-help" className="small">Maximum 4 MB. Once attached, the file cannot be replaced on this offer.</p>
            <button className="button primary" type="submit" disabled={busy || !file || !selected}>{busy ? "Saving private file…" : "Save private file"}</button>
          </>}
        </form>}
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <p><Link href="/owner/dashboard">Return to owner dashboard</Link></p>
  </main>;
}
