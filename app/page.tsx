import { products } from "@/lib/products";

const rolloutPlan = [
  { month: "1", focus: "AI Creator Economy", task: "Launch lead magnet and starter product." },
  { month: "2", focus: "AI Influencer Brand", task: "Build creator assets and pro offer." },
  { month: "3", focus: "Digital Vending Systems", task: "Enable whitelabel bundle operations." },
  { month: "4", focus: "Automation for Business", task: "Deploy B2B workflows and audit offer." },
];

export default function HomePage() {
  return (
    <main className="container">
      <header style={{ marginBottom: "2rem" }}>
        <h1 className="title" style={{ fontSize: "2rem" }}>
          Creative Quality Australia – Digital Vending Machine System
        </h1>
        <p className="muted">
          Premium CQA ecosystem with automated Stripe checkout, webhook fulfillment, and secure vault delivery.
        </p>
      </header>

      <section style={{ marginBottom: "2rem" }}>
        <h2 className="title">Pricing Tiers</h2>
        <div className="grid pricing-grid">
          {products.map((product) => (
            <article className="card" key={product.id}>
              <h3 style={{ marginTop: 0 }}>{product.name}</h3>
              <p style={{ fontSize: "1.8rem", margin: "0.5rem 0" }}>${product.price}</p>
              <p className="muted">{product.description}</p>
              <form action="/api/checkout" method="POST">
                <input type="hidden" name="productId" value={product.id} />
                <button className="button" type="submit">
                  Buy {product.name}
                </button>
              </form>
            </article>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 className="title">Platform Access</h2>
        <div className="grid pricing-grid">
          <a className="button button--ghost" href="/dashboard">
            Open Dashboard
          </a>
          <a className="button button--ghost" href="/vault">
            Open Vault
          </a>
        </div>
      </section>

      <section>
        <h2 className="title">90-Day Launch Snapshot</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Focus Niche</th>
                <th>Key Task</th>
              </tr>
            </thead>
            <tbody>
              {rolloutPlan.map((item) => (
                <tr key={item.month}>
                  <td>{item.month}</td>
                  <td>{item.focus}</td>
                  <td>{item.task}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
