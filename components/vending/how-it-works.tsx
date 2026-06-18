const steps = ["Choose a machine", "Add your logo", "Load your products", "Start selling"];

export function HowItWorks() {
  return <section className="how-grid">{steps.map((step, index) => <article className="glass-card how-step" key={step}><span>{index + 1}</span><h3>{step}</h3><p className="small">CQA hosts the neon vending experience while your brand sells products, services, downloads and memberships.</p></article>)}</section>;
}
