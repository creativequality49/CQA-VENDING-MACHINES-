import Link from "next/link";

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ marketplace?: string }> }) {
  const params = await searchParams;
  const marketplace = params.marketplace === "1";
  return (
    <main className="container" style={{ paddingBottom: "2rem" }}>
      <section className="glass-card" style={{ padding: "1rem" }}>
        <h1>Checkout submitted</h1>
        <p className="small">{marketplace
          ? "Thanks for your order. Stripe is confirming your payment. Keep your Stripe receipt for reference; the business will arrange delivery or the next service step."
          : "Stripe is confirming your payment. Your access will appear in your vault after confirmation."}</p>
        <Link className="button primary" href={marketplace ? "/marketplace" : "/vault"}>{marketplace ? "Return to marketplace" : "Open vault"}</Link>
      </section>
    </main>
  );
}
