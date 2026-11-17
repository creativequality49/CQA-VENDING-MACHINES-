"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCustomerSession } from "@/components/customer/useCustomerSession";
import {
  ErrorPanel,
  LoadingPanel,
  OrderBadge,
  PortalFrame,
} from "@/components/customer/PortalFrame";
import {
  checkOrder,
  dateTime,
  isDigital,
  isPaid,
  money,
  type OrdersResult,
} from "@/components/customer/types";
import styles from "./account.module.css";

type Filter = "all" | "action" | "progress" | "delivered";
export default function AccountPage() {
  const session = useCustomerSession("/account");
  const { request, key: sessionKey, status: sessionStatus } = session;
  const [result, setResult] = useState<
    (OrdersResult & { sessionKey: string }) | null
  >(null);
  const [offset, setOffset] = useState(0);
  const [previous, setPrevious] = useState<number[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    setOffset(0);
    setPrevious([]);
    setFilter("all");
    setSearch("");
  }, [sessionKey]);
  useEffect(() => {
    setResult(null);
    setError("");
    if (sessionStatus !== "ready") return;
    const controller = new AbortController();
    const key = sessionKey;
    setLoading(true);
    void request<OrdersResult>(`/api/customer/orders?offset=${offset}`, {
      signal: controller.signal,
    })
      .then((payload) => {
        if (controller.signal.aborted) return;
        if (
          !Array.isArray(payload.orders) ||
          !payload.orders.every(checkOrder) ||
          typeof payload.hasMore !== "boolean"
        )
          throw new Error(
            "Your order list could not be read. Please try again.",
          );
        setResult({ ...payload, sessionKey: key });
      })
      .catch((problem) => {
        if (!controller.signal.aborted && problem?.name !== "AbortError")
          setError(
            problem instanceof Error
              ? problem.message
              : "Your orders could not be loaded.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [offset, refresh, sessionKey, sessionStatus, request]);
  const visibleResult =
    result?.sessionKey === sessionKey && sessionStatus === "ready"
      ? result
      : null;
  const orders = visibleResult?.orders || [];
  const actionCount = orders.filter(
    (order) =>
      isPaid(order) &&
      !isDigital(order) &&
      order.workspace.state === "awaiting_intake",
  ).length;
  const filtered = orders.filter((order) => {
    const matchesSearch = `${order.title} ${order.businessName} ${order.id}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "action" &&
        isPaid(order) &&
        !isDigital(order) &&
        order.workspace.state === "awaiting_intake") ||
      (filter === "progress" &&
        isPaid(order) &&
        !isDigital(order) &&
        ["queued", "in_progress"].includes(order.workspace.state)) ||
      (filter === "delivered" &&
        isPaid(order) &&
        (isDigital(order) || order.workspace.state === "delivered"));
    return matchesSearch && matchesFilter;
  });
  function next() {
    if (
      !visibleResult?.hasMore ||
      typeof visibleResult.nextOffset !== "number" ||
      visibleResult.nextOffset <= offset
    )
      return;
    setPrevious((items) => [...items, offset]);
    setOffset(visibleResult.nextOffset);
  }
  function back() {
    const prior = previous.at(-1);
    if (prior === undefined) return;
    setPrevious((items) => items.slice(0, -1));
    setOffset(prior);
  }
  return (
    <PortalFrame
      email={session.email}
      logout={() => void session.logout()}
      loggingOut={session.loggingOut}
    >
      <header className={styles.pageHeading}>
        <div>
          <span className={styles.eyebrow}>YOUR NEXT CHAPTER STARTS HERE</span>
          <h1>
            Everything you’ve
            <br />
            put in motion<span>.</span>
          </h1>
          <p>
            Your purchases, project updates and deliverables.
            <br className={styles.desktopBreak} /> One place to keep moving
            forward.
          </p>
        </div>
        <Link href="/machines" className={styles.primaryButton}>
          Explore machines <span aria-hidden="true">↗</span>
        </Link>
      </header>
      {session.logoutError && (
        <ErrorPanel
          message={session.logoutError}
          retry={() => void session.logout()}
        />
      )}
      {sessionStatus === "unavailable" ? (
        <ErrorPanel
          message={session.error}
          retry={() => window.location.reload()}
        />
      ) : sessionStatus !== "ready" ? (
        <LoadingPanel
          text={
            sessionStatus === "signed_out"
              ? "Returning you to sign in…"
              : undefined
          }
        />
      ) : (
        <>
          <div className={styles.workspaceNote}>
            <div className={styles.noteIcon} aria-hidden="true">
              ✧
            </div>
            <div>
              <strong>
                {actionCount
                  ? `${actionCount} ${actionCount === 1 ? "order needs" : "orders need"} your details on this page`
                  : "Good things start with a clear next step."}
              </strong>
              <p>
                {actionCount
                  ? "Open an order and share your brief so work can begin."
                  : "Open a purchase to view its status, send your brief or access a delivery."}
              </p>
            </div>
            <span className={styles.noteTag}>YOUR WORKSPACE</span>
          </div>
          <section
            className={styles.ordersSection}
            aria-labelledby="orders-title"
          >
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.eyebrow}>PURCHASES & PROJECTS</span>
                <h2 id="orders-title">Your orders</h2>
              </div>
              <button
                className={styles.textButton}
                onClick={() => setRefresh((value) => value + 1)}
                disabled={loading}
              >
                Refresh <span aria-hidden="true">↻</span>
              </button>
            </div>
            <div className={styles.toolbar}>
              <div
                className={styles.filters}
                aria-label="Filter orders on this page"
              >
                {(
                  [
                    ["all", "All orders"],
                    ["action", "Action needed"],
                    ["progress", "In progress"],
                    ["delivered", "Delivered & digital"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={filter === value}
                    className={filter === value ? styles.activeFilter : ""}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className={styles.search}>
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  aria-label="Search orders on this page"
                  placeholder="Search this page"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            </div>
            {error ? (
              <ErrorPanel
                message={error}
                retry={() => setRefresh((value) => value + 1)}
              />
            ) : loading || !visibleResult ? (
              <LoadingPanel text="Finding your orders…" />
            ) : orders.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon} aria-hidden="true">
                  ◇
                </div>
                <span className={styles.eyebrow}>ROOM FOR SOMETHING GREAT</span>
                <h3>
                  {offset
                    ? "No more orders here."
                    : "Your first purchase belongs here."}
                </h3>
                <p>
                  {offset
                    ? "Go back to see your earlier purchases."
                    : "When you purchase from a CQA machine, your order and next steps will appear in this workspace."}
                </p>
                <Link href="/machines" className={styles.primaryButton}>
                  Find your next step <span aria-hidden="true">↗</span>
                </Link>
              </div>
            ) : filtered.length === 0 ? (
              <div className={styles.empty}>
                <h3>No orders match this view.</h3>
                <p>Try another filter or search term on this page.</p>
                <button
                  className={styles.secondaryButton}
                  onClick={() => {
                    setFilter("all");
                    setSearch("");
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className={styles.orderGrid}>
                {filtered.map((order) => (
                  <article className={styles.orderCard} key={order.id}>
                    <div className={styles.orderTop}>
                      <span className={styles.orderIcon} aria-hidden="true">
                        {isDigital(order) ? "↓" : "◇"}
                      </span>
                      <OrderBadge order={order} />
                    </div>
                    <span className={styles.cardEyebrow}>
                      {isDigital(order)
                        ? "DIGITAL PURCHASE"
                        : "SERVICE & DELIVERY"}
                    </span>
                    <h3>
                      <Link
                        href={`/account/orders/${encodeURIComponent(order.id)}`}
                      >
                        {order.title}
                      </Link>
                    </h3>
                    <p className={styles.orderBusiness}>
                      {order.businessName || "CQA marketplace"}
                    </p>
                    <div className={styles.orderMeta}>
                      <div>
                        <span>PURCHASED</span>
                        <strong>{dateTime(order.createdAt)}</strong>
                      </div>
                      <div>
                        <span>ORDER TOTAL</span>
                        <strong>{money(order)}</strong>
                      </div>
                    </div>
                    <div className={styles.orderBottom}>
                      <span>
                        {isPaid(order)
                          ? "Payment confirmed"
                          : "Payment not confirmed"}
                      </span>
                      <Link
                        href={`/account/orders/${encodeURIComponent(order.id)}`}
                      >
                        Open order <span aria-hidden="true">↗</span>
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {!loading && visibleResult && (
              <div className={styles.pagination}>
                <span>
                  {orders.length} {orders.length === 1 ? "order" : "orders"} on
                  this page
                  {filter !== "all" || search
                    ? ` · ${filtered.length} shown`
                    : ""}
                </span>
                <div>
                  <button
                    className={styles.secondaryButton}
                    disabled={!previous.length}
                    onClick={back}
                  >
                    ← Previous
                  </button>
                  <button
                    className={styles.secondaryButton}
                    disabled={
                      !visibleResult.hasMore ||
                      typeof visibleResult.nextOffset !== "number" ||
                      visibleResult.nextOffset <= offset
                    }
                    onClick={next}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </section>
          <div className={styles.bottomNote}>
            <span aria-hidden="true">⌁</span>
            <p>Built for your business. Kept in your workspace.</p>
            <Link href="/contact?service=support">
              Need a hand? <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </>
      )}
    </PortalFrame>
  );
}
