"use client";

import Image from "next/image";
import { useId, useState } from "react";

export type VendingConsoleItem = {
  code: string;
  title: string;
  description: string;
  price?: string;
  image?: string;
  href: string;
};

export default function VendingConsole({ items, title = "CQA VENDING", label = "Your business. Ready to select." }: {
  items: VendingConsoleItem[];
  title?: string;
  label?: string;
}) {
  const [selectedCode, setSelectedCode] = useState(items[0]?.code);
  const selectionId = useId();
  const selected = items.find((item) => item.code === selectedCode) ?? items[0];
  if (!selected) return null;

  return (
    <section className="cqvm" aria-label={`${title} interactive preview`}>
      <div className="cqvm-topline"><span>CQA / DIGITAL VENDING SYSTEM</span><span>INTERACTIVE PREVIEW</span></div>
      <div className="cqvm-cabinet">
        <span className="cqvm-bolt cqvm-bolt-tl" aria-hidden="true" /><span className="cqvm-bolt cqvm-bolt-tr" aria-hidden="true" />
        <header className="cqvm-header"><div><strong>{title}</strong><span>{label}</span></div><span className="cqvm-status"><i aria-hidden="true" /> EXPLORE</span></header>
        <div className="cqvm-main">
          <div className="cqvm-glass">
            <div className="cqvm-glass-label"><span>SELECT YOUR NEXT MOVE</span><span aria-hidden="true">↓</span></div>
            <div className="cqvm-bays">
              {items.map((item) => (
                <button key={item.code} type="button" className={`cqvm-bay${selected.code === item.code ? " cqvm-bay-selected" : ""}`} aria-pressed={selected.code === item.code} aria-controls={selectionId} onClick={() => setSelectedCode(item.code)}>
                  <span className="cqvm-bay-code">{item.code}</span>
                  <span className="cqvm-product"><Image src={item.image || "/images/slots/tablet.svg"} alt="" width={96} height={96} /></span>
                  <span className="cqvm-bay-name">{item.title}</span>
                  <span className="cqvm-shelf" aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="cqvm-glass-bottom"><span>YOUR BRAND. YOUR COLLECTION.</span><span aria-hidden="true">CQA</span></div>
          </div>

          <aside className="cqvm-control" aria-label="Selection controls">
            <span className="cqvm-control-label">SELECTION TERMINAL</span>
            <div className="cqvm-display" id={selectionId} role="status" aria-live="polite" aria-atomic="true">
              <span className="cqvm-display-code">{selected.code}<small>SELECTED</small></span>
              <strong>{selected.title}</strong>
              <p>{selected.description}</p>
              {selected.price ? <span className="cqvm-price">{selected.price}</span> : null}
            </div>
            <div className="cqvm-keypad" aria-label="Choose a product bay">
              {items.map((item) => <button type="button" key={item.code} aria-label={`Select ${item.code}: ${item.title}`} aria-pressed={selected.code === item.code} aria-controls={selectionId} onClick={() => setSelectedCode(item.code)}>{item.code}</button>)}
            </div>
            <a className="cqvm-action" href={selected.href}>Explore selection <span aria-hidden="true">↗</span></a>
            <div className="cqvm-reader" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M5 8a6 6 0 0 1 0 8M9 5a10 10 0 0 1 0 14M13 2a14 14 0 0 1 0 20" /></svg><span>PREVIEW MODE<br /><b>No payment taken</b></span></div>
          </aside>
        </div>
        <div className="cqvm-collection"><div><span>COLLECTION BAY</span><strong>Your next business idea starts here.</strong></div><span className="cqvm-tray-handle" aria-hidden="true" /></div>
        <footer className="cqvm-base"><span>DESIGNED FOR YOUR BUSINESS</span><span>CREATIVE QUALITY AUSTRALIA</span></footer>
        <span className="cqvm-bolt cqvm-bolt-bl" aria-hidden="true" /><span className="cqvm-bolt cqvm-bolt-br" aria-hidden="true" />
      </div>
      <div className="cqvm-feet" aria-hidden="true"><i /><i /></div>
    </section>
  );
}
