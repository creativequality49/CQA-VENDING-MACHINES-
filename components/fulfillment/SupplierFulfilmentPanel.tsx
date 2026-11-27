"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./ShipmentPanel.module.css";

type Quote = { stock: number; currency: string; totalCost: number; estimatedDelivery: string | null };
type Supplier = {
  state: "awaiting_approval" | "submitting" | "submitted" | "reconciliation_required" | "blocked" | "returns_review";
  revision: number;
  supplierReference: string | null;
  supplierPayment: "unpaid" | "paid";
  quote: Quote | null;
};
type Result = { supplier: Supplier | null; previousQuote?: Quote | null; message?: string };
const labels = {
  awaiting_approval: "Awaiting seller approval", submitting: "Submission in progress",
  submitted: "Submitted to supplier", reconciliation_required: "Submission needs reconciliation",
  blocked: "Fulfilment blocked", returns_review: "Cancellation or returns review"
};
function cost(quote: Quote) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: quote.currency.toUpperCase() }).format(quote.totalCost / 100);
}

export function SupplierFulfilmentPanel({ orderId, paid, request }: {
  orderId: string; paid: boolean; request: (path: string, options?: RequestInit) => Promise<Result>;
}) {
  const [job, setJob] = useState<Supplier | null>(null);
  const [previous, setPrevious] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const path = `/api/owner/orders/${encodeURIComponent(orderId)}/supplier`;
  const load = useCallback(async (signal?: AbortSignal) => {
    setError("");
    try {
      const result = await request(path, { signal });
      if (!signal?.aborted) setJob(result.supplier);
    } catch (failure) {
      if (!signal?.aborted) setError(failure instanceof Error ? failure.message : "Supplier details are unavailable.");
    }
  }, [path, request]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  async function run(action: "quote" | "approve" | "reconcile" | "tracking") {
    if (!job || busy) return;
    setBusy(true); setMessage(""); setError("");
    try {
      const result = await request(path, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, revision: job.revision }) });
      setJob(result.supplier);
      setPrevious(result.previousQuote ?? null);
      setMessage(result.message ?? "");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Supplier action could not be confirmed.");
    } finally { setBusy(false); }
  }
  return <section className={styles.panel} aria-label="Supplier fulfilment">
    <h2>Supplier fulfilment</h2>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {job && <>
      <p className={styles.status}>{labels[job.state]}</p>
      <p>Customer payment {paid ? "confirmed" : "inactive"} · Supplier payment {job.supplierPayment}</p>
      {job.quote && <p>Available stock {job.quote.stock} · Supplier total {cost(job.quote)}{job.quote.estimatedDelivery && ` · Estimated delivery ${job.quote.estimatedDelivery}`}</p>}
      {previous && <p>Previous stock {previous.stock} · Previous supplier total {cost(previous)}</p>}
      {job.supplierReference && <p>Supplier order {job.supplierReference}</p>}
      {paid && job.state === "awaiting_approval" && <>
        <button type="button" className={styles.primary} disabled={busy} onClick={() => void run("quote")}>Refresh supplier quote</button>
        {job.quote && job.quote.stock > 0 && <button type="button" className={styles.primary} disabled={busy} onClick={() => void run("approve")}>Approve supplier order</button>}
      </>}
      {!job.supplierReference && ["submitting", "reconciliation_required", "returns_review"].includes(job.state) &&
        <button type="button" className={styles.primary} disabled={busy} onClick={() => void run("reconcile")}>Reconcile with supplier</button>}
      {job.supplierReference && <button type="button" className={styles.primary} disabled={busy} onClick={() => void run("tracking")}>Refresh tracking and supplier payment</button>}
      {job.state === "returns_review" && <p>Review cancellation or return options with the supplier.</p>}
      <p>Supplier payment is handled manually outside CQA.</p>
    </>}
    <button type="button" className={styles.primary} disabled={busy} onClick={() => void load()}>Refresh fulfilment</button>
  </section>;
}
