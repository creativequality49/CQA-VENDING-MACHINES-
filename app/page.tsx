import Link from "next/link";

const machines = [
  { name: "Fitness Vault", niche: "Training, plans & memberships", theme: "pink", price: "$19/mo", icon: "FIT" },
  { name: "Creator Tools", niche: "Prompts, captions & launch kits", theme: "cyan", price: "$17", icon: "AI" },
  { name: "Beauty Bar", niche: "Guides, bookings & subscriptions", theme: "purple", price: "$29/mo", icon: "BB" },
  { name: "Business OS", niche: "Automation systems & templates", theme: "gold", price: "$47", icon: "OS" },
];

const benefits = [
  ["01", "Brand it", "Add your logo, colours, banner and creator identity."],
  ["02", "Load products", "Sell downloads, services, memberships and recurring drops."],
  ["03", "Launch", "Publish a mobile-first storefront built to convert around the clock."],
];

export default function HomePage() {
  return (
    <main>
      <section className="hero container">
        <div className="hero-copy">
          <span className="eyebrow">CQA Vending OS</span>
          <h1>Your brand.<br />Your products.<br /><span>Your vending machine.</span></h1>
          <p>
            Rent a premium digital vending machine, customise it to your brand and sell products,
            subscriptions and creator content through one high-converting storefront.
          </p>
          <div className="hero-actions">
            <Link href="/launch-machine" className="button primary">Launch Your Machine</Link>
            <Link href="/machines" className="button secondary">Explore Marketplace</Link>
          </div>
          <div className="hero-proof">
            <div><strong>24/7</strong><span>Automated selling</span></div>
            <div><strong>AUD</strong><span>Creator-first commerce</span></div>
            <div><strong>60 sec</strong><span>Secure delivery</span></div>
          </div>
        </div>

        <div className="hero-machine-wrap" aria-label="CQA digital vending machine preview">
          <div className="machine-glow" />
          <div className="vending-machine hero-machine">
            <div className="machine-top">
              <span className="machine-logo">CQA</span>
              <span className="machine-status"><i /> LIVE</span>
            </div>
            <div className="machine-display">
              <span className="display-label">FEATURED MACHINE</span>
              <h2>CREATOR<br />COMMERCE</h2>
              <p>Digital products · Memberships · Drops</p>
            </div>
            <div className="machine-grid">
              {["PROMPTS", "CONTENT", "TEMPLATES", "MEMBERSHIP", "COURSES", "BUNDLES"].map((item, index) => (
                <div className="machine-slot" key={item}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <b>{item}</b>
                </div>
              ))}
            </div>
            <div className="machine-console">
              <div><span>SELECT ITEM</span><strong>READY</strong></div>
              <button aria-label="Open machine">BUY NOW</button>
            </div>
          </div>
        </div>
      </section>

      <section className="market-section container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Marketplace</span>
            <h2>Choose your machine</h2>
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
                <span className="card-kicker">CQA MACHINE</span>
                <h3>{machine.name}</h3>
                <p>{machine.niche}</p>
                <div><strong>From {machine.price}</strong><Link href="/launch-machine">View →</Link></div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="how-section">
        <div className="container">
          <div className="section-heading centered">
            <div>
              <span className="eyebrow">Simple setup</span>
              <h2>From idea to income machine</h2>
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
          <span className="eyebrow">Built for creators</span>
          <h2>Stop selling from scattered links.</h2>
          <p>Give your brand one destination designed to look premium and convert.</p>
        </div>
        <Link href="/launch-machine" className="button primary">Build My Machine</Link>
      </section>
    </main>
  );
}
