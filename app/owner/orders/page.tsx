"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/cqa-marketplace";
import { MAX_MARKETPLACE_ASSET_BYTES } from "@/lib/cqa-marketplace-assets";
import styles from "./orders.module.css";
import { SupplierFulfilmentPanel } from "@/components/fulfillment/SupplierFulfilmentPanel";
import { ShipmentPanel } from "@/components/fulfillment/ShipmentPanel";

type Workspace = {
  state: "awaiting_intake" | "queued" | "in_progress" | "delivered";
  revision: number;
  intake: Record<string, unknown>;
  deliveryMessage: string;
  hasAsset: boolean;
  assetName: string | null;
  updatedAt: string | null;
};
type Order = {
  id: string;
  status: string;
  amountCents: number;
  currency: string;
  createdAt: string;
  customerEmail: string | null;
  offerName: string;
  digital: boolean;
  supplierShipped?: boolean;
  offerType?: string | null;
  fulfillmentType?: string | null;
  workspace: Workspace;
};
type OrderEvent = {
  id: string;
  actor_role: string;
  kind: string;
  message: string | null;
  created_at: string;
};
type Session = { access_token: string; user: { id: string } } | null;
const stateLabels: Record<string, string> = {
  awaiting_intake: "Awaiting customer details",
  queued: "Ready to start",
  in_progress: "In progress",
  delivered: "Delivered",
};
const date = (value: string) =>
  new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
function money(order: Order) {
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: order.currency.toUpperCase(),
    }).format(order.amountCents / 100);
  } catch {
    return `${(order.amountCents / 100).toFixed(2)} ${order.currency}`;
  }
}
function intakeValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "Not provided";
}
const intakeLabels: Record<string, string> = {
  businessName: "Business or project",
  goals: "Goals",
  details: "Additional details",
};

