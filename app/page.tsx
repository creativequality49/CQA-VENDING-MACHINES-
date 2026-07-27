import Link from "next/link";

const machines = [
  { name: "Content Machine", niche: "90-day content plan, prompts and campaign assets", theme: "pink", price: "$997", icon: "CM" },
  { name: "Lead Capture Machine", niche: "Lead forms, CRM flow and instant follow-up", theme: "cyan", price: "$997", icon: "LC" },
  { name: "Sales Follow-Up Machine", niche: "Email, SMS and pipeline follow-up systems", theme: "purple", price: "$1,497", icon: "SF" },
  { name: "Business Automation Machine", niche: "Connected multi-function automation blueprint", theme: "gold", price: "$2,989", icon: "BA" },
];

const benefits = [
  ["01", "Buy your machine", "Choose a fixed-price automation system and pay securely through Stripe."],
  ["02", "Complete the intake", "Answer machine-specific questions online with no call required."],
  ["03", "Open delivery", "Access practical plans, workflows, prompts and implementation checklists."],
];

export default function HomePage() {
  return (
    <main>
      <section className="hero container">
        <div className="hero-copy">
          <span className="eyebrow">Creative Quality Australia</span>
          <h1>Buy the automation.<br />Complete the intake.<br /><span>Receive the system.</span></h1>
          <p>
            Fixed-price AI Business Machines turn guided online intake into practical plans,
            sequences, workflows, prompts and launch checklists for Australian businesses.
          </p>
          <div className="hero-actions">
            <Link href="/quiz" className="button primary">Get Assessed</Link>
            <Link href="/machines" className="button secondary">Choose a Machine</Link>
          </div>
          <div className="hero-proof">
            <div><strong>No calls</strong><span>Guided online intake</span></div>
            <div><strong>AUD</strong><span>Fixed transparent pricing</span></div>
            <div><strong>Secure</strong><span>Workspace delivery</span></div>
          </div>
        </div>

        <div className="hero-machine-wrap" aria-label="CQA automation vending machine preview">
          <div className="machine-glow" />
          <div className="vending-machine hero-machine">
            <div className="machine-top">
              <span className="machine-logo">CQA</span>
              <span className="machine-status"><i /> LIVE</span>
            </div>
            <div className="machine-display">
              <span className="display-label">AI AUTOMATION MACHINE</span>
              <h2>BUSINESS<br />ONRAMP</h2>
              <p>Intake · Blueprint · Delivery</p>
            </div>
            <div className="machine-grid">
              {["CONTENT", "LEADS", "SALES", "ONBOARDING", "REVIEWS", "BUSINESS"].map((item, index) => (
                <div className="machine-slot" key={item}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <b>{item}</b>
                </div>
              ))}
            </div>
            <div className="machine-console">
              <div><span>SELECT SYSTEM</span><strong>READY</strong></div>
              <Link href="/quiz">ASSESS</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="market-section container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Fixed-price systems</span>
            <h2>Choose your automation machine</h2>
          </div>
          <Link href="/machines" className="text-link">View all machines →</Link>
        </div>

        <div className="machine-card-grid">
          {machines.map((machine) => (
            <article className={`market-card ${machine.theme}`} key={machine.name}>
              <div className="mini-machine">
                <div className="mini-screen"><span>{machine.icon}</span></div>
                <div className="mini-slots">
                  {Array.from({ length: 6 }).map((_, index) => <i key={index} />)}
                </div>
                <div className="mini-console" />
              </div>
              <div className="market-card-copy">
                <span className="card-kicker">CQA AI MACHINE</span>
                <h3>{machine.name}</h3>
                <p>{machine.niche}</p>
                <div><strong>AUD {machine.price}</strong><Link href="/machines">View →</Link></div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="how-section">
        <div className="container">
          <div className="section-heading centered">
            <div>
              <span className="eyebrow">How it works</span>
              <h2>From intake to implementation</h2>
            </div>
          </div>
          <div className="benefit-grid">
            {benefits.map(([number, title, text]) => (
              <article key={number} className="benefit-card">
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta container">
        <div>
          <span className="eyebrow">Not sure where to start?</span>
          <h2>Get your AI Readiness Score in 60 seconds.</h2>
          <p>See your estimated time and money loss, then match your business to the right CQA machine.</p>
        </div>
        <Link href="/quiz" className="button primary">Get Assessed</Link>
      </section>
    </main>
  );
}
