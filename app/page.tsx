import Link from "next/link";

const bots = [
  ["01","Brand + Content AI","Creates branded content, product copy and campaign assets."],
  ["02","Sales AI","Qualifies leads, follows up and moves buyers toward checkout."],
  ["03","Marketing AI","Plans campaigns, social content and repeatable growth workflows."],
  ["04","Operations AI","Keeps recurring business tasks, handoffs and workflows moving."],
  ["05","Accounts AI","Organises sales and operational data for cleaner business oversight."],
  ["06","Support AI","Handles repeat questions and routes customers to the right next step."]
] as const;

export default function HomePage() {
  return <main className="home-page cqa-launch-home">
    <section className="hero-shell cqa-neon-hero">
      <div className="container launch-hero">
        <div className="hero-copy">
          <span className="eyebrow">CREATIVE QUALITY AUSTRALIA · DIGITAL BUSINESS OS</span>
          <h1>Your business. <span>Built into a digital vending machine.</span></h1>
          <p className="hero-lead">CQA combines a customer-facing sales machine with an AI workforce operating behind it. Sell products, subscriptions, services and digital offers while automation handles the repeatable work in the background.</p>
          <div className="hero-actions"><Link href="/onboarding" className="button primary">Build My Machine</Link><Link href="/marketplace" className="button ghost">Explore Live Machines</Link></div>
          <div className="launch-proof"><span><b>24/7</b> storefront</span><span><b>6+</b> AI worker roles</span><span><b>1</b> owner workspace</span></div>
        </div>
        <div className="launch-machine" aria-label="CQA digital vending machine preview">
          <div className="launch-machine-top"><span className="launch-cqa">CQΛ</span><span className="launch-online"><i/> SYSTEM ONLINE</span></div>
          <div className="launch-screen"><small>CREATIVE QUALITY AUSTRALIA</small><strong>DIGITAL BUSINESS<br/>VENDING MACHINE</strong><span>SELL · AUTOMATE · SCALE</span></div>
          <div className="launch-slots">
            <div><b>01</b><span>Digital Products</span><small>Instant delivery</small></div><div><b>02</b><span>Subscriptions</span><small>Recurring revenue</small></div>
            <div><b>03</b><span>Services</span><small>Bookings + leads</small></div><div><b>04</b><span>AI Workforce</span><small>Runs behind the scenes</small></div>
          </div>
          <div className="launch-console"><span>STRIPE READY</span><span>AI READY</span><span>OWNER CONTROLLED</span></div>
        </div>
      </div>
    </section>

    <section className="container section-block launch-demo-section">
      <div className="section-heading"><div><span className="eyebrow">SEE WHAT YOU ARE BUYING</span><h2>One machine in front. An AI operating system behind it.</h2></div><p>The customer sees a polished storefront. The owner gets the control layer, connected offers and AI workers that support the business.</p></div>
      <div className="demo-player">
        <div className="demo-player-bar"><span><i/> CQA PRODUCT DEMO</span><small>LIVE SYSTEM WALKTHROUGH</small></div>
        <div className="demo-canvas">
          <div className="demo-customer"><small>CUSTOMER VIEW</small><h3>Your branded vending machine</h3><div className="demo-products"><span>PRODUCT</span><span>MEMBERSHIP</span><span>SERVICE</span></div><b>SECURE CHECKOUT →</b></div>
          <div className="demo-flow"><span>ORDER</span><i>→</i><span>AUTOMATION</span><i>→</i><span>DELIVERY</span></div>
          <div className="demo-backend"><small>AI WORKFORCE</small>{["CONTENT","LEADS","SALES","SUPPORT"].map((x,i)=><div key={x}><i/><span>{x} AI</span><b>{i===0?"Creating assets":i===1?"Qualifying":i===2?"Following up":"Responding"}</b></div>)}</div>
        </div>
        <div className="demo-timeline"><i/><span>Storefront</span><span>Checkout</span><span>AI workflow</span><span>Owner dashboard</span></div>
      </div>
    </section>

    <section className="dark-band"><div className="container section-block">
      <div className="section-heading compact"><div><span className="eyebrow">YOUR BACKGROUND TEAM</span><h2>AI workers handle the repeatable work while you stay in control.</h2></div></div>
      <div className="bot-grid">{bots.map(([n,title,copy])=><article key={title}><span>{n}</span><i/><h3>{title}</h3><p>{copy}</p><small>READY TO CONNECT</small></article>)}</div>
    </div></section>

    <section className="container section-block">
      <div className="section-heading"><div><span className="eyebrow">WHAT THE CUSTOMER PAYS FOR</span><h2>A working digital business system—not just a website template.</h2></div></div>
      <div className="value-grid">
        <article><span>01</span><h3>Branded sales machine</h3><p>A customisable storefront for products, digital downloads, services and subscriptions.</p></article>
        <article><span>02</span><h3>Owner control centre</h3><p>Manage offers, machine setup, connected services and the workflows running behind your business.</p></article>
        <article><span>03</span><h3>AI workforce</h3><p>Add the AI roles your plan supports and automate repeatable content, sales, marketing and support tasks.</p></article>
        <article><span>04</span><h3>Connected commerce</h3><p>Designed around checkout, integrations and fulfilment so the machine can become an operating sales channel.</p></article>
      </div>
    </section>

    <section className="container launch-steps">
      <div><span>STEP 01</span><h3>Choose your plan</h3><p>Select the level of setup and AI support your business needs.</p></div><b>→</b>
      <div><span>STEP 02</span><h3>Tell CQA your business</h3><p>Brand, offers, colours, products, services and required integrations.</p></div><b>→</b>
      <div><span>STEP 03</span><h3>Launch your machine</h3><p>Publish the storefront and manage the system from your owner workspace.</p></div>
    </section>

    <section className="container final-panel launch-final"><div><span className="eyebrow">READY TO BUILD</span><h2>Turn your business into a digital vending machine.</h2><p>Start the CQA setup and build the system around what you actually sell.</p></div><div className="hero-actions"><Link href="/pricing" className="button ghost">View Plans</Link><Link href="/onboarding" className="button primary">Launch My Machine</Link></div></section>
    <style>{`
      .launch-hero{display:grid;grid-template-columns:1fr .86fr;gap:54px;align-items:center;padding:78px 0 86px}.launch-proof{display:flex;gap:10px;flex-wrap:wrap;margin-top:30px}.launch-proof span{padding:10px 13px;border:1px solid var(--border);border-radius:10px;color:#aeb0b8;font-size:11px}.launch-proof b{color:#fff;font-size:15px;margin-right:4px}.launch-machine{position:relative;padding:18px;border-radius:28px;border:1px solid rgba(32,217,255,.4);background:linear-gradient(145deg,#1a1d22,#050608 60%);box-shadow:0 40px 90px #000,0 0 55px rgba(32,217,255,.14),inset 0 0 30px rgba(32,217,255,.04)}.launch-machine:before{content:"";position:absolute;inset:7px;border:1px solid rgba(32,217,255,.18);border-radius:21px;pointer-events:none}.launch-machine-top,.launch-console{display:flex;justify-content:space-between;align-items:center;gap:10px}.launch-cqa{font-size:28px;font-weight:950;letter-spacing:-.08em}.launch-online{font-size:9px;color:#71ffac;letter-spacing:.12em}.launch-online i,.demo-player-bar i,.demo-backend i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#5dff9a;box-shadow:0 0 10px #5dff9a;margin-right:6px}.launch-screen{margin:15px 0 10px;padding:24px;border-radius:15px;border:1px solid rgba(255,47,179,.35);background:radial-gradient(circle at 80% 10%,rgba(255,47,179,.2),transparent 38%),#07080b}.launch-screen>*{display:block}.launch-screen small{font-size:8px;letter-spacing:.18em;color:#ff76cb}.launch-screen strong{font-size:25px;line-height:1.08;margin:10px 0}.launch-screen span{font-size:8px;letter-spacing:.18em;color:#8b8e98}.launch-slots{display:grid;grid-template-columns:1fr 1fr;gap:8px}.launch-slots div{min-height:100px;padding:13px;border-radius:12px;border:1px solid rgba(32,217,255,.18);background:#0b0d11;display:flex;flex-direction:column}.launch-slots b{font-size:9px;color:#36dcff}.launch-slots span{font-weight:850;margin-top:auto}.launch-slots small{font-size:9px;color:#777b85;margin-top:4px}.launch-console{margin-top:10px;padding:12px;border-top:1px solid var(--border);font-size:7px;letter-spacing:.12em;color:#8f929c}.demo-player{border:1px solid rgba(32,217,255,.25);border-radius:25px;background:#07090c;overflow:hidden;box-shadow:0 28px 70px rgba(0,0,0,.4)}.demo-player-bar{display:flex;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border);font-size:9px;letter-spacing:.14em}.demo-player-bar small{color:#747782}.demo-canvas{min-height:430px;padding:28px;display:grid;grid-template-columns:1fr auto 1fr;gap:24px;align-items:center;background:radial-gradient(circle at center,rgba(32,217,255,.08),transparent 35%)}.demo-customer,.demo-backend{padding:22px;border:1px solid var(--border);border-radius:18px;background:#0e1015}.demo-customer small,.demo-backend>small{font-size:8px;letter-spacing:.15em;color:#ff67c4}.demo-customer h3{font-size:25px;margin:9px 0 20px}.demo-products{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:16px}.demo-products span{padding:24px 6px;border:1px solid rgba(255,47,179,.2);border-radius:8px;text-align:center;font-size:7px;background:rgba(255,47,179,.04)}.demo-customer>b{display:block;padding:10px;border-radius:8px;text-align:center;background:#ff2fb3;font-size:8px}.demo-flow{display:flex;flex-direction:column;gap:9px;align-items:center}.demo-flow span{font-size:7px;padding:8px;border:1px solid rgba(32,217,255,.3);border-radius:99px;color:#55e4ff}.demo-flow i{font-style:normal;color:#565b65;transform:rotate(90deg)}.demo-backend{display:grid;gap:8px}.demo-backend div{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:7px;padding:9px;border-radius:9px;background:#080a0d}.demo-backend div span{font-size:9px;font-weight:850}.demo-backend div b{font-size:8px;color:#8a8e98}.demo-timeline{display:grid;grid-template-columns:40px repeat(4,1fr);gap:10px;align-items:center;padding:13px 18px;border-top:1px solid var(--border);font-size:8px;color:#858994}.demo-timeline>i{height:3px;background:#20d9ff;border-radius:99px;box-shadow:0 0 12px #20d9ff}.bot-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.bot-grid article,.value-grid article{position:relative;padding:22px;border:1px solid var(--border);border-radius:18px;background:#0e1014}.bot-grid article>span,.value-grid article>span{font-size:9px;color:#3ddfff;font-weight:900}.bot-grid article>i{position:absolute;right:18px;top:18px;width:7px;height:7px;border-radius:50%;background:#5dff9a;box-shadow:0 0 9px #5dff9a}.bot-grid h3,.value-grid h3{font-size:20px;margin:24px 0 8px}.bot-grid p,.value-grid p{color:#999ca6;line-height:1.55;font-size:13px}.bot-grid small{display:block;margin-top:18px;color:#5dff9a;font-size:7px;letter-spacing:.12em}.value-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.launch-steps{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;gap:22px;align-items:center;padding:15px 0 90px}.launch-steps>div{padding:22px;border-top:1px solid rgba(255,47,179,.35)}.launch-steps>div span{font-size:8px;color:#ff67c4;letter-spacing:.14em}.launch-steps h3{margin:10px 0 7px}.launch-steps p{color:#91949e;font-size:12px;line-height:1.5}.launch-steps>b{color:#3ddfff}.launch-final{margin-bottom:90px}.launch-final .hero-actions{margin:0}
      @media(max-width:900px){.launch-hero{grid-template-columns:1fr}.demo-canvas{grid-template-columns:1fr}.demo-flow{flex-direction:row;justify-content:center}.demo-flow i{transform:none}.bot-grid{grid-template-columns:repeat(2,1fr)}.value-grid{grid-template-columns:repeat(2,1fr)}.launch-steps{grid-template-columns:1fr}.launch-steps>b{display:none}}
      @media(max-width:560px){.launch-hero{padding:52px 0 64px}.launch-proof{display:grid;grid-template-columns:1fr 1fr}.launch-slots{grid-template-columns:1fr 1fr}.demo-canvas{padding:14px;min-height:0}.demo-products{grid-template-columns:1fr}.demo-timeline{grid-template-columns:1fr 1fr}.demo-timeline>i{display:none}.bot-grid,.value-grid{grid-template-columns:1fr}.launch-console{flex-wrap:wrap}.launch-steps{padding-bottom:65px}}
    `}</style>
  </main>;
}
