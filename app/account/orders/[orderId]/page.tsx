"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CustomerRequestError,
  useCustomerSession,
} from "@/components/customer/useCustomerSession";
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
  type OrderResult,
} from "@/components/customer/types";
import styles from "../../account.module.css";

function OrderWorkspace({
  result,
  request,
  reload,
}: {
  result: OrderResult;
  request: ReturnType<typeof useCustomerSession>["request"];
  reload: () => void;
}) {
  const { order, events } = result;
  const [businessName, setBusinessName] = useState(
    order.workspace.intake?.businessName || "",
  );
  const [goals, setGoals] = useState(order.workspace.intake?.goals || "");
  const [details, setDetails] = useState(order.workspace.intake?.details || "");
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const controllers = useRef(new Set<AbortController>());
  useEffect(
    () => () => {
      controllers.current.forEach((controller) => controller.abort());
      controllers.current.clear();
    },
    [],
  );
  const digital = isDigital(order);
  const paid = isPaid(order);
  const hasIntake = Boolean(
    order.workspace.intake?.businessName || order.workspace.intake?.goals,
  );
  const delivered = paid && !digital && order.workspace.state === "delivered";
  const path = `/api/customer/orders/${encodeURIComponent(order.id)}`;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    const controller = new AbortController();
    controllers.current.add(controller);
    try {
      const payload = await request<OrderResult>(`${path}/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          goals: goals.trim(),
          details: details.trim(),
          expectedRevision: order.workspace.revision,
        }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!checkOrder(payload.order))
        throw new Error(
          "The saved brief could not be confirmed. Refresh this order before trying again.",
        );
      setMessage("Your brief has been saved. Refreshing your order…");
      reload();
    } catch (problem) {
      if (
        !controller.signal.aborted &&
        !(problem instanceof DOMException && problem.name === "AbortError")
      )
        setError(
          problem instanceof CustomerRequestError && problem.status === 409
            ? "This order changed while you were editing. Keep a copy of your text, then refresh the order to review its latest details."
            : problem instanceof Error
              ? problem.message
              : "Your brief could not be saved. Please try again.",
        );
    } finally {
      controllers.current.delete(controller);
      pending.current = false;
      if (!controller.signal.aborted) setSaving(false);
    }
  }
  async function download() {
    if (downloading) return;
    setDownloading(true);
    setError("");
    const controller = new AbortController();
    controllers.current.add(controller);
    try {
      const endpoint = digital
        ? `/api/marketplace/download?orderId=${encodeURIComponent(order.id)}`
        : `${path}/download`;
      const payload = await request<{ url: string }>(endpoint, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const url = new URL(payload.url);
      if (url.protocol !== "https:")
        throw new Error("A secure download link could not be created.");
      window.location.assign(url.href);
    } catch (problem) {
      if (
        !controller.signal.aborted &&
        !(problem instanceof DOMException && problem.name === "AbortError")
      )
        setError(
          problem instanceof Error
            ? problem.message
            : "The download could not be opened. Please try again.",
        );
    } finally {
      controllers.current.delete(controller);
      if (!controller.signal.aborted) setDownloading(false);
    }
  }
  async function manageBilling() {
    if (billingBusy) return;
    setBillingBusy(true);
    setError("");
    const controller = new AbortController();
    controllers.current.add(controller);
    try {
      const payload = await request<{ url: string }>(`${path}/billing`, {
        method: "POST",
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const url = new URL(payload.url);
      if (
        url.origin !== "https://billing.stripe.com" ||
        url.username ||
        url.password
      )
        throw new Error("A secure billing session could not be opened.");
      window.location.assign(url.href);
    } catch (problem) {
      if (
        !controller.signal.aborted &&
        !(problem instanceof DOMException && problem.name === "AbortError")
      )
        setError(
          problem instanceof Error
            ? problem.message
            : "Subscription management could not be opened. Please try again.",
        );
    } finally {
      controllers.current.delete(controller);
      if (!controller.signal.aborted) setBillingBusy(false);
    }
  }
  const progress = digital
    ? [
        { title: "Purchase", done: paid },
        { title: "Download access", done: paid },
      ]
    : [
        { title: "Purchase", done: paid },
        { title: "Your brief", done: paid && hasIntake },
        {
          title: "In progress",
          done: paid && (order.workspace.state === "in_progress" || delivered),
        },
        { title: "Delivery", done: delivered },
      ];
  return (
    <>
      <header className={styles.detailHeading}>
        <Link href="/account" className={styles.backLink}>
          ← All orders
        </Link>
        <div className={styles.detailTitle}>
          <div>
            <span className={styles.eyebrow}>
              {order.businessName || "CQA MARKETPLACE"}
            </span>
            <h1>
              {order.title}
              <span>.</span>
            </h1>
            <p>
              Purchased {dateTime(order.createdAt)} <span>·</span>{" "}
              {money(order)}
            </p>
          </div>
          <OrderBadge order={order} />
        </div>
        <div className={styles.orderReference}>
          ORDER REFERENCE <code>{order.id}</code>
        </div>
      </header>
      {error && <ErrorPanel message={error} />}
      {message && (
        <div className={styles.successPanel} role="status">
          {message}
        </div>
      )}
      <ol className={styles.progressTrack} aria-label="Order progress">
        {progress.map((step, index) => (
          <li key={step.title} className={step.done ? styles.stepDone : ""}>
            <span aria-hidden="true">
              {step.done ? "✓" : String(index + 1).padStart(2, "0")}
            </span>
            <strong>{step.title}</strong>
          </li>
        ))}
      </ol>
      {!paid && (
        <div className={styles.workspaceNote}>
          <div className={styles.noteIcon} aria-hidden="true">
            ◇
          </div>
          <div>
            <strong>Payment must be confirmed before fulfilment.</strong>
            <p>
              Your current payment status is{" "}
              {order.paymentStatus.replaceAll("_", " ")}. If you have already
              paid, refresh this order in a moment or contact support.
            </p>
          </div>
          <button className={styles.secondaryButton} onClick={reload}>
            Refresh order
          </button>
        </div>
      )}
      <div className={styles.detailGrid}>
        <div className={styles.mainColumn}>
          {digital ? (
            <section className={styles.panel}>
              <span className={styles.eyebrow}>YOUR DIGITAL PURCHASE</span>
              <h2>{paid ? "Download your purchase" : "Your digital purchase"}</h2>
              <p className={styles.bodyCopy}>
                Eligible digital purchases are delivered through a protected
                download link. Your access is checked each time you request a
                file.
              </p>
              <button
                className={styles.primaryButton}
                disabled={!paid || downloading}
                onClick={() => void download()}
              >
                {downloading
                  ? "Preparing secure download…"
                  : "Download purchase"}{" "}
                <span aria-hidden="true">↓</span>
              </button>
              <Link href="/marketplace/library" className={styles.inlineLink}>
                View your digital library →
              </Link>
            </section>
          ) : delivered ? (
            <section className={`${styles.panel} ${styles.deliveryPanel}`}>
              <span className={styles.eyebrow}>
                DELIVERED TO YOUR WORKSPACE
              </span>
              <span className={styles.deliveryIcon} aria-hidden="true">
                ✓
              </span>
              <h2>Your delivery is here.</h2>
              <p className={styles.deliveryMessage}>
                {order.workspace.deliveryMessage ||
                  "Your order has been marked delivered. Review your brief and order activity below, or contact the business if you need anything else."}
              </p>
              {order.workspace.hasAsset && (
                <div className={styles.fileCard}>
                  <div>
                    <span className={styles.fileIcon} aria-hidden="true">
                      ↓
                    </span>
                    <div>
                      <strong>
                        {order.workspace.assetName || "Your deliverable"}
                      </strong>
                      <small>Protected file · access checked at download</small>
                    </div>
                  </div>
                  <button
                    className={styles.secondaryButton}
                    disabled={!paid || downloading}
                    onClick={() => void download()}
                  >
                    {downloading ? "Preparing…" : "Download ↓"}
                  </button>
                </div>
              )}
            </section>
          ) : (
            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <span className={styles.eyebrow}>PROJECT DETAILS</span>
                  <h2>
                    {hasIntake
                      ? "Your project brief"
                      : "Tell us what you’re building."}
                  </h2>
                </div>
                {hasIntake && (
                  <span className={`${styles.badge} ${styles.ready}`}>
                    Saved brief
                  </span>
                )}
              </div>
              <p className={styles.bodyCopy}>
                {order.workspace.state === "in_progress"
                  ? "Work is underway. Your current brief is below; contact support if anything important changes."
                  : "Tell the business what you need. These details are saved with your order."}
              </p>
              <form
                onSubmit={(event) => void save(event)}
                className={styles.intakeForm}
              >
                <label htmlFor="business-name">
                  Business or project name <span>Required</span>
                </label>
                <input
                  id="business-name"
                  autoComplete="organization"
                  maxLength={160}
                  required
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  disabled={
                    !paid || saving || order.workspace.state === "in_progress"
                  }
                  placeholder="The name behind your project"
                />
                <label htmlFor="project-goals">
                  What would you like to achieve? <span>Required</span>
                </label>
                <textarea
                  id="project-goals"
                  rows={4}
                  maxLength={3000}
                  required
                  value={goals}
                  onChange={(event) => setGoals(event.target.value)}
                  disabled={
                    !paid || saving || order.workspace.state === "in_progress"
                  }
                  placeholder="Your goals, your audience and what success looks like."
                />
                <label htmlFor="project-details">
                  Anything else we should know? <span>Optional</span>
                </label>
                <textarea
                  id="project-details"
                  rows={5}
                  maxLength={6000}
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  disabled={
                    !paid || saving || order.workspace.state === "in_progress"
                  }
                  placeholder="Relevant links, style preferences, requirements or useful context. Please don’t include passwords or payment details."
                />
                <div className={styles.formFooter}>
                  <p>
                    {order.workspace.state === "in_progress"
                      ? "Your brief is with the business."
                      : "You can review your saved brief here at any time."}
                  </p>
                  {order.workspace.state !== "in_progress" && (
                    <button
                      className={styles.primaryButton}
                      disabled={
                        !paid || saving || !businessName.trim() || !goals.trim()
                      }
                      type="submit"
                    >
                      {saving
                        ? "Saving your brief…"
                        : hasIntake
                          ? "Save changes"
                          : "Send project brief"}{" "}
                      <span aria-hidden="true">→</span>
                    </button>
                  )}
                </div>
              </form>
            </section>
          )}
          {delivered && order.workspace.intake && (
            <section className={styles.panel}>
              <span className={styles.eyebrow}>YOUR PROJECT DETAILS</span>
              <h2>{order.workspace.intake.businessName}</h2>
              <h3 className={styles.smallHeading}>Your goals</h3>
              <p className={styles.deliveryMessage}>
                {order.workspace.intake.goals}
              </p>
              {order.workspace.intake.details && (
                <>
                  <h3 className={styles.smallHeading}>Project details</h3>
                  <p className={styles.deliveryMessage}>
                    {order.workspace.intake.details}
                  </p>
                </>
              )}
            </section>
          )}
          <section className={styles.panel} aria-labelledby="activity-title">
            <div className={styles.panelHeading}>
              <div>
                <span className={styles.eyebrow}>
                  A CLEAR VIEW OF WHAT’S HAPPENING
                </span>
                <h2 id="activity-title">Order activity</h2>
              </div>
              <button className={styles.textButton} onClick={reload}>
                Refresh ↻
              </button>
            </div>
            {events.length ? (
              <ol className={styles.timeline}>
                {events.map((event) => (
                  <li key={event.id}>
                    <i aria-hidden="true" />
                    <div>
                      <strong>{event.kind.replaceAll("_", " ")}</strong>
                      <p>{event.message}</p>
                      <time dateTime={event.createdAt}>
                        {dateTime(event.createdAt, true)}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.bodyCopy}>
                No updates have been posted to this order yet. New activity will
                appear here.
              </p>
            )}
          </section>
        </div>
        <aside className={styles.detailAside}>
          <section className={styles.summaryPanel}>
            <span className={styles.eyebrow}>YOUR PURCHASE</span>
            <h2>Order summary</h2>
            <dl>
              <div>
                <dt>Business</dt>
                <dd>{order.businessName || "CQA marketplace"}</dd>
              </div>
              <div>
                <dt>Purchase type</dt>
                <dd>{digital ? "Digital download" : "Service delivery"}</dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd className={paid ? styles.paidText : ""}>
                  {paid
                    ? "Confirmed"
                    : order.paymentStatus.replaceAll("_", " ")}
                </dd>
              </div>
              <div>
                <dt>Purchased</dt>
                <dd>{dateTime(order.createdAt)}</dd>
              </div>
              <div className={styles.totalRow}>
                <dt>Order total</dt>
                <dd>{money(order)}</dd>
              </div>
            </dl>
            {order.offerType === "subscription" && (
              <button
                className={styles.primaryButton}
                disabled={billingBusy}
                onClick={() => void manageBilling()}
              >
                {billingBusy
                  ? "Opening secure billing…"
                  : "Manage subscription"}
              </button>
            )}
            {order.machineSlug && (
              <Link
                href={`/machine/${encodeURIComponent(order.machineSlug)}`}
                className={styles.secondaryButton}
              >
                Visit the machine →
              </Link>
            )}
          </section>
          <section className={styles.detailHelp}>
            <span aria-hidden="true">✧</span>
            <h3>We’re here to help.</h3>
            <p>
              Need clarification or have a question about this purchase? Include
              your order reference when you get in touch.
            </p>
            <Link
              href={`/contact?service=support&order=${encodeURIComponent(order.id)}`}
            >
              Contact support →
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}

export default function CustomerOrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const session = useCustomerSession(
    `/account/orders/${encodeURIComponent(orderId)}`,
  );
  const { request, key: sessionKey, status: sessionStatus } = session;
  const [result, setResult] = useState<
    (OrderResult & { sessionKey: string }) | null
  >(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    setResult(null);
    setError("");
    if (sessionStatus !== "ready") return;
    const controller = new AbortController();
    const key = sessionKey;
    setLoading(true);
    void request<OrderResult>(
      `/api/customer/orders/${encodeURIComponent(orderId)}`,
      { signal: controller.signal },
    )
      .then((payload) => {
        if (controller.signal.aborted) return;
        if (
          !checkOrder(payload.order) ||
          !Array.isArray(payload.events) ||
          payload.events.some(
            (event) =>
              !event ||
              typeof event.id !== "string" ||
              typeof event.kind !== "string" ||
              typeof event.message !== "string" ||
              typeof event.createdAt !== "string",
          )
        )
          throw new Error(
            "Your order details could not be read. Please try again.",
          );
        setResult({ ...payload, sessionKey: key });
      })
      .catch((problem) => {
        if (!controller.signal.aborted && problem?.name !== "AbortError")
          setError(
            problem instanceof Error
              ? problem.message
              : "Your order could not be loaded.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [orderId, refresh, sessionKey, sessionStatus, request]);
  const visibleResult =
    result?.sessionKey === sessionKey && sessionStatus === "ready"
      ? result
      : null;
  return (
    <PortalFrame
      detail
      email={session.email}
      logout={() => void session.logout()}
      loggingOut={session.loggingOut}
    >
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
      ) : error ? (
        <>
          <Link href="/account" className={styles.backLink}>
            ← All orders
          </Link>
          <ErrorPanel
            message={error}
            retry={() => setRefresh((value) => value + 1)}
          />
        </>
      ) : loading || !visibleResult ? (
        <LoadingPanel text="Opening your order…" />
      ) : (
        <OrderWorkspace
          key={`${sessionKey}:${visibleResult.order.id}:${visibleResult.order.workspace.revision}`}
          result={visibleResult}
          request={request}
          reload={() => setRefresh((value) => value + 1)}
        />
      )}
    </PortalFrame>
  );
}
