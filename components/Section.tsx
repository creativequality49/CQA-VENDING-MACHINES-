import type { ReactNode } from "react";

export function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="glass-card section-wrap">
      <div className="section-head">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
