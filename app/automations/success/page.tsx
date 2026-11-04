import Link from "next/link";

export const metadata = {
  title: "Automation Checkout Return | Creative Quality Australia"
};

export default function AutomationSuccessPage() {
  return (
    <main className="container" style={{ paddingTop: "4rem", paddingBottom: "6rem" }}>
      <section className="glass-card" style={{ maxWidth: 760, margin: "0 auto", padding: "2rem" }}>
        <span className="eyebrow">CHECKOUT RETURN</span>
        <h1>Thank you for choosing CQA.</h1>
        <p>You have returned from the checkout process. This page does not independently verify payment. Check your Stripe receipt or payment confirmation before assuming an order has been accepted.</p>
        <p className="small">To begin implementation, contact CQA with your business details, chosen automation, workflow requirements and systems to connect. CQA will confirm payment and scope before work starts. Do not send passwords or API secrets through the contact form.</p>
        <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap", marginTop: "1rem" }}>
          <Link href="/contact" className="button primary">Send Implementation Brief</Link>
          <Link href="/automations" className="button ghost">Back to Automations</Link>
        </div>
      </section>
    </main>
  );
}
