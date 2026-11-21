"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import styles from "@/app/account/account.module.css";
import type { CustomerOrder } from "./types";
import { orderState } from "./types";

export function PortalFrame({
  email,
  detail,
  logout,
  loggingOut,
  children,
}: {
  email?: string;
  detail?: boolean;
  logout: () => void;
  loggingOut: boolean;
  children: ReactNode;
}) {
  return (
    <main className={styles.portal}>
      <aside className={styles.sidebar} aria-label="Customer workspace">
        <Link href="/account" className={styles.workspaceBrand}>
          <span>
            CQ<span>A</span>
          </span>
          <small>CUSTOMER WORKSPACE</small>
        </Link>
        <div className={styles.navLabel}>YOUR WORKSPACE</div>
        <nav className={styles.nav}>
          <Link
            href="/account"
            aria-current={!detail ? "page" : undefined}
            className={!detail ? styles.selectedNav : ""}
          >
            <span aria-hidden="true">▦</span> My orders
          </Link>
          <Link href="/marketplace/library">
            <span aria-hidden="true">↓</span> Downloads
          </Link>
          <Link href="/machines">
            <span aria-hidden="true">◇</span> Browse marketplace
          </Link>
        </nav>
        <div className={styles.supportCard}>
          <span className={styles.supportIcon} aria-hidden="true">
            ✧
          </span>
          <strong>Need help with an order?</strong>
          <p>
            Questions about an order? Our team can help you find the next step.
          </p>
          <Link href="/contact?service=support">
            Contact support <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className={styles.sidebarFoot}>
          <span className={styles.avatar} aria-hidden="true">
            {email?.[0]?.toUpperCase() || "C"}
          </span>
          <div>
            <strong>Your account</strong>
            <small>{email || "Checking session…"}</small>
          </div>
          <button
            onClick={logout}
            disabled={loggingOut}
            aria-label="Sign out"
            title="Sign out"
          >
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>
      <section className={styles.content}>
        <div className={styles.topline}>
          <span>
            MY ACCOUNT <i>/</i> {detail ? "ORDER DETAILS" : "MY ORDERS"}
          </span>
          <Link href="/marketplace" className={styles.marketLink}>
            Visit marketplace <span aria-hidden="true">→</span>
          </Link>
        </div>
        {children}
      </section>
    </main>
  );
}
export function OrderBadge({ order }: { order: CustomerOrder }) {
  const state = orderState(order);
  return (
    <span className={`${styles.badge} ${styles[state.tone]}`}>
      <i aria-hidden="true" />
      {state.label}
    </span>
  );
}
export function LoadingPanel({
  text = "Loading your workspace…",
}: {
  text?: string;
}) {
  return (
    <div className={styles.loading} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      {text}
    </div>
  );
}
export function ErrorPanel({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className={styles.errorPanel} role="alert">
      <strong>Something needs attention</strong>
      <p>{message}</p>
      {retry && (
        <button className={styles.secondaryButton} onClick={retry}>
          Try again <span aria-hidden="true">↻</span>
        </button>
      )}
    </div>
  );
}
