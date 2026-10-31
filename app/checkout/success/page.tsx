import Link from "next/link";

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ marketplace?: string }> }) {
  const params = await searchParams;
  const marketplace = params.marketplace === "1";
  return (
    <main className="container" style={{ paddingBottom: "2rem" }}>
      <section className="glass-card" style={{ padding: "1rem" }}>
        <h1>Checkout submitted</h1>
        <p className="small">{marketplace
          ? "Stripe payment confirmation is pending. Opening this page does not verify a payment. Purchased digital files appear in the buyer account used at checkout after the verified payment is processed. For services or physical products, follow the business’s delivery instructions."
          : "Stripe is confirming your payment. Your access will appear in your vault after confirmation."}</p>
        <Link className="button primary" href={marketplace ? "/marketplace/library" : "/vault"}>{marketplace ? "Open your purchase library" : "Open vault"}</Link>
        {marketplace ? <p><Link href="/marketplace">Return to marketplace</Link></p> : null}
      </section>
    </main>
  );
}
