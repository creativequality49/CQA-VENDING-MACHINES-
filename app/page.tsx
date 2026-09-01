import Link from "next/link";

const modules = [
  {
    name: "AI Admin Core",
    tag: "CORE",
    description: "Your company’s dedicated AI administration layer, configured around how you operate, communicate, manage customers and complete recurring office work.",
    accent: "pink",
    price: "Custom build",
    href: "/quiz",
    features: ["AI admin assistants", "Company workflows", "Customer communication", "Task automation"],
  },
  {
    name: "Financial Services Add-On",
    tag: "FINANCE",
    description: "Extend your machine with finance administration workflows such as invoice preparation, payment follow-up, expense organisation and reporting support.",
    accent: "gold",
    price: "Add-on",
    href: "/quiz",
    features: ["Invoice workflows", "Payment follow-up", "Expense admin", "Reporting support"],
  },
  {
    name: "Sales & Lead Add-On",
    tag: "SALES",
    description: "Add lead capture, qualification, CRM organisation and structured follow-up to your company machine.",
    accent: "cyan",
    price: "Add-on",
    href: "/lead-machine",
    features: ["Lead capture", "Qualification", "CRM workflow", "Follow-up sequences"],
  },
  {
    name: "Content & Marketing Add-On",
    tag: "GROWTH",
    description: "Add AI-assisted content planning, campaign production, publishing workflows and marketing administration.",
    accent: "violet",
    price: "Add-on",
    href: "/creator-studio",
    features: ["Content engine", "Campaign workflows", "Publishing system", "Marketing admin"],
  },
];

const flow = [
  ["01", "Purchase", "Choose your company AI Admin build and any additional service modules you need."],
  ["02", "Business Survey", "After payment, complete a detailed online survey covering who you are, what you do, your customers, current processes, bottlenecks, tools and goals."],
  ["03", "AI Build Team", "CQA’s dedicated AI build agents process your answers and assemble the workflows, assistants, structure and configuration for your company."],
  ["04", "Quality & Handoff", "Your company vending machine is prepared for handoff with the systems and implementation material included in your purchased scope."],
  ["05", "Run on CQA", "Optionally keep the machine hosted on the CQA platform with a monthly dashboard plan for ongoing access, management, promotion and future modules."],
];

const stats = [
  ["AI", "Dedicated build team"],
  ["1", "Company machine"],
  ["24/7", "Dashboard access"],
  ["+", "Expandable modules"],
];

export default function HomePage() {
  return (
    <main className="home-page">
      <section className="hero-shell">
        <div className="hero-orb hero-orb-one" />
        <div className="hero-orb hero-orb-two" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Creative Quality Australia · AI Company Infrastructure</span>
            <h1>
              Your company.<br />
              <span>Your AI admin team. Your vending machine.</span>
            </h1>
            <p className="hero-lead">
              CQA builds a dedicated AI-powered business operating system around your company. Purchase the build, complete one detailed business survey, and our AI build team configures your administration workflows and selected service modules for delivery.
            </p>
            <div className="hero-actions">
              <Link href="/quiz" className="button primary">Build My Company Machine</Link>
              <Link href="#modules" className="button ghost">Explore Add-Ons</Link>
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

          <div className="vending-stage" aria-label="CQA company AI vending machine preview">
            <div className="vending-shell">
              <div className="vending-head">
                <div className="brand-badge">CQA</div>
                <div className="live-pill"><i /> AI TEAM READY</div>
              </div>
              <div className="vending-screen">
                <span>YOUR COMPANY AI OS</span>
                <strong>AI ADMIN<br />CORE</strong>
                <small>SURVEY → AI BUILD → HANDOFF</small>
              </div>
              <div className="vending-slots">
                {["ADMIN", "FINANCE", "LEADS", "SALES", "MARKETING", "SUPPORT"].map((slot, index) => (
                  <div className="vending-slot" key={slot}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <b>{slot}</b>
                  </div>
                ))}
              </div>
              <div className="vending-console">
                <div><span>COMPANY SYSTEM</span><strong>READY TO CONFIGURE</strong></div>
                <Link href="/quiz">START</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container section-block" id="modules">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Build your company machine</span>
            <h2>Start with AI Admin. Add the departments you need.</h2>
          </div>
          <p>The machine is not a generic downloadable blueprint. It is configured from your company survey and expanded with functional modules that match the way your business operates.</p>
        </div>

        <div className="machine-grid-home">
          {modules.map((machine) => (
            <article className={`machine-card-home ${machine.accent}`} key={machine.name}>
              <div className="machine-card-topline"><span>{machine.tag}</span><strong>{machine.price}</strong></div>
              <div className="machine-card-visual">
                <div className="machine-window"><span>{machine.tag.slice(0, 2)}</span></div>
                <div className="machine-dots">{Array.from({ length: 8 }).map((_, index) => <i key={index} />)}</div>
              </div>
              <h3>{machine.name}</h3>
              <p>{machine.description}</p>
              <ul>{machine.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
              <Link href={machine.href} className="card-link">Add to my machine <span>→</span></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="dark-band">
        <div className="container section-block">
          <div className="section-heading compact">
            <div><span className="eyebrow">What happens after payment</span><h2>Your purchase starts the build.</h2></div>
          </div>
          <div className="flow-grid">
            {flow.map(([number, title, text]) => (
              <article className="flow-card" key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>
            ))}
          </div>
        </div>
      </section>

      <section className="container section-block split-panel">
        <div>
          <span className="eyebrow">Two ways to own and operate</span>
          <h2>Take the build—or keep running it through CQA.</h2>
          <p>Once your machine is built, the purchased deliverables can be handed over. For businesses that want an ongoing operating layer, CQA can also provide a monthly platform plan with secure dashboard access, machine management, ongoing module access and promotional opportunities.</p>
        </div>
        <div className="revenue-stack">
          <div><span>01</span><strong>Build & Handoff</strong><small>Purchase → survey → AI build → customer delivery</small></div>
          <div><span>02</span><strong>Platform Dashboard</strong><small>Login to operate and manage your company machine</small></div>
          <div><span>03</span><strong>Monthly Growth Layer</strong><small>Hosting, promotion, management and additional modules</small></div>
        </div>
      </section>

      <section className="container final-panel">
        <div>
          <span className="eyebrow">Build around your actual company</span>
          <h2>Tell the AI build team how your business works.</h2>
          <p>Start the assessment so CQA can determine the right AI Admin core and service modules for your company.</p>
        </div>
        <Link href="/quiz" className="button primary">Start My Company Build</Link>
      </section>
    </main>
  );
}
