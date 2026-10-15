import type { Metadata } from "next";
import Link from "next/link";
import FoundingForm from "./FoundingForm";
import styles from "./founding.module.css";

export const metadata: Metadata = { title: "CQA Founding Customers | Request Early Access", description: "Join the CQA founding-customer interest list for assisted setup of your first digital vending machine. No payment required." };

export default function FoundingCustomersPage() {
  return <main className={styles.page}>
    <section className={styles.hero}>
      <span className="eyebrow">CQA · FOUNDING CUSTOMER PROGRAMME</span>
      <p className={styles.badge}>Prelaunch interest list · customer launch pending verification</p>
      <h1>Your first digital vending machine.<br /><span>Built with guidance.</span></h1>
      <p className={styles.lede}>Give customers a clear place to discover your business, view your offers and take the next step. We’re preparing an assisted programme for our first 10 paying customers.</p>
      <div className={styles.actions}><a href="#early-access" className="button primary">Request early access</a><Link href="/#machine-build-demo" className="button ghost">Watch the example build</Link></div>
      <p className="small">We will invite suitable businesses after the essential customer journeys pass verification. Joining this list does not start a subscription.</p>
    </section>
    <section className={styles.grid} aria-label="Proposed programme">
      <article className={styles.card}><span className="eyebrow">THE PROPOSED STARTER PLAN</span><h2>$97 AUD<span className={styles.period}> / month</span></h2><p>Plus a 5% platform fee on sales and Stripe processing fees. Final inclusions and any separately quoted setup work will be confirmed before you decide to pay.</p><p>No discount, free setup package or guaranteed sales are promised.</p></article>
      <article className={styles.card}><span className="eyebrow">START WITH ONE CLEAR OFFER</span><h2>A practical first launch</h2><p>Guidance through your business details, branding, first offer, payment account connection and publishing checks.</p><p>Starter uses guided manual setup. Advanced AI workers and digital-download delivery are not promised as part of this early-access offer.</p></article>
    </section>
    <section className={styles.section}><span className="eyebrow">FROM INTEREST TO YOUR FIRST PUBLISHED MACHINE</span><h2>A clear path, with checks before launch.</h2><ol className={styles.steps}><li><b>Request early access</b><span>Tell us about your business and the first offer you want to sell.</span></li><li><b>Review your fit and plan</b><span>We discuss scope and confirm pricing and readiness before any payment.</span></li><li><b>Prepare your machine</b><span>Create your account, add branding and offers, then connect your own Stripe account.</span></li><li><b>Check and publish</b><span>Review the customer journey with guidance before sharing your machine.</span></li></ol></section>
    <section id="early-access" className={`${styles.section} ${styles.signup}`}><div><span className="eyebrow">EXPRESS YOUR INTEREST</span><h2>Be considered for the first 10.</h2><p>We are collecting interest while launch testing continues. You can ask questions and review the proposed service before choosing whether to join.</p><p>Payment activation, Stripe verification and publishing depend on the required checks passing. There is no launch date or place guarantee.</p></div><div className={styles.card}><FoundingForm /></div></section>
  </main>;
}
