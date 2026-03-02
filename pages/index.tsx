const machines = [
  {
    niche: "AI Creator Economy",
    machine: "The Prompt-to-Profit Engine",
    leadMagnet: "The AI Millionaire’s Toolkit (Top 50 Secret Prompts)",
    starter: "$27 — Ultimate Prompt Engineering Vault",
    pro: "$197 — AI Content Creation Masterclass (Video + Workflow)",
    elite: "$997 — 1-on-1 Brand Scaling Strategy",
    recurring: "$49/mo — The Alpha Lab (Weekly AI Tool Updates & Beta Prompts)",
  },
  {
    niche: "Digital Vending Systems",
    machine: "The Passive Asset Hub",
    leadMagnet: "The $0 to $1k Digital Blueprint",
    starter: "$37 — Digital Storefront Setup Kit",
    pro: "$297 — Whitelabel Product Bundle (Ready to Sell)",
    elite: "$1,500 — Done-For-You Digital Vending Machine Setup",
    recurring: "$29/mo — Monthly New High-Demand Digital Products to Sell",
  },
  {
    niche: "AI Influencer Brand (Scarlett May Style)",
    machine: "The Virtual Icon Factory",
    leadMagnet: "How to Create Your First AI Model in 5 Mins",
    starter: "$47 — Hyper-Realistic Face-Swap & Consistency Guide",
    pro: "$497 — AI Influencer Monetization Secrets (Fanvue/Sponsorships)",
    elite: "$2,500 — Custom AI Model Creation & Brand Identity Build",
    recurring: "$67/mo — The Creator Vault (Monthly Stock Backgrounds & Pose Prompts)",
  },
  {
    niche: "Tradie Lead Engine",
    machine: "The Job-Flow Matrix",
    leadMagnet: "The Tradie’s Guide to 5-Star Reviews on Autopilot",
    starter: "$97 — High-Converting Ad Templates for Tradies",
    pro: "$597 — Automated Lead Gen System (GHL Snapshot)",
    elite: "$3,000/mo — Fully Managed Ad Campaigns",
    recurring: "$99/mo — CRM & Automation Hosting",
  },
  {
    niche: "Automation for Business",
    machine: "The Time Reclaimer",
    leadMagnet: "10 Hours Saved: The Automation Checklist",
    starter: "$49 — 5 Essential Zapier/Make Templates",
    pro: "$997 — Custom Business Workflow Build-out",
    elite: "$5,000 — Full Enterprise Automation Audit & Implementation",
    recurring: "$149/mo — Monthly Workflow Optimization & Support",
  },
  {
    niche: "Manifestation / Wealth",
    machine: "The Frequency Tuner",
    leadMagnet: "The 5-Minute Abundance Frequency Meditation",
    starter: "$22 — The Quantum Wealth Journal (Digital)",
    pro: "$222 — Manifestation Mastery Video Course",
    elite: "$2,222 — High-Vibe 1-on-1 Coaching (8 Weeks)",
    recurring: "$33/mo — The Portal (Daily Energy Shifts & Moon Rituals)",
  },
  {
    niche: "Digital Money Systems",
    machine: "The Cashflow Architect",
    leadMagnet: "The Financial Freedom Calculator",
    starter: "$47 — Crypto & Stock Market Basics Guide",
    pro: "$497 — Automated Trading Bot Setup & Strategy",
    elite: "$5,000 — Private Wealth Management Strategy",
    recurring: "$97/mo — The Signal Room (Monthly Market Analysis & Alerts)",
  },
  {
    niche: "Kids Printables",
    machine: "The Parent’s Lifesaver",
    leadMagnet: "Free Weekend Fun Pack (10 Pages)",
    starter: "$17 — Seasonal Activity Mega-Bundle",
    pro: "$97 — Custom Learning Path (Personalized for Child)",
    elite: "$497 — Full Year Homeschooling Curriculum (Digital)",
    recurring: "$15/mo — Printable of the Month Club",
  },
  {
    niche: "Women Confidence",
    machine: "The Radiant Queen Blueprint",
    leadMagnet: "The 7-Day Self-Love Mirror Challenge",
    starter: "$37 — The Confidence Workbook",
    pro: "$497 — Inner Circle Transformation Mastermind",
    elite: "$3,000 — VIP Transformation Weekend (Virtual or In-Person)",
    recurring: "$47/mo — The Empowerment Circle (Weekly Group Calls)",
  },
  {
    niche: "Legal Survival Guides",
    machine: "The Shield",
    leadMagnet: "The Small Biz Legal Audit Checklist",
    starter: "$67 — Essential Contract Templates (NDAs, Service Agreements)",
    pro: "$497 — Full Business Compliance Kit",
    elite: "$2,000 — Private Legal Strategy Session (Referral Network)",
    recurring: "$39/mo — Document Update Service (Stay Compliant)",
  },
];

