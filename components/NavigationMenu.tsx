"use client";

import Link from "next/link";
import { useRef } from "react";
import styles from "./NavBar.module.css";

export function NavigationMenu({ links }: { links: Array<[string, string]> }) {
  const menu = useRef<HTMLDetailsElement>(null);
  return <details ref={menu} className={styles.menu} onClick={event => {
    if (event.target instanceof Element && event.target.closest("a") && menu.current) menu.current.open = false;
  }} onKeyDown={event => {
    if (event.key === "Escape" && menu.current?.open) { menu.current.open = false; menu.current.querySelector("summary")?.focus(); }
  }}><summary aria-label="Open navigation menu">Menu <span aria-hidden="true">☰</span></summary><nav className={styles.panel} aria-label="Primary navigation">
    {links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
    <Link href="/workers">AI draft workers</Link><Link href="/automations">Automations</Link><Link href="/owner/orders">Order fulfilment</Link>
    <Link href="/login?next=/owner/dashboard" className={styles.workspace}>Your workspace →</Link>
  </nav></details>;
}
