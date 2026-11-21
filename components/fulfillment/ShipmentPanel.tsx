"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./ShipmentPanel.module.css";

type Shipment = {
  orderId: string;
  status: "ready" | "packing" | "shipped" | "delivered" | "cancelled";
  recipientName: string | null;
  address: { line1: string; line2?: string | null; city: string; state?: string | null; postal_code: string; country: string } | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  dispatchedAt: string | null;
  deliveredAt?: string | null;
  revision: number;
};
type Request = (path: string, options?: RequestInit) => Promise<unknown>;
function shipmentResult(value: unknown, orderId: string): { shipment: Shipment | null } {
  if (!value || typeof value !== "object" || !("shipment" in value)) throw new Error("Shipment details could not be confirmed.");
  const shipment = value.shipment as Shipment | null;
  if (shipment !== null && (!shipment || shipment.orderId !== orderId || !["ready", "packing", "shipped", "delivered", "cancelled"].includes(shipment.status) || !Number.isSafeInteger(shipment.revision))) throw new Error("Shipment details could not be confirmed.");
  return { shipment };
}
function trackingLink(value: string | null) {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function ShipmentPanel({ orderId, paid, owner = false, request }: { orderId: string; paid: boolean; owner?: boolean; request: Request }) {
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const epoch = useRef(0);
  const pending = useRef(false);
  const path = `/api/${owner ? "owner" : "customer"}/orders/${encodeURIComponent(orderId)}/shipment`;
  useEffect(() => {
    const version = ++epoch.current;
    const controller = new AbortController();
    setLoading(true); setShipment(null); setError(""); setNotice(""); setConfirmed(false);
    request(path, { signal: controller.signal }).then(result => {
      const next = shipmentResult(result, orderId);
      if (version === epoch.current && !controller.signal.aborted) setShipment(next.shipment);
    }).catch(problem => {
      if (version === epoch.current && !controller.signal.aborted) setError(problem instanceof Error ? problem.message : "Shipment details are unavailable.");
    }).finally(() => { if (version === epoch.current && !controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); epoch.current = version + 1; };
  }, [path, orderId, request, reload]);
  async function dispatch(event: FormEvent) {
    event.preventDefault();
    if (!paid || !shipment || !["ready", "packing"].includes(shipment.status) || !confirmed || pending.current) return;
    pending.current = true; setBusy(true); setError(""); setNotice("");
    const version = epoch.current;
    try {
      const result = shipmentResult(await request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ship", expectedRevision: shipment.revision, carrier: carrier.trim(), trackingNumber: trackingNumber.trim(), trackingUrl: trackingUrl.trim() || undefined }) }), orderId);
      if (!result.shipment || result.shipment.status !== "shipped" || result.shipment.revision !== shipment.revision + 1) throw new Error("Dispatch was not confirmed. Refresh before trying again.");
      if (version !== epoch.current) return;
      setShipment(result.shipment); setConfirmed(false); setNotice("Dispatch recorded. Your customer can now see these tracking details.");
    } catch (problem) { if (version === epoch.current) setError(problem instanceof Error ? problem.message : "Dispatch could not be saved. Refresh before trying again."); }
    finally { pending.current = false; if (version === epoch.current) setBusy(false); }
  }
  async function advance(action: "pack" | "deliver") {
    if (!owner || !paid || !shipment || pending.current || (action === "deliver" && !confirmed)) return;
    const current = shipment;
    const version = epoch.current;
    pending.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const result = shipmentResult(await request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, expectedRevision: current.revision }) }), orderId);
      if (!result.shipment || result.shipment.status !== (action === "pack" ? "packing" : "delivered") || result.shipment.revision !== current.revision + 1) throw new Error("The shipment change was not confirmed. Refresh before retrying.");
      if (version !== epoch.current) return;
      setShipment(result.shipment); setConfirmed(false); setNotice(action === "pack" ? "Packing recorded. Your customer can see the updated status." : "Delivery completion recorded for your customer.");
    } catch (problem) { if (version === epoch.current) setError(problem instanceof Error ? problem.message : "The shipment could not be updated."); }
    finally { pending.current = false; if (version === epoch.current) setBusy(false); }
  }
  const url = trackingLink(shipment?.trackingUrl || null);
  return <section className={styles.panel} aria-label={owner ? "Shipping and dispatch" : "Delivery tracking"}>
    <span className={styles.eyebrow}>{owner ? "Physical product fulfilment" : "Your physical purchase"}</span>
    <h2>{owner ? "Shipping & dispatch" : "Delivery tracking"}</h2>
    {loading ? <p role="status">Loading shipping details…</p> : <>
      {error && <div className={styles.error} role="alert">{error}<button type="button" disabled={busy} onClick={() => setReload(value => value + 1)}>Refresh shipping details</button></div>}
      {notice && <p className={styles.success} role="status">{notice}</p>}
      {!error && !shipment && <p>Shipping details have not been confirmed for this order. {owner ? "Refresh after the payment and delivery address have been recorded." : "Contact the business if you need help with delivery."}</p>}
      {shipment && <>
        <p className={styles.status}>{shipment.status === "delivered" ? "Delivery marked complete by merchant" : shipment.status === "shipped" ? "Dispatched by the merchant" : shipment.status === "cancelled" ? "Shipment cancelled" : shipment.status === "packing" ? "Being packed by the merchant" : "Preparing for dispatch"}</p>
        {shipment.recipientName && <strong>{shipment.recipientName}</strong>}
        {shipment.address && <address>{shipment.address.line1}<br />{shipment.address.line2 && <>{shipment.address.line2}<br /></>}{shipment.address.city}{shipment.address.state ? `, ${shipment.address.state}` : ""} {shipment.address.postal_code}<br />{shipment.address.country}</address>}
        {["shipped", "delivered"].includes(shipment.status) && <div className={styles.tracking}><dl><div><dt>Carrier</dt><dd>{shipment.carrier || "Not provided"}</dd></div><div><dt>Tracking number</dt><dd>{shipment.trackingNumber || "Not provided"}</dd></div>{shipment.dispatchedAt && <div><dt>Dispatch recorded</dt><dd>{new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date(shipment.dispatchedAt))}</dd></div>}</dl>{url && <a className={styles.primary} href={url} target="_blank" rel="noopener noreferrer">Open carrier tracking ↗</a>}<p>Tracking is provided by the merchant. Carrier updates appear on the carrier’s website.</p></div>}
        {owner && paid && shipment.status === "ready" && <button type="button" className={styles.primary} disabled={busy} onClick={() => void advance("pack")}>{busy ? "Saving…" : "Start packing"}</button>}
        {owner && paid && shipment.status === "shipped" && <div className={styles.form}><label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} /><span>I have verified delivery with the carrier or customer.</span></label><button type="button" className={styles.primary} disabled={busy || !confirmed} onClick={() => void advance("deliver")}>{busy ? "Saving…" : "Mark delivery complete"}</button></div>}
        {owner && paid && ["ready", "packing"].includes(shipment.status) && <form onSubmit={dispatch} className={styles.form}><p>Pack and ship this order yourself, then record the details below. This action does not buy a label or arrange a carrier collection.</p><label>Carrier<input required maxLength={100} value={carrier} onChange={event => setCarrier(event.target.value)} disabled={busy} placeholder="e.g. Australia Post" /></label><label>Tracking number<input required maxLength={200} value={trackingNumber} onChange={event => setTrackingNumber(event.target.value)} disabled={busy} /></label><label>Carrier tracking URL <span>Optional · HTTPS only</span><input type="url" pattern="https://.*" maxLength={2000} value={trackingUrl} onChange={event => setTrackingUrl(event.target.value)} disabled={busy} placeholder="https://…" /></label><label className={styles.confirm}><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} /><span>I have handed this parcel to the carrier and checked the delivery details.</span></label><button type="submit" className={styles.primary} disabled={busy || !confirmed}>{busy ? "Recording dispatch…" : "Confirm dispatch"}</button></form>}
        {!paid && <p>Payment is not active. New dispatch actions are unavailable.</p>}
      </>}
    </>}
  </section>;
}
