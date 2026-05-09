import Link from "next/link";

export default function ScarlettPage() {
  return (
    <main className="container" style={{ paddingBottom: "2rem" }}>
      <section className="glass-card" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <p className="small">scarlettmay.online funnel</p>
        <h1 className="section-title">Enter the Scarlett May Digital Vault</h1>
        <p className="small">Luxury AI influencer funnel with premium digital products and recurring access.</p>
        <Link className="cta" href="/machine/scarlett-vault">Open Scarlett Vault</Link>
      </section>
      <section className="grid grid-3" style={{ marginBottom: "1rem" }}>
        {[
          ["Starter Aesthetic Pack", "$97"],
          ["Pro Monetization Formula", "$297"],
          ["Elite Private Creator Access", "$997"],
        ].map(([name, price]) => (
          <article key={name} className="glass-card" style={{ padding: "1rem" }}>
            <h3>{name}</h3><p style={{ color: "#ff7bd3", fontWeight: 700 }}>{price}</p>
            <p className="small">Premium offer optimized for mobile conversion.</p>
          </article>
        ))}
      </section>
      <section className="glass-card" style={{ padding: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Social Proof</h2>
        <p className="small">“Our Scarlett funnel converted cold traffic into subscribers in 48 hours.”</p>
        <p className="small">“Daily drop automation turned one-time buyers into recurring MRR.”</p>
      </section>
    </main>
  );
}