export default function OwnerOrdersPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [requestedBusiness, setRequestedBusiness] = useState("");
  const [business, setBusiness] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const listEpoch = useRef(0);
  const detailEpoch = useRef(0);
  const account = useRef<string | null>(null);
  const activeSession = useRef<Session>(null);
  const inFlight = useRef(false);

  const invalidateRequests = useCallback(() => {
    listEpoch.current++;
    detailEpoch.current++;
  }, []);
  const clearPrivateState = useCallback(() => {
    invalidateRequests();
    setBusiness(null);
    setOrders([]);
    setSelected(null);
    setEvents([]);
    setFile(null);
    setMessage("");
    setNotice("");
    setError("");
    setBusy("");
    setHasMore(false);
    setPage(0);
    if (fileInput.current) fileInput.current.value = "";
  }, [invalidateRequests]);

  useEffect(() => {
    let active = true;
    let eventVersion = 0;
    setRequestedBusiness(
      new URLSearchParams(window.location.search).get("businessId") || "",
    );
    try {
      const supabase = getBrowserSupabaseClient();
      const receive = (next: Session) => {
        if (!active) return;
        if (account.current !== (next?.user.id || null) || !next)
          clearPrivateState();
        account.current = next?.user.id || null;
        activeSession.current = next;
        setSession(next);
        setSessionLoading(false);
        if (!next)
          router.replace(
            `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
          );
      };
      const { data: listener } = supabase.auth.onAuthStateChange(
        (_event, next) => {
          eventVersion++;
          receive(next);
        },
      );
      const version = eventVersion;
      supabase.auth
        .getSession()
        .then(({ data, error: sessionError }) => {
          if (!active || version !== eventVersion) return;
          if (sessionError) {
            clearPrivateState();
            setSessionLoading(false);
            setError("Your session could not be checked. Sign in again.");
            return;
          }
          receive(data.session);
        })
        .catch(() => {
          if (active && version === eventVersion) {
            clearPrivateState();
            setSessionLoading(false);
            setError("Your session could not be checked. Sign in again.");
          }
        });
      return () => {
        active = false;
        invalidateRequests();
        listener.subscription.unsubscribe();
      };
    } catch {
      setSessionLoading(false);
      setLoading(false);
      setError("Account access is unavailable. Please try again later.");
    }
    return () => {
      active = false;
      invalidateRequests();
    };
  }, [clearPrivateState, invalidateRequests, router]);

  const request = useCallback(
    async (path: string, options: RequestInit = {}) => {
      if (!session) throw new Error("Sign in to your owner account again.");
      const requestSession = session;
      const url = new URL(path, window.location.origin);
      if (requestedBusiness)
        url.searchParams.set("businessId", requestedBusiness);
      const response = await fetch(url, {
        ...options,
        signal: options.signal || AbortSignal.timeout(30000),
        cache: "no-store",
        headers: {
          ...Object.fromEntries(new Headers(options.headers).entries()),
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const result = await response.json().catch(() => null);
      if (
        activeSession.current?.user.id !== requestSession.user.id ||
        activeSession.current.access_token !== requestSession.access_token
      )
        throw new DOMException("Account session changed", "AbortError");
      if (response.status === 401) {
        activeSession.current = null;
        clearPrivateState();
        setSession(null);
        router.replace(
          `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
        );
      }
      if (!response.ok || !result || typeof result !== "object")
        throw new Error(
          result?.error ||
            "The response could not be confirmed. Refresh before trying again.",
        );
      return result;
    },
    [session, requestedBusiness, clearPrivateState, router],
  );

  const loadList = useCallback(async () => {
    if (!session) return;
    const epoch = ++listEpoch.current;
    setLoading(true);
    setError("");
    try {
      const result = await request(`/api/owner/orders?page=${page}`);
      if (
        !Array.isArray(result.orders) ||
        !result.business?.id ||
        typeof result.hasMore !== "boolean"
      )
        throw new Error("The order list could not be confirmed.");
      if (epoch === listEpoch.current) {
        setOrders(result.orders);
        setBusiness(result.business);
        setHasMore(result.hasMore);
      }
    } catch (failure) {
      if (epoch === listEpoch.current) {
        setOrders([]);
        setBusiness(null);
        setHasMore(false);
        setError(
          failure instanceof Error
            ? failure.message
            : "Orders could not be loaded.",
        );
      }
    } finally {
      if (epoch === listEpoch.current) setLoading(false);
    }
  }, [session, request, page]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(
    async (orderId: string) => {
      const epoch = ++detailEpoch.current;
      setSelected(null);
      setEvents([]);
      setDetailLoading(true);
      setError("");
      setNotice("");
      setMessage("");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      try {
        const result = await request(`/api/owner/orders/${orderId}`);
        if (
          result.order?.id !== orderId ||
          !result.order.workspace ||
          !Array.isArray(result.events)
        )
          throw new Error("The order detail could not be confirmed.");
        if (epoch === detailEpoch.current) {
          setSelected(result.order);
          setEvents(result.events);
          setMessage(result.order.workspace.deliveryMessage || "");
        }
      } catch (failure) {
        if (epoch === detailEpoch.current)
          setError(
            failure instanceof Error
              ? failure.message
              : "This order could not be loaded.",
          );
      } finally {
        if (epoch === detailEpoch.current) setDetailLoading(false);
      }
    },
    [request],
  );

  const physical = selected?.offerType === "physical_product" || selected?.fulfillmentType === "shipping";

  async function update(
    action: "start" | "deliver" | "upload",
    event?: FormEvent,
  ) {
    event?.preventDefault();
    if (!selected || selected.digital || physical || inFlight.current) return;
    const current = selected;
    const epoch = detailEpoch.current;
    inFlight.current = true;
    setBusy(action);
    setError("");
    setNotice("");
    try {
      let result;
      if (action === "upload") {
        if (!file || !file.size)
          throw new Error("Choose a delivery file first.");
        if (file.size > MAX_MARKETPLACE_ASSET_BYTES)
          throw new Error("The file must be 4 MB or smaller.");
        const body = new FormData();
        body.set("file", file);
        body.set("expectedRevision", String(current.workspace.revision));
        result = await request(`/api/owner/orders/${current.id}/asset`, {
          method: "POST",
          body,
        });
        if (result.uploaded !== true)
          throw new Error(
            "The file attachment was not confirmed. Refresh before retrying.",
          );
      } else {
        result = await request(`/api/owner/orders/${current.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            expectedRevision: current.workspace.revision,
            message,
          }),
        });
        if (result.updated !== true)
          throw new Error(
            "The update was not confirmed. Refresh before retrying.",
          );
      }
      if (
        result.order?.id !== current.id ||
        !Number.isSafeInteger(result.order.workspace?.revision) ||
        result.order.workspace.revision <= current.workspace.revision
      )
        throw new Error(
          "The saved order could not be confirmed. Refresh before retrying.",
        );
      if (epoch !== detailEpoch.current) return;
      setSelected(result.order);
      setOrders((rows) =>
        rows.map((row) => (row.id === current.id ? result.order : row)),
      );
      setNotice(
        action === "start"
          ? "Work started. Your customer can see the updated status."
          : action === "upload"
            ? "Delivery file saved privately. Mark the order delivered when it is ready."
            : "Delivery confirmed. Your customer can view the handover.",
      );
      if (action === "upload") {
        setFile(null);
        if (fileInput.current) fileInput.current.value = "";
      }
      try {
        const fresh = await request(`/api/owner/orders/${current.id}`);
        if (epoch === detailEpoch.current && Array.isArray(fresh.events))
          setEvents(fresh.events);
      } catch {
        if (epoch === detailEpoch.current)
          setError(
            "Your update was saved, but the activity list could not refresh. Refresh the order to reload it.",
          );
      }
    } catch (failure) {
      if (epoch === detailEpoch.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "The update could not be confirmed.",
        );
    } finally {
      inFlight.current = false;
      if (epoch === detailEpoch.current) setBusy("");
    }
  }

  const paid = selected?.status === "paid";
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link className={styles.back} href="/owner/dashboard">
            ← Owner dashboard
          </Link>
          <p className={styles.eyebrow}>Fulfilment workspace</p>
          <h1>Customer orders</h1>
          <p className={styles.subtitle}>
            {business ? business.name : "Your customer orders"} · Customer
            details, private files and a clear handover.
          </p>
        </div>
        <button
          className={styles.secondary}
          disabled={loading || Boolean(busy) || !session}
          onClick={() => {
            void loadList();
            if (selected) void loadDetail(selected.id);
          }}
        >
          Refresh orders
        </button>
      </header>
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className={styles.notice} role="status">
          {notice}
        </div>
      )}
      {sessionLoading ? (
        <div className={styles.empty} role="status">
          Checking your owner account…
        </div>
      ) : !session ? (
        <div className={styles.empty}>
          <h2>Sign in to view orders</h2>
          <p>Your orders are available only to your business account.</p>
          <Link className={styles.primary} href="/login?next=%2Fowner%2Forders">
            Sign in
          </Link>
        </div>
      ) : (
        <div className={styles.layout}>
          <section className={styles.orders} aria-label="Customer orders">
            <div className={styles.sectionTitle}>
              <h2>Orders</h2>
              <span>Page {page + 1}</span>
            </div>
            {loading ? (
              <div className={styles.empty} role="status">
                Loading customer orders…
              </div>
            ) : !orders.length ? (
              <div className={styles.empty}>
                <h3>No orders on this page</h3>
                <p>
                  New purchases will appear here once they reach your business.
                </p>
              </div>
            ) : (
              orders.map((order) => (
                <button
                  key={order.id}
                  className={`${styles.order} ${selected?.id === order.id ? styles.active : ""}`}
                  disabled={Boolean(busy)}
                  onClick={() => void loadDetail(order.id)}
                >
                  <div className={styles.row}>
                    <strong>{order.offerName}</strong>
                    <b>{money(order)}</b>
                  </div>
                  <p>{order.customerEmail || "Customer email unavailable"}</p>
                  <div className={styles.row}>
                    <span
                      className={
                        order.status === "paid"
                          ? styles.status
                          : styles.mutedStatus
                      }
                    >
                      {order.status === "paid"
                        ? order.digital
                          ? "Protected digital delivery"
                          : order.offerType === "physical_product" || order.fulfillmentType === "shipping" ? "Physical delivery" : stateLabels[order.workspace.state] ||
                            order.workspace.state
                        : order.status}
                    </span>
                    <time dateTime={order.createdAt}>
                      {date(order.createdAt)}
                    </time>
                  </div>
                </button>
              ))
            )}
            <nav className={styles.pagination} aria-label="Order pages">
              <button
                className={styles.secondary}
                disabled={page === 0 || loading || Boolean(busy)}
                onClick={() => setPage((value) => value - 1)}
              >
                ← Previous
              </button>
              <button
                className={styles.secondary}
                disabled={!hasMore || loading || Boolean(busy)}
                onClick={() => setPage((value) => value + 1)}
              >
                Next →
              </button>
            </nav>
          </section>
          <section className={styles.detail} aria-label="Selected order">
            {detailLoading ? (
              <div className={styles.empty} role="status">
                Loading the order and activity…
              </div>
            ) : !selected ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>↗</span>
                <h2>A clear path from paid to delivered.</h2>
                <p>
                  Select an order to review the customer’s details, start work
                  and prepare their handover.
                </p>
              </div>
            ) : (
              <>
                <div className={styles.detailHeader}>
                  <div>
                    <p className={styles.eyebrow}>
                      Order #{selected.id.slice(0, 8).toUpperCase()}
                    </p>
                    <h2>{selected.offerName}</h2>
                    <p>
                      {selected.customerEmail || "Customer email unavailable"}
                    </p>
                  </div>
                  <span className={styles.status}>
                    {paid
                      ? selected.digital
                        ? "Protected digital delivery"
                        : physical ? "Physical delivery" : stateLabels[selected.workspace.state] ||
                          selected.workspace.state
                      : selected.status}
                  </span>
                </div>
                <div className={styles.summary}>
                  <div>
                    <span>Order total</span>
                    <strong>{money(selected)}</strong>
                  </div>
                  <div>
                    <span>Purchased</span>
                    <strong>{date(selected.createdAt)}</strong>
                  </div>
                </div>
                {!paid && (
                  <div className={styles.warning}>
                    Fulfilment is unavailable while this order is{" "}
                    {selected.status}. Payment must be confirmed before work or
                    file delivery.
                  </div>
                )}
                {physical && (selected.supplierShipped ? <SupplierFulfilmentPanel key={selected.id} orderId={selected.id} paid={paid} request={request} /> : <ShipmentPanel key={selected.id} orderId={selected.id} paid={paid} owner request={request} />)}
                {selected.digital && (
                  <section className={styles.card}>
                    <p className={styles.eyebrow}>Protected digital delivery</p>
                    <h3>Managed through the customer library</h3>
                    <p className={styles.muted}>
                      {paid
                        ? "Download access is checked against the customer’s current payment and entitlement whenever a file is requested. This purchase does not require a service brief or manual handover."
                        : "Payment is not active. The customer library will not issue a new download unless payment and entitlement checks succeed."}
                    </p>
                    <Link
                      className={styles.secondary}
                      href="/owner/marketplace-upload"
                    >
                      Manage private product files
                    </Link>
                  </section>
                )}
                {!selected.digital && !physical && (
                  <section className={styles.card}>
                    <h3>Customer brief</h3>
                    {Object.keys(selected.workspace.intake).length ? (
                      <dl className={styles.intake}>
                        {Object.entries(selected.workspace.intake).map(
                          ([key, value]) => (
                            <div key={key}>
                              <dt>
                                {intakeLabels[key] || key.replace(/[_-]/g, " ")}
                              </dt>
                              <dd>{intakeValue(value)}</dd>
                            </div>
                          ),
                        )}
                      </dl>
                    ) : (
                      <p className={styles.muted}>
                        The customer has not submitted their details yet.
                      </p>
                    )}
                  </section>
                )}
                {paid &&
                  !selected.digital && !physical &&
                  selected.workspace.state === "queued" && (
                    <div className={styles.callout}>
                      <div>
                        <h3>Ready when you are.</h3>
                        <p>
                          The customer brief is in. Start work to move this
                          order forward.
                        </p>
                      </div>
                      <button
                        className={styles.primary}
                        disabled={Boolean(busy)}
                        onClick={() => void update("start")}
                      >
                        {busy === "start" ? "Starting…" : "Start work"}
                      </button>
                    </div>
                  )}
                {paid &&
                  !selected.digital && !physical &&
                  selected.workspace.state === "awaiting_intake" && (
                    <p className={styles.muted}>
                      Work can begin once the customer submits their brief.
                    </p>
                  )}
                {paid &&
                  !selected.digital && !physical &&
                  selected.workspace.state === "in_progress" && (
                    <section className={styles.card}>
                      <h3>Prepare the handover</h3>
                      <p className={styles.muted}>
                        Write a useful handover message, attach a private file,
                        or include both.
                      </p>
                      <label
                        className={styles.label}
                        htmlFor="delivery-message"
                      >
                        Message for your customer
                      </label>
                      <textarea
                        id="delivery-message"
                        className={styles.textarea}
                        rows={5}
                        maxLength={10000}
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        disabled={Boolean(busy)}
                        placeholder="Explain what is ready, how to use it and any next steps…"
                      />
                      <form
                        onSubmit={(event) => void update("upload", event)}
                        className={styles.upload}
                      >
                        <label className={styles.label} htmlFor="delivery-file">
                          Private delivery file
                        </label>
                        <p className={styles.muted}>
                          PDF, ZIP, PNG, JPG or TXT · up to 4 MB
                        </p>
                        <input
                          id="delivery-file"
                          ref={fileInput}
                          type="file"
                          accept=".pdf,.zip,.png,.jpg,.jpeg,.txt"
                          disabled={Boolean(busy)}
                          onChange={(event) =>
                            setFile(event.target.files?.[0] || null)
                          }
                        />
                        <button
                          className={styles.secondary}
                          disabled={!file || Boolean(busy)}
                        >
                          {busy === "upload"
                            ? "Saving private file…"
                            : selected.workspace.hasAsset
                              ? "Replace private file"
                              : "Save private file"}
                        </button>
                      </form>
                      {selected.workspace.hasAsset && (
                        <p className={styles.file}>
                          ✓ Private file attached:{" "}
                          {selected.workspace.assetName}
                        </p>
                      )}
                      <button
                        className={styles.primary}
                        disabled={
                          Boolean(busy) ||
                          (!message.trim() && !selected.workspace.hasAsset)
                        }
                        onClick={() => void update("deliver")}
                      >
                        {busy === "deliver"
                          ? "Confirming delivery…"
                          : "Mark delivered"}
                      </button>
                      <p className={styles.small}>
                        Delivery becomes visible to the customer after the save
                        is confirmed.
                      </p>
                    </section>
                  )}
                {!selected.digital && !physical &&
                  selected.workspace.state === "delivered" && (
                    <section className={styles.card}>
                      <p className={styles.eyebrow}>Handover complete</p>
                      <h3>Delivered to your customer</h3>
                      {selected.workspace.deliveryMessage && (
                        <p className={styles.delivery}>
                          {selected.workspace.deliveryMessage}
                        </p>
                      )}
                      {selected.workspace.hasAsset && (
                        <p className={styles.file}>
                          ✓ Private file: {selected.workspace.assetName}
                        </p>
                      )}
                    </section>
                  )}
                <section className={styles.card}>
                  <h3>Order activity</h3>
                  {!events.length ? (
                    <p className={styles.muted}>
                      Activity will appear as this order moves forward.
                    </p>
                  ) : (
                    <ol className={styles.timeline}>
                      {events.map((event) => (
                        <li key={event.id}>
                          <div className={styles.row}>
                            <strong>{event.kind.replace(/[_-]/g, " ")}</strong>
                            <time dateTime={event.created_at}>
                              {date(event.created_at)}
                            </time>
                          </div>
                          <span>
                            {event.actor_role === "owner"
                              ? "Your business"
                              : "Customer"}
                          </span>
                          {event.message && <p>{event.message}</p>}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
