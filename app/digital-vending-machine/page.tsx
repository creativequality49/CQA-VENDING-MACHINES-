"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./machine.module.css";

const destinations = [
  { id: "marketplace", label: "Merchant marketplace", href: "/marketplace", description: "Browse published business machines and their products. Delivery terms and checkout availability are checked per offer.", symbol: "▦" },
  { id: "kits", label: "Digital kits", href: "/digital-products", description: "Explore the digital product collection and its current availability.", symbol: "◇" },
  { id: "services", label: "Services", href: "/machines", description: "Browse service and business storefront concepts in the CQA collection.", symbol: "✦" },
  { id: "build", label: "Build your machine", href: "/onboarding", description: "Start a free design preview with your own business details.", symbol: "→" },
  { id: "workspace", label: "My workspace", href: "/login", description: "Sign in to access your existing CQA workspace.", symbol: "▦" },
];

export default function DigitalVendingMachinePage() {
  const [selection, setSelection] = useState(destinations[0]);
  const [lights, setLights] = useState(true);

  return <main className={styles.page}>
    <header className={styles.intro}>
      <span className={styles.eyebrow}>Creative Quality Australia / Interactive concept</span>
      <h1>CQA Digital<br />Vending Machine.</h1>
      <p>A digital vending machine with a CQA point of view. Choose a destination, then press ENTER to explore.</p>
    </header>
    <section className={styles.experience} aria-label="Interactive CQA digital vending machine">
      <div data-theme-art className={`${styles.stage} ${lights ? styles.lightsOn : styles.lightsOff}`}>
        <div className={styles.stageBar}><span>CQA / DIGITAL VENDING MACHINE</span><button type="button" aria-pressed={lights} onClick={() => setLights(value => !value)}>Accent lights: {lights ? "on" : "off"}</button></div>
        <div className={styles.art}>
          <Image src="/images/cqa-digital-vending-machine.png" alt="CQA branded digital vending machine with a robotic arm, glass cabinet, luminous digital icons and an ENTER control" width={1086} height={1448} priority sizes="(max-width: 800px) calc(100vw - 40px), 55vw" />
          <Link className={styles.enter} href={selection.href} aria-label={`Enter ${selection.label}`}><span>ENTER</span></Link>
        </div>
        <p className={styles.artNote}>Illustrative machine artwork · Select a destination to explore</p>
      </div>
      <div className={styles.panel}>
        <span className={styles.eyebrow}>01 / Make your selection</span>
        <h2>Where would you<br />like to begin?</h2>
        <div className={styles.choices} role="group" aria-label="Choose a destination">{destinations.map(destination => <button key={destination.id} type="button" aria-pressed={selection.id === destination.id} onClick={() => setSelection(destination)}><span className={styles.symbol} aria-hidden="true">{destination.symbol}</span><span>{destination.label}</span><span className={styles.indicator} aria-hidden="true" /></button>)}</div>
        <div className={styles.selection} role="status" aria-live="polite" aria-atomic="true"><span>Selected destination</span><h3>{selection.label}</h3><p>{selection.description}</p></div>
        <Link className={styles.action} href={selection.href}>Explore {selection.label.toLowerCase()} <span aria-hidden="true">→</span></Link>
        <p className={styles.note}>This interactive concept opens existing CQA pages. It does not take a payment or dispense a purchase. Live customer payments remain paused while launch verification is completed.</p>
        <Link className={styles.back} href="/">Back to CQA <span aria-hidden="true">←</span></Link>
      </div>
    </section>
  </main>;
}