const rolloutPlan = [
  { month: "1", focus: "AI Creator Economy", task: "Launch Lead Magnet & Starter Product." },
  { month: "2", focus: "AI Influencer Brand", task: "Build Scarlett May assets & Pro Course." },
  { month: "3", focus: "Digital Vending Systems", task: "Set up whitelabel bundles & Pro level." },
  { month: "4", focus: "Automation for Biz", task: "Launch B2B templates & Elite Audit service." },
  { month: "5", focus: "Tradie Lead Engine", task: "Target local markets with Lead Gen System." },
  { month: "6", focus: "Manifestation / Wealth", task: "Launch Frequency Tuner & Recurring Portal." },
  { month: "7", focus: "Digital Money Systems", task: "Launch Cashflow Architect & Signal Room." },
  { month: "8", focus: "Women Confidence", task: "Launch Radiant Queen Blueprint & Inner Circle." },
  { month: "9", focus: "Kids Printables", task: "Scale SEO & Pinterest for Printable Club." },
  { month: "10", focus: "Legal Survival Guides", task: "Launch The Shield & Compliance Kit." },
  { month: "11", focus: "Optimization", task: "Review data, upsell Pro to Elite across all 10." },
  { month: "12", focus: "Scale", task: "Automate all 10 machines; focus on Elite sales." },
];

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#090909",
        color: "#f4f4f4",
        padding: "2rem",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <section style={{ marginBottom: "2rem" }}>
        <h1 style={{ color: "#ff2fb3", marginBottom: "0.5rem" }}>CQA Digital Vending Machine Ecosystem</h1>
        <p style={{ color: "#c9c9c9", maxWidth: "900px", lineHeight: 1.6 }}>
          A portfolio of 10 monetization machines, each with a lead magnet, value ladder, and recurring revenue offer.
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
          marginBottom: "2rem",
        }}
      >
        {machines.map((item, index) => (
          <article
            key={item.machine}
            style={{
              border: "1px solid #242424",
              borderRadius: "12px",
              padding: "1rem",
              background: "#131313",
            }}
          >
            <p style={{ margin: 0, color: "#8f8f8f", fontSize: "0.85rem" }}>Machine {index + 1}</p>
            <h2 style={{ margin: "0.35rem 0", color: "#ff76cf", fontSize: "1.1rem" }}>{item.niche}</h2>
            <p style={{ margin: "0 0 0.5rem", fontWeight: 700 }}>{item.machine}</p>
            <ul style={{ paddingLeft: "1rem", margin: 0, lineHeight: 1.55 }}>
              <li>
                <strong>Lead Magnet:</strong> {item.leadMagnet}
              </li>
              <li>
                <strong>Starter:</strong> {item.starter}
              </li>
              <li>
                <strong>Pro:</strong> {item.pro}
              </li>
              <li>
                <strong>Elite:</strong> {item.elite}
              </li>
              <li>
                <strong>Recurring:</strong> {item.recurring}
              </li>
            </ul>
          </article>
        ))}
      </section>

      <section>
        <h2 style={{ color: "#ff2fb3" }}>12-Month Rollout Plan</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
            <thead>
              <tr>
                <th style={tableHeaderCell}>Month</th>
                <th style={tableHeaderCell}>Focus Niche</th>
                <th style={tableHeaderCell}>Key Task</th>
              </tr>
            </thead>
            <tbody>
              {rolloutPlan.map((row) => (
                <tr key={row.month}>
                  <td style={tableBodyCell}>{row.month}</td>
                  <td style={tableBodyCell}>{row.focus}</td>
                  <td style={tableBodyCell}>{row.task}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const tableHeaderCell = {
  border: "1px solid #2e2e2e",
  textAlign: "left" as const,
  padding: "0.65rem",
  background: "#161616",
  color: "#ff76cf",
};

const tableBodyCell = {
  border: "1px solid #2e2e2e",
  textAlign: "left" as const,
  padding: "0.65rem",
};
