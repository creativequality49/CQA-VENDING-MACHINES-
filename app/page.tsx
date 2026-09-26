import Link from "next/link";

const products = [
  ["BAGS","Essential","Functional"],
  ["PLUS","Sculpting","Styles"],
  ["TOPS","Premium","Performance"],
  ["ULTIMATE","Comfort","Lifestyle"],
];

export default function HomePage() {
  return <main className="reference-home">
    <section className="reference-shell">
      <header className="brand-banner">
        <div className="brand-mark">CQ<span>Λ</span></div>
        <div><b>CREATIVE QUALITY</b><small>AUSTRALIA</small></div>
      </header>

      <section className="collection">
        <div className="collection-title"><h1>WOMEN’S <em>ACTIVEWEAR</em> COLLECTION</h1><small>CQA CLOTHING &amp; SHOES</small></div>
        <div className="machine-stage">
          <aside className="side-rail left-rail">
            <div className="rail-card"><b>CQA</b><small>CLOTHING &amp; SHOES</small><p>HIGH PERFORMANCE<br/>WEAR FOR EVERY<br/>YOU</p></div>
            <div className="shoe-card"><span>◢</span><b>CQA RUNNER</b><small>GIVE IN STYLE.<br/>BE IN CONFIDENCE.</small></div>
            <div className="seal">CQA<small>APPAREL · FOOTWEAR · ACCESSORIES</small></div>
          </aside>

          <div className="vending-machine">
            <div className="machine-left"><b>CQA</b><small>VENDING SYSTEM</small><strong>24</strong><span>ACTIVE<br/>SERVICES</span>{["WORKOUT","NUTRITION","CLOTHING","SHOES","ACCESSORIES"].map(x=><i key={x}>{x}</i>)}</div>
            <div className="machine-main">
              <div className="model-window"><div className="model-glow">CQA</div><div className="model-silhouette"><span>CQA</span></div></div>
              <div className="product-bays">{products.map(([a,b,c])=><div key={a}><strong>{a}</strong><div className="product-shape">CQA</div><b>{b}</b><small>{c}</small></div>)}</div>
              <div className="choose">CHOOSE YOUR STYLE</div>
            </div>
          </div>

          <aside className="side-rail right-rail"><strong>CQA</strong><b>CLOTHING<br/><span>&amp; SHOES</span></b><div className="runner">CQA RUNNER</div></aside>
        </div>
      </section>

      <section className="ecosystem">
        <span>VENDING ECOSYSTEM</span>
        <h2>Turn a business<br/>into a <em>digital</em><br/><strong>vending machine.</strong></h2>
        <p>CQA gives businesses a branded, always-on machine for services, bookings, products and subscriptions — with optional AI workers and a private owner dashboard behind it.</p>
        <Link href="/marketplace" className="marketplace-button">Enter Marketplace <b>›</b></Link>
      </section>
    </section>
    <style>{`
      .reference-home{background:#020304;color:#fff;min-height:100vh;padding-bottom:90px}.reference-shell{max-width:980px;margin:auto;background:#030303;overflow:hidden}.brand-banner{height:190px;display:flex;align-items:center;justify-content:center;gap:22px;background:radial-gradient(circle at 50% 50%,rgba(19,215,232,.14),transparent 34%),linear-gradient(90deg,#06111b,#020304 35%,#020304 65%,#06111b);border-bottom:1px solid rgba(19,215,232,.2);position:relative}.brand-banner:before,.brand-banner:after{content:"";position:absolute;width:18%;height:100%;top:0;background:linear-gradient(135deg,rgba(19,215,232,.15),transparent 55%);border-inline:1px solid rgba(227,196,127,.2)}.brand-banner:before{left:3%}.brand-banner:after{right:3%;transform:scaleX(-1)}.brand-mark{font-size:72px;font-weight:1000;letter-spacing:-.12em;font-style:italic;text-shadow:0 0 20px rgba(255,255,255,.3)}.brand-mark span{color:#20d9ff;text-shadow:0 0 20px #20d9ff}.brand-banner div:last-child{display:flex;flex-direction:column;letter-spacing:.34em}.brand-banner b{font-size:17px}.brand-banner small{color:#e3c47f;text-align:center;margin-top:8px;letter-spacing:.55em}.collection{padding:38px 24px 26px}.collection-title{text-align:center;border-inline:2px solid #20d9ff;margin-bottom:22px}.collection-title h1{font-size:43px;line-height:1;margin:0;font-style:italic;font-weight:950}.collection-title em{color:#20d9ff;font-style:italic}.collection-title small{display:block;margin-top:10px;letter-spacing:.42em;font-size:10px}.machine-stage{display:grid;grid-template-columns:140px 1fr 140px;gap:14px}.side-rail{display:flex;flex-direction:column;gap:14px}.rail-card,.shoe-card,.seal,.right-rail{border:1px solid rgba(19,215,232,.4);border-radius:14px;padding:14px;background:#071018;box-shadow:inset 0 0 20px rgba(19,215,232,.05)}.rail-card b{font-size:28px;color:#20d9ff}.rail-card small{display:block;font-size:7px}.rail-card p{font-size:10px;color:#e3c47f;line-height:1.5;margin-top:25px}.shoe-card{min-height:180px;display:flex;flex-direction:column;justify-content:flex-end}.shoe-card span{font-size:54px;color:#20d9ff;transform:rotate(-20deg);margin:auto}.shoe-card b{font-size:9px}.shoe-card small{font-size:9px;color:#e3c47f;margin-top:18px}.seal{border-radius:50%;aspect-ratio:1;display:grid;place-items:center;text-align:center;color:#e3c47f;font-weight:900}.seal small{font-size:6px}.vending-machine{border:2px solid #20d9ff;border-radius:26px;padding:14px;display:grid;grid-template-columns:90px 1fr;background:linear-gradient(145deg,#08141f,#020406);box-shadow:0 0 18px #20d9ff,0 0 48px rgba(19,215,232,.25),inset 0 0 25px rgba(19,215,232,.12)}.machine-left{border:1px solid rgba(227,196,127,.35);border-radius:12px;padding:9px;display:flex;flex-direction:column;gap:7px;text-align:center}.machine-left>b{color:#e3c47f;font-size:21px}.machine-left small{font-size:6px}.machine-left strong{font-size:27px;color:#20d9ff;margin-top:4px}.machine-left span{font-size:7px}.machine-left i{font-style:normal;font-size:6px;border:1px solid #243747;border-radius:5px;padding:7px 2px}.machine-main{padding-left:12px}.model-window{height:270px;border:2px solid #e3c47f;border-radius:18px;background:radial-gradient(circle at center,#123148,#05080d 65%);position:relative;overflow:hidden;box-shadow:inset 0 0 25px rgba(227,196,127,.14)}.model-glow{position:absolute;right:16px;top:12px;font-size:28px;color:#e3c47f;font-weight:950;text-shadow:0 0 12px #e3c47f}.model-silhouette{position:absolute;width:42%;height:78%;left:29%;bottom:-8%;border-radius:45% 45% 12% 12%;background:linear-gradient(#d9b18c 0 24%,#080b0e 25% 100%);box-shadow:0 0 40px rgba(19,215,232,.2)}.model-silhouette span{position:absolute;top:38%;width:100%;text-align:center;color:#20d9ff;font-weight:900}.product-bays{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:9px}.product-bays>div{border:1px solid rgba(19,215,232,.5);border-radius:8px;text-align:center;overflow:hidden;background:#071018}.product-bays strong{display:block;background:#20d9ff;color:#001015;font-size:7px;padding:4px}.product-shape{height:62px;display:grid;place-items:center;font-size:9px;color:#e3c47f}.product-bays b,.product-bays small{display:block;font-size:6px}.choose{text-align:center;font-size:8px;letter-spacing:.18em;margin-top:7px;color:#e3c47f}.right-rail{align-items:center;justify-content:center;text-align:center}.right-rail>strong{writing-mode:vertical-rl;font-size:52px;letter-spacing:.05em;color:#20d9ff;text-shadow:0 0 12px #20d9ff}.right-rail>b{font-size:15px;margin-top:18px}.right-rail b span{color:#e3c47f}.runner{margin-top:auto;border-top:1px solid #243747;padding-top:14px;font-size:8px}.ecosystem{padding:46px 58px 54px;background:radial-gradient(circle at 90% 40%,rgba(19,215,232,.12),transparent 32%),radial-gradient(circle at 10% 100%,rgba(227,196,127,.09),transparent 35%),#030405;border-top:1px solid rgba(19,215,232,.22)}.ecosystem>span{color:#20d9ff;letter-spacing:.17em;font-weight:850}.ecosystem h2{font-size:67px;line-height:.94;letter-spacing:-.045em;margin:20px 0 28px}.ecosystem h2 em{font-family:Georgia,serif;font-weight:400;color:#e3c47f}.ecosystem h2 strong{color:#20d9ff}.ecosystem p{font-size:21px;line-height:1.45;color:#d6d8dc;max-width:790px}.marketplace-button{margin-top:28px;min-height:76px;border-radius:999px;background:linear-gradient(90deg,#0fbfd3,#1d7fd8,#c7a85e);display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:900;text-decoration:none;box-shadow:0 0 32px rgba(19,215,232,.25)}.marketplace-button b{font-size:42px;margin-left:16px}
      @media(max-width:700px){.reference-shell{width:100%}.brand-banner{height:112px}.brand-mark{font-size:45px}.brand-banner b{font-size:10px}.brand-banner small{font-size:7px}.collection{padding:24px 10px 18px}.collection-title h1{font-size:25px}.machine-stage{grid-template-columns:70px 1fr 70px;gap:6px}.rail-card,.shoe-card,.seal,.right-rail{padding:7px;border-radius:8px}.rail-card b{font-size:15px}.rail-card p{font-size:6px;margin-top:12px}.shoe-card{min-height:115px}.shoe-card span{font-size:30px}.shoe-card small{font-size:5px}.seal{font-size:10px}.vending-machine{grid-template-columns:55px 1fr;padding:7px;border-radius:14px}.machine-left{padding:5px;gap:4px}.machine-left>b{font-size:12px}.machine-left strong{font-size:17px}.machine-left i{font-size:4px;padding:4px 1px}.machine-main{padding-left:6px}.model-window{height:170px;border-radius:10px}.model-glow{font-size:17px;right:8px}.product-bays{gap:3px}.product-shape{height:37px}.right-rail>strong{font-size:28px}.right-rail>b{font-size:8px}.ecosystem{padding:32px 28px 42px}.ecosystem>span{font-size:12px}.ecosystem h2{font-size:45px;margin:14px 0 22px}.ecosystem p{font-size:17px}.marketplace-button{min-height:64px;font-size:20px;margin-top:24px}}
    `}</style>
  </main>
}
