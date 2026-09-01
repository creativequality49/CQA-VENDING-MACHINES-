import Link from "next/link";

const machines = [
  {
    name: "Creator Content Machine",
    tag: "CREATOR",
    description: "A repeatable content engine for AI images, short-form video, captions, scheduling and digital pack delivery.",
    accent: "pink",
    price: "From $997",
    href: "/creator-studio",
    features: ["Content pipeline", "Prompt system", "Posting workflow"],
  },
  {
    name: "Lead Capture Machine",
    tag: "LEADS",
    description: "Discover, qualify and organise prospects with a practical lead-generation workflow built for local businesses.",
    accent: "cyan",
    price: "$997",
    href: "/lead-machine",
    features: ["Lead discovery", "Scoring logic", "CSV export"],
  },
  {
    name: "Sales Follow-Up Machine",
    tag: "SALES",
    description: "Turn enquiries into structured follow-up with email, SMS and pipeline sequences that stop leads going cold.",
    accent: "violet",
    price: "$1,497",
    href: "/machines",
    features: ["Follow-up sequences", "Pipeline logic", "Conversion prompts"],
  },
  {
    name: "Business Automation Machine",
    tag: "OPS",
    description: "A connected automation blueprint for intake, delivery, admin, customer communication and internal workflows.",
    accent: "gold",
    price: "$2,989",
    href: "/machines",
    features: ["Workflow map", "Automation stack", "Launch checklist"],
  },
];

const flow = [
  ["01", "Choose", "Select the machine that solves the most expensive bottleneck in your business."],
  ["02", "Pay", "Purchase securely at a fixed AUD price with no sales call required."],
  ["03", "Intake", "Complete a guided online intake so the machine can be configured around your business."],
  ["04", "Receive", "Open your customer workspace with workflows, prompts, templates and implementation steps."],
];

const stats = [
  ["24/7", "Digital delivery"],
  ["AUD", "Fixed pricing"],
  ["0", "Mandatory calls"],
  ["1", "Customer workspace"],
];

export default function HomePage() {
  return (
    <main className="home-page">
      <section className="hero-shell">
        <div className="hero-orb hero-orb-one" />
        <div className="hero-orb hero-orb-two" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Creative Quality Australia · Digital Vending Machines</span>
            <h1>
              Buy an automation machine.<br />
              <span>Put a business process on repeat.</span>
            </h1>
            <p className="hero-lead">
              CQA turns common business bottlenecks into fixed-price digital systems for content, leads, sales follow-up and operations—delivered through a guided online workflow.
            </p>
            <div className="hero-actions">
              <Link href="/quiz" className="button primary">Find My Machine</Link>
              <Link href="/machines" className="button ghost">Browse Machines</Link>
            </div>
            <div className="proof-row">
              {stats.map(([value, label]) => (
                <div className="proof-item" key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="vending-stage" aria-label="CQA digital vending machine preview">
            <div className="vending-shell">
              <div className="vending-head">
                <div className="brand-badge">CQA</div>
                <div className="live-pill"><i /> SYSTEM LIVE</div>
              </div>
              <div className="vending-screen">
                <span>DIGITAL VENDING OS</span>
                <strong>SELECT YOUR<br />MACHINE</strong>
                <small>BUY → INTAKE → DELIVERY</small>
              </div>
              <div className="vending-slots">
                {["CONTENT", "LEADS", "SALES", "ONBOARD", "REVIEWS", "AUTOMATE"].map((slot, index) => (
                  <div className="vending-slot" key={slot}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <b>{slot}</b>
                  </div>
                ))}
              </div>
              <div className="vending-console">
                <div>
                  <span>STATUS</span>
                  <strong>READY TO DISPENSE</strong>
                </div>
                <Link href="/quiz">START</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container section-block" id="machines">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Machine marketplace</span>
            <h2>Choose the system that removes the bottleneck.</h2>
          </div>
          <p>Start with one machine. Add more only when the first workflow is earning back time or revenue.</p>
        </div>

        <div className="machine-grid-home">
          {machines.map((machine) => (
            <article className={`machine-card-home ${machine.accent}`} key={machine.name}>
              <div className="machine-card-topline">
                <span>{machine.tag}</span>
                <strong>{machine.price}</strong>
              </div>
              <div className="machine-card-visual">
                <div className="machine-window"><span>{machine.tag.slice(0, 2)}</span></div>
                <div className="machine-dots">{Array.from({ length: 8 }).map((_, index) => <i key={index} />)}</div>
              </div>
              <h3>{machine.name}</h3>
              <p>{machine.description}</p>
              <ul>
                {machine.features.map((feature) => <li key={feature}>{feature}</li>)}
              </ul>
              <Link href={machine.href} className="card-link">Open machine <span>→</span></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="dark-band">
        <div className="container section-block">
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">The vending flow</span>
              <h2>From purchase to usable system.</h2>
            </div>
          </div>
          <div className="flow-grid">
            {flow.map(([number, title, text]) => (
              <article className="flow-card" key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container section-block split-panel">
        <div>
          <span className="eyebrow">Built for repeatable revenue</span>
          <h2>Sell once. Deliver digitally. Keep the machine working.</h2>
          <p>
            The CQA model is designed around productised automation: clear scope, fixed pricing, guided intake, digital delivery and upgrade paths instead of endless custom quoting.
          </p>
        </div>
        <div className="revenue-stack">
          <div><span>01</span><strong>Entry product</strong><small>Low-friction first purchase</small></div>
          <div><span>02</span><strong>Core machine</strong><small>Main implementation offer</small></div>
          <div><span>03</span><strong>Recurring layer</strong><small>Ongoing support, drops or automation</small></div>
        </div>
      </section>

      <section className="container final-panel">
        <div>
          <span className="eyebrow">Not sure which machine to buy?</span>
          <h2>Get matched in under a minute.</h2>
          <p>Answer a short assessment and see which workflow is costing you the most time or money.</p>
        </div>
        <Link href="/quiz" className="button primary">Get My Match</Link>
      </section>
    </main>
  );
}
