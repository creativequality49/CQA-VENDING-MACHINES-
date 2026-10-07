"use client";

import Link from "next/link";
import { useState } from "react";

const offers = [
  { name: "Lash Extensions", price: "$120", detail: "A full lash appointment" },
  { name: "Brow Package", price: "$89", detail: "Shape, tint and styling" },
  { name: "Beauty Membership", price: "$49/month", detail: "Member benefits and repeat visits" }
];
const steps = ["Choose a service", "Review checkout", "Order and confirmation", "Follow-up and membership"];

export default function BeautyDemoPage() {
  const [step, setStep] = useState(0);
  const [offer, setOffer] = useState(offers[0]);
  return <main className="container" style={{ paddingBlock: "3rem", maxWidth: 1100 }}>
    <p className="eyebrow">CQA · INTERACTIVE BEAUTY DEMO</p>
    <h1>Bella Beauty Studio</h1>
    <p>See the customer journey in about 60 seconds.</p>
    <p className="small" role="note">This is a simulation. No payment is charged, booking created, or email sent. The appointment time would be confirmed by the business.</p>
    <ol style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", paddingInlineStart: "1.5rem", marginBlock: "2rem" }}>{steps.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} style={{ color: step === index ? "#20d9ff" : "inherit" }}>{label}</li>)}</ol>
    <section className="glass-card" style={{ padding: "clamp(1rem, 4vw, 2.5rem)", minHeight: 300 }} aria-live="polite">
      {step === 0 && <><h2>Your next beauty appointment starts here.</h2><div className="grid grid-3">{offers.map(item => <article className="glass-card" key={item.name} style={{ padding: "1.25rem" }}><h3>{item.name}</h3><p>{item.detail}</p><p><strong>{item.price} AUD</strong></p><button type="button" className="button primary" onClick={() => { setOffer(item); setStep(1); }}>Choose {item.name}</button></article>)}</div></>}
      {step === 1 && <><span className="eyebrow">SIMULATED CHECKOUT</span><h2>{offer.name}</h2><p>{offer.price} AUD{offer.name === "Beauty Membership" ? " · recurring monthly" : " · one-time payment"}</p><p>On a live machine, secure Stripe checkout collects payment. Payment confirmation creates the owner’s order record.</p><button type="button" className="button primary" onClick={() => setStep(2)}>Simulate successful payment →</button></>}
      {step === 2 && <><span className="eyebrow">SIMULATED OWNER DASHBOARD</span><h2>Order received.</h2><p><strong>{offer.name}</strong> · {offer.price} AUD · Demo status: paid</p><p>The customer sees confirmation, and the owner sees the order in their dashboard. Appointment requests still need a confirmed time.</p><aside className="glass-card" style={{ padding: "1rem", marginBlock: "1rem" }}>Example confirmation: “Thanks for choosing Bella Beauty Studio. We’ve received your order and will confirm the appointment details.”</aside><button type="button" className="button primary" onClick={() => setStep(3)}>See the follow-up →</button></>}
      {step === 3 && <><span className="eyebrow">EXAMPLE FOLLOW-UP</span><h2>Give customers a reason to return.</h2><p>“Ready for your next visit? Explore our Beauty Membership at $49/month for repeat-visit benefits.”</p><p className="small">Live follow-up requires configured automation, a verified email sender and customer consent where required.</p><Link href="/pricing" className="button primary">Build My Digital Vending Machine →</Link></>}
      {step > 0 && <button type="button" className="button ghost" style={{ margin: ".75rem" }} onClick={() => setStep(step - 1)}>Back</button>}
    </section>
    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "1.5rem" }}><button className="button ghost" onClick={() => setStep(0)} type="button">Restart demo</button><Link href="/">Return to CQA</Link></div>
  </main>;
}
