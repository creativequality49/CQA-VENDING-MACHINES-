import Link from "next/link";

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ marketplace?: string }> }) {
  const params = await searchParams;
  const marketplace = params.marketplace === "1";
  return (
    <main className="container" style={{ paddingBottom: "2rem" }}>
      <section className="glass-card" style={{ padding: "1rem" }}>
        <h1>Checkout submitted</h1>
        <p className="small">{marketplace
          ? "Once Stripe confirms payment, your digital pack appears in the purchase library for the account you used at checkout. Open your library and select Secure download beside the pack. If it hasn’t appeared yet, select Refresh."
          : "Stripe is confirming your payment. Your access will appear in your vault after confirmation."}</p>
        <Link className="button primary" href={marketplace ? "/marketplace/library" : "/vault"}>{marketplace ? "Open your purchase library" : "Open vault"}</Link>
        {marketplace ? <><p><Link className="button ghost" href="/account">Track a physical order or service in your customer workspace</Link></p><p><Link href="/marketplace">Return to marketplace</Link></p></> : null}
      </section>
    </main>
  );
}
