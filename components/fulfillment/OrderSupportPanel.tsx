"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import styles from "./OrderSupportPanel.module.css";

type SupportState = "none" | "waiting_owner" | "waiting_customer" | "resolved";
type SupportResult = {
  support: {
    state: SupportState;
    revision: number;
    deliveryConfirmedAt: string | null;
    messages: { id: string; actorRole: "buyer" | "owner"; message: string; createdAt: string }[];
    hasMore: boolean;
    messagePage: number;
  };
  canConfirmDelivery: boolean;
};
type SupportAction = "message" | "resolve" | "reopen" | "confirm_delivery";
type SupportRequest = (url: string, init?: RequestInit) => Promise<unknown>;
const labels: Record<SupportState, string> = {
  none: "No support request yet",
  waiting_owner: "Waiting for the business",
  waiting_customer: "Waiting for the customer",
  resolved: "Resolved",
};

function readSupport(value: unknown): SupportResult {
  if (!value || typeof value !== "object") throw new Error("Order support could not be confirmed.");
  const result = value as SupportResult;
  const support = result.support;
  if (!support || !Object.hasOwn(labels, support.state) || !Number.isSafeInteger(support.revision) || support.revision < 0 ||
      typeof result.canConfirmDelivery !== "boolean" || typeof support.hasMore !== "boolean" ||
      !Number.isSafeInteger(support.messagePage) || support.messagePage < 0 ||
      !(support.deliveryConfirmedAt === null || (typeof support.deliveryConfirmedAt === "string" && Number.isFinite(Date.parse(support.deliveryConfirmedAt)))) ||
      !Array.isArray(support.messages) || support.messages.length > 100 || support.messages.some(message =>
        !message || typeof message.id !== "string" || !["buyer", "owner"].includes(message.actorRole) ||
        typeof message.message !== "string" || typeof message.createdAt !== "string" || !Number.isFinite(Date.parse(message.createdAt))))
    throw new Error("Order support could not be confirmed. Refresh to try again.");
  return result;
}

