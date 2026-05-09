const metrics = [
  { label: "Revenue", value: "$42,680" },
  { label: "Orders", value: "312" },
  { label: "Products", value: "8" },
  { label: "Subscriptions", value: "76" },
];

export default function AdminPage() {
  return (
    <main className="container" style={{ paddingBottom: "2rem" }}>
      <h1 className="section-title">Admin Dashboard</h1>
      <section className="grid grid-2" style={{ marginBottom: "1rem" }}>
        {metrics.map((metric) => (
          <article key={metric.label} className="glass-card" style={{ padding: "1rem" }}>
            <p className="small" style={{ margin: 0 }}>{metric.label}</p>
            <h2>{metric.value}</h2>
          </article>
        ))}
      </section>
      <section className="grid grid-2">
        <article className="glass-card" style={{ padding: "1rem" }}>
          <h3>Machines</h3>
          <p className="small">scarlett-vault, store</p>
          <h3>Content Drops</h3>
          <p className="small">Scheduled + released drop visibility.</p>
        </article>
        <article className="glass-card" style={{ padding: "1rem" }}>
          <h3>Product Management (placeholder UI)</h3>
          <div className="small">Price IDs, status toggles, machine assignment controls can be wired to DB next.</div>
        </article>
      </section>
    </main>
  );
}
