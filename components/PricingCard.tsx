import type { ReactNode } from "react";

export function PricingCard({ name, price, bullets, cta }: { name: string; price: string; bullets: string[]; cta: ReactNode }) {
  return (
    <article className="glass-card" style={{ padding: "1rem" }}>
      <h3 style={{ marginTop: 0 }}>{name}</h3>
      <p style={{ color: "#ff7bd3", fontWeight: 800, fontSize: "1.4rem" }}>{price}</p>
      <ul className="small" style={{ paddingLeft: "1rem" }}>
        {bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
      <div style={{ marginTop: "1rem" }}>{cta}</div>
    </article>
  );
}