function when(value: string) {
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function historyPath(path: string, page: number) {
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("messagePage", String(page));
  return `${pathname}?${params}`;
}

export function OrderSupportPanel({ orderId, audience, request, businessId, onUpdated }: {
  orderId: string;
  audience: "customer" | "owner";
  request: SupportRequest;
  businessId?: string;
  onUpdated?: () => void;
}) {
  const inputId = useId();
  const path = `/api/${audience}/orders/${encodeURIComponent(orderId)}/support${audience === "owner" && businessId ? `?businessId=${encodeURIComponent(businessId)}` : ""}`;
  const [result, setResult] = useState<{ path: string; data: SupportResult } | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<SupportAction | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [messagePage, setMessagePage] = useState(0);
  const generation = useRef(0);
  const controllers = useRef(new Set<AbortController>());
  const inFlight = useRef(false);
  const retry = useRef<{ fingerprint: string; id: string } | null>(null);
  const data = result?.path === path ? result.data : null;

  useEffect(() => {
    const version = ++generation.current;
    const controller = new AbortController();
    const pendingControllers = controllers.current;
    pendingControllers.add(controller);
    setResult(null); setDraft(""); setError(""); setNotice(""); setBusy(null); setLoading(true); setMessagePage(0);
    retry.current = null; inFlight.current = false;
    void request(historyPath(path, 0), { signal: controller.signal }).then(readSupport).then(next => {
      if (generation.current === version && !controller.signal.aborted) setResult({ path, data: next });
    }).catch(problem => {
      if (generation.current === version && !controller.signal.aborted && problem?.name !== "AbortError")
        setError(problem instanceof Error ? problem.message : "Order support is unavailable.");
    }).finally(() => {
      pendingControllers.delete(controller);
      if (generation.current === version && !controller.signal.aborted) setLoading(false);
    });
    return () => {
      generation.current = version + 1;
      pendingControllers.forEach(pending => pending.abort());
      pendingControllers.clear();
    };
  }, [path, request]);

  async function refresh(page = messagePage) {
    if (inFlight.current) return;
    const version = generation.current;
    const controller = new AbortController();
    controllers.current.add(controller);
    inFlight.current = true; setLoading(true); setError(""); setNotice("");
    try {
      const next = readSupport(await request(historyPath(path, page), { signal: controller.signal }));
      if (next.support.messagePage !== page) throw new Error("This message history could not be confirmed. Refresh to try again.");
      if (version === generation.current && !controller.signal.aborted) { setResult({ path, data: next }); setMessagePage(page); }
    } catch (problem) {
      if (version === generation.current && !controller.signal.aborted && !(problem instanceof DOMException && problem.name === "AbortError"))
        setError(problem instanceof Error ? problem.message : "Order support could not refresh.");
    } finally {
      controllers.current.delete(controller);
      if (version === generation.current) { inFlight.current = false; setLoading(false); }
    }
  }

  async function act(action: SupportAction, event?: FormEvent) {
    event?.preventDefault();
    if (!data || inFlight.current || loading || (action === "message" && !draft.trim())) return;
    const version = generation.current;
    const controller = new AbortController();
    controllers.current.add(controller);
    inFlight.current = true; setBusy(action); setError(""); setNotice("");
    const text = action === "message" ? draft.trim() : "";
    try {
      const fingerprint = `${action}\u0000${text}`;
      if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, id: crypto.randomUUID() };
      const next = readSupport(await request(path, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ action, expectedRevision: data.support.revision, requestId: retry.current.id, ...(action === "message" ? { message: text } : {}) }),
      }));
      if (version !== generation.current || controller.signal.aborted) return;
      setResult({ path, data: next }); setMessagePage(next.support.messagePage); retry.current = null;
      if (action === "message") setDraft("");
      onUpdated?.();
      setNotice(action === "message" ? "Your message is saved in this order." : action === "resolve" ? "Support request marked resolved. You can reopen it if you need more help." : action === "reopen" ? "Support request reopened." : "Your delivery receipt is confirmed. Support remains available below.");
    } catch (problem) {
      if (version !== generation.current || controller.signal.aborted || (problem instanceof DOMException && problem.name === "AbortError")) return;
      if (typeof problem === "object" && problem !== null && "status" in problem && problem.status === 409) {
        try {
          const latest = readSupport(await request(historyPath(path, 0), { signal: controller.signal }));
          if (version !== generation.current || controller.signal.aborted) return;
          setResult({ path, data: latest });
          setMessagePage(latest.support.messagePage);
          setError("This conversation changed. The latest messages are shown and your draft is kept. Review them, then try again.");
        } catch {
          if (version === generation.current && !controller.signal.aborted) setError("This conversation changed. Your draft is kept. Refresh support before trying again.");
        }
      } else setError(problem instanceof Error ? problem.message : "The update could not be confirmed. Your draft is kept; try again.");
    } finally {
      controllers.current.delete(controller);
      if (version === generation.current) { inFlight.current = false; setBusy(null); }
    }
  }

  return <section id="order-support" tabIndex={-1} className={styles.panel} aria-label="Order support">
    <div className={styles.heading}><div><span className={styles.eyebrow}>HELP WITH THIS PURCHASE</span><h2>Order support</h2></div><button type="button" className={styles.secondary} disabled={loading || Boolean(busy)} onClick={() => void refresh()}>Refresh support</button></div>
    <p className={styles.copy}>{audience === "owner" ? "Reply to your customer and track follow-up in this order." : "Ask the business about your purchase, delivery or using what you received. Your conversation stays with this order."}</p>
    {loading && <p role="status" className={styles.copy}>Loading order support…</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {data && <>
      <div className={styles.state}><span>{labels[data.support.state]}</span>{data.support.deliveryConfirmedAt && <span>Customer confirmed receipt · {when(data.support.deliveryConfirmedAt)}</span>}</div>
      {audience === "customer" && data.canConfirmDelivery && !data.support.deliveryConfirmedAt && <div className={styles.receipt}><div><h3>Have you received your delivery?</h3><p>Confirm after you have opened or received it. You can still ask for help afterwards.</p></div><button type="button" className={styles.secondary} disabled={loading || Boolean(busy)} onClick={() => void act("confirm_delivery")}>{busy === "confirm_delivery" ? "Confirming…" : "Confirm delivery received"}</button></div>}
      {messagePage > 0 && <p className={styles.copy}>You’re viewing earlier messages. Choose newer messages to return to the latest replies.</p>}
      {data.support.messages.length ? <ol className={styles.messages} aria-label="Support messages">{data.support.messages.map(message => <li key={message.id} className={message.actorRole === "owner" ? styles.owner : ""}><div><strong>{message.actorRole === "owner" ? audience === "owner" ? "Your business" : "The business" : audience === "customer" ? "You" : "Customer"}</strong><time dateTime={message.createdAt}>{when(message.createdAt)}</time></div><p>{message.message}</p></li>)}</ol> : <p className={styles.copy}>No messages yet. Send a question to start this order’s conversation.</p>}
      {(messagePage > 0 || data.support.hasMore) && <nav className={styles.history} aria-label="Support message history"><button type="button" className={styles.secondary} disabled={loading || Boolean(busy) || !messagePage} onClick={() => void refresh(messagePage - 1)}>← Newer messages</button><span>History page {messagePage + 1}</span><button type="button" className={styles.secondary} disabled={loading || Boolean(busy) || !data.support.hasMore} onClick={() => void refresh(messagePage + 1)}>Older messages →</button></nav>}
      <form onSubmit={event => void act("message", event)} className={styles.form}>
        <label htmlFor={inputId}>{audience === "owner" ? "Your reply to the customer" : "Your message to the business"}</label>
        <textarea id={inputId} rows={4} maxLength={3000} required value={draft} disabled={loading || Boolean(busy)} onChange={event => { setDraft(event.target.value); retry.current = null; }} placeholder="Describe what you need help with. Please do not include passwords, API keys or payment card details." aria-describedby={`${inputId}-help`} />
        <div className={styles.footer}><small id={`${inputId}-help`}>Saved privately with this order · {draft.length}/3000</small><button type="submit" className={styles.primary} disabled={loading || Boolean(busy) || !draft.trim()}>{busy === "message" ? "Saving message…" : "Send message"}</button></div>
      </form>
      <div className={styles.actions}>{data.support.state === "resolved" ? <button type="button" className={styles.secondary} disabled={loading || Boolean(busy)} onClick={() => void act("reopen")}>{busy === "reopen" ? "Reopening…" : "Reopen support request"}</button> : data.support.state !== "none" ? <button type="button" className={styles.secondary} disabled={loading || Boolean(busy)} onClick={() => void act("resolve")}>{busy === "resolve" ? "Saving…" : "Mark support resolved"}</button> : null}</div>
    </>}
  </section>;
}
