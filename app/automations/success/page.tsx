import Link from "next/link";

export const metadata = { title: "Automation implementation brief | Creative Quality Australia" };

export default function AutomationSuccessPage() {
  return <main className="container" style={{ paddingTop: "3rem", paddingBottom: "6rem" }}>
    <section className="glass-card" style={{ maxWidth: 760, margin: "0 auto", padding: "clamp(1.25rem, 4vw, 2rem)" }}>
      <span className="eyebrow">YOUR NEXT STEP</span>
      <h1>Send CQA your implementation brief.</h1>
      <p>If you have completed Stripe checkout, keep your receipt or payment reference and send CQA the details below. Opening this page does not verify a payment or activate a service.</p>
      <ul style={{ lineHeight: 1.9, paddingLeft: "1.2rem" }}><li>The package or specialist worker you selected.</li><li>Your business name and contact details.</li><li>The outcome, current workflow and tools you want connected.</li><li>Your receipt reference, if you have purchased.</li></ul>
      <p>Confirm scope, access arrangements and delivery timing with CQA. Do not send passwords, API keys or card details through the contact form.</p>
      <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap", marginTop: "1.25rem" }}>
        <Link href="/contact?service=automation-implementation" className="button primary">Send My Implementation Brief</Link>
        <Link href="/automations" className="button ghost">Back to Automations</Link>
      </div>
    </section>
  </main>;
}
