import Link from "next/link";

export function MachineRentalCard({ name, price, features, badge }: { name: string; price: string; features: string[]; badge?: string }) {
  return (
    <article className="rental-card">
      {badge ? <span className="slot-badge monthly">{badge}</span> : null}
      <h3>{name}</h3>
      <strong>{price}</strong>
      <ul>{features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
      <Link className="cta" href="/signup">Rent {name}</Link>
    </article>
  );
}
