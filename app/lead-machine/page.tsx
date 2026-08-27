"use client";

import { FormEvent, useMemo, useState } from "react";

type Lead = {
  id: string;
  businessName: string;
  category: string;
  address: string;
  phone: string;
  website: string;
  rating: number | null;
  reviews: number;
  mapsUrl: string;
  status: string;
  leadScore: number;
};

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export default function LeadMachinePage() {
  const [query, setQuery] = useState("dentists");
  const [location, setLocation] = useState("Adelaide SA");
  const [limit, setLimit] = useState(20);
  const [accessKey, setAccessKey] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const stats = useMemo(() => ({
    total: leads.length,
    highIntent: leads.filter((lead) => lead.leadScore >= 75).length,
    withPhone: leads.filter((lead) => Boolean(lead.phone)).length,
    withWebsite: leads.filter((lead) => Boolean(lead.website)).length,
  }), [leads]);

  async function runSearch(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setLeads([]);

    try {
      const response = await fetch("/api/leads/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, location, limit, accessKey }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed");
      setLeads(data.leads ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  function downloadCsv() {
    const headers = ["Business Name", "Category", "Address", "Phone", "Website", "Rating", "Reviews", "Lead Score", "Google Maps"];
    const rows = leads.map((lead) => [
      lead.businessName,
      lead.category,
      lead.address,
      lead.phone,
      lead.website,
      lead.rating ?? "",
      lead.reviews,
      lead.leadScore,
      lead.mapsUrl,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cqa-leads-${query.replace(/\s+/g, "-")}-${location.replace(/\s+/g, "-")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="container" style={{ padding: "2rem 1rem 4rem" }}>
      <section className="glass-card" style={{ padding: "1.4rem", marginBottom: "1rem" }}>
        <p className="small" style={{ textTransform: "uppercase", letterSpacing: ".12em" }}>CQA Lead Capture Machine</p>
        <h1 className="section-title" style={{ marginBottom: ".5rem" }}>Find qualified local business leads in minutes.</h1>
        <p className="small" style={{ maxWidth: 760 }}>
          Search by niche and location, score the strongest opportunities, then export a clean CSV for outreach, CRM import or follow-up automation.
        </p>
      </section>

      <form onSubmit={runSearch} className="glass-card" style={{ padding: "1.2rem", marginBottom: "1rem", display: "grid", gap: ".9rem" }}>
        <div className="grid grid-2">
          <label>
            <span className="small">Business niche</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. dentists" required style={{ width: "100%", padding: ".8rem", borderRadius: 10 }} />
          </label>
          <label>
            <span className="small">Location</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Adelaide SA" required style={{ width: "100%", padding: ".8rem", borderRadius: 10 }} />
          </label>
        </div>
        <div className="grid grid-2">
          <label>
            <span className="small">Lead count</span>
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} style={{ width: "100%", padding: ".8rem", borderRadius: 10 }}>
              <option value={10}>10 leads</option>
              <option value={20}>20 leads</option>
            </select>
          </label>
          <label>
            <span className="small">Workspace access key</span>
            <input type="password" value={accessKey} onChange={(e) => setAccessKey(e.target.value)} placeholder="Provided with your machine" required style={{ width: "100%", padding: ".8rem", borderRadius: 10 }} />
          </label>
        </div>
        <button className="cta" type="submit" disabled={loading}>{loading ? "Finding leads…" : "Run Lead Machine"}</button>
        {error && <p style={{ color: "#ff8da1", margin: 0 }}>{error}</p>}
      </form>

      {leads.length > 0 && (
        <>
          <section className="grid grid-4" style={{ marginBottom: "1rem" }}>
            <div className="glass-card" style={{ padding: "1rem" }}><strong>{stats.total}</strong><p className="small">Leads found</p></div>
            <div className="glass-card" style={{ padding: "1rem" }}><strong>{stats.highIntent}</strong><p className="small">Score 75+</p></div>
            <div className="glass-card" style={{ padding: "1rem" }}><strong>{stats.withPhone}</strong><p className="small">With phone</p></div>
            <div className="glass-card" style={{ padding: "1rem" }}><strong>{stats.withWebsite}</strong><p className="small">With website</p></div>
          </section>

          <section className="glass-card" style={{ padding: "1rem", overflowX: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
              <div><h2 style={{ margin: 0 }}>Qualified Leads</h2><p className="small">Highest CQA lead score first.</p></div>
              <button type="button" className="cta secondary" onClick={downloadCsv}>Export CSV</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead><tr>{["Score", "Business", "Category", "Phone", "Rating", "Reviews", "Website", "Maps"].map((label) => <th key={label} style={{ textAlign: "left", padding: ".7rem", borderBottom: "1px solid rgba(255,255,255,.12)" }}>{label}</th>)}</tr></thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td style={{ padding: ".7rem" }}><strong>{lead.leadScore}</strong></td>
                    <td style={{ padding: ".7rem" }}><strong>{lead.businessName}</strong><div className="small">{lead.address}</div></td>
                    <td style={{ padding: ".7rem" }}>{lead.category}</td>
                    <td style={{ padding: ".7rem" }}>{lead.phone || "—"}</td>
                    <td style={{ padding: ".7rem" }}>{lead.rating ?? "—"}</td>
                    <td style={{ padding: ".7rem" }}>{lead.reviews}</td>
                    <td style={{ padding: ".7rem" }}>{lead.website ? <a href={lead.website} target="_blank" rel="noreferrer">Open site</a> : "—"}</td>
                    <td style={{ padding: ".7rem" }}>{lead.mapsUrl ? <a href={lead.mapsUrl} target="_blank" rel="noreferrer">View Maps</a> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}
