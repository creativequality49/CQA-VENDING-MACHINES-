"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/cqa-marketplace";

export default function MarketplaceUploadPage() {
  const [offerId, setOfferId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setBusy(true);
    try {
      const { data } = await getBrowserSupabaseClient().auth.getSession();
      if (!data.session) throw new Error("Sign in to your owner account.");
      if (!file) throw new Error("Choose a file.");
      const body = new FormData();
      body.set("offerId", offerId.trim()); body.set("file", file);
      const response = await fetch("/api/owner/marketplace-asset", {
        method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}` }, body
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed.");
      setMessage("Private asset uploaded. Digital checkout remains disabled pending release verification.");
      setFile(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); }
    finally { setBusy(false); }
  }
  return <main className="container" style={{ paddingBottom: "2rem" }}>
    <h1 className="section-title">Private digital product upload</h1>
    <p>Upload a file for a digital offer you own. Maximum 15 MB. PDF, ZIP, PNG, JPG or TXT.</p>
    <form onSubmit={upload} className="glass-card" style={{ padding: "1rem", display: "grid", gap: "1rem" }}>
      <label>Digital offer ID <input required value={offerId} onChange={e => setOfferId(e.target.value)}
        placeholder="Offer UUID" /></label>
      <label>Private product file <input required type="file" accept=".pdf,.zip,.png,.jpg,.jpeg,.txt"
        onChange={e => setFile(e.target.files?.[0] || null)} /></label>
      <button className="cta" disabled={busy || !file}>{busy ? "Uploading…" : "Upload private file"}</button>
    </form>
    {message && <p role="status">{message}</p>}
    <p><Link href="/owner/dashboard">Return to owner dashboard</Link></p>
  </main>;
}
