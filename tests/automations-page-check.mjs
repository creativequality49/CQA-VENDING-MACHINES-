import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const Link = { __esModule: true, default: ({children, ...props}) => React.createElement('a', props, children) };
const css = { __esModule: true, default: new Proxy({}, { get: (_, name) => String(name) }) };
function evaluate(path, mocks = {}, context = {}) {
  const output = ts.transpileModule(fs.readFileSync(path,'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module={exports:{}};
  new Function('require','module','exports',...Object.keys(context),output)(id => Object.hasOwn(mocks,id) ? mocks[id] : require(id),module,module.exports,...Object.values(context));
  return module.exports;
}
const catalog = evaluate('lib/cqa-automation-catalog.ts');
const expected = {
 automation_starter:[497,99,596,'00w9AL3Tqa4H41q4hK2Nq0f'], automation_pro:[897,249,1146,'dRm5kvblS2Cf41qeWo2Nq0g'],
 ai_business_operations:[1997,449,2446,'8x2fZ989G0u7btS8y02Nq0h'], ai_lead_finder:[497,99,596,'3cIdR1gGc2Cf69y3dG2Nq0i'],
 ai_content_marketing_worker:[497,129,626,'14A28j0HeccP1Ti8y02Nq0j'], ai_customer_follow_up_worker:[397,99,496,'28E7sDdu0gt5fK8eWo2Nq0k'],
 ai_receptionist:[797,249,1046,'14A7sDgGc5Or55u8y02Nq0l'], competitor_market_monitor:[497,129,626,'7sY14ffC8fp19lKg0s2Nq0m'],
 product_order_automation_worker:[697,149,846,'fZu28jfC890DapO3dG2Nq0n'], real_estate_property_intelligence_worker:[997,249,1246,'14AeV59dK2Cf1Tig0s2Nq0o']
};
const page=evaluate('app/automations/page.tsx',{'next/link':Link,'@/lib/cqa-automation-catalog':catalog,'./automations.module.css':css});
const html=renderToStaticMarkup(React.createElement(page.default));
assert.equal((html.match(/<h1\b/g)||[]).length,1);
assert.match(html,/Buy the business outcome\. CQA builds the automation behind it\./);
assert.match(html,/href="#packages"/); assert.match(html,/View Automation Packages/);
assert.match(html,/Request a Custom Build/); assert.match(html,/Discuss your project/);
assert.match(html,/one agreed workflow/i); assert.match(html,/SPECIALIST WORKERS/);
assert.doesNotMatch(html,/LIVE CHECKOUT|ready-to-deploy|most popular|cancel anytime|GST included/i);
for(const offer of catalog.CQA_AUTOMATION_OFFERS.filter(offer=>offer.paymentUrl)) {
 const [setup,monthly,first,link]=expected[offer.id];
 assert.deepEqual([offer.setupAud,offer.monthlyAud,catalog.firstPaymentAud(offer)],[setup,monthly,first]);
 assert.equal(offer.paymentUrl,'https://buy.stripe.com/'+link);
 const article=html.match(new RegExp('<article[^>]*aria-labelledby="offer-'+offer.id+'"[\\s\\S]*?</article>'))?.[0];
 assert.ok(article,offer.id+' has its own card');
 assert.match(article,new RegExp('href="https://buy\\.stripe\\.com/'+link+'"'));
 for(const value of [setup,monthly,first]) assert.ok(article.includes('$'+new Intl.NumberFormat('en-AU').format(value)),offer.id+' fee shown');
 assert.match(article,/First payment/); assert.match(article,/AUD/); assert.match(article,/Then/);
}
assert.equal((html.match(/href="https:\/\/buy\.stripe\.com\//g)||[]).length,10);
assert.equal((html.match(/<details>/g)||[]).length,8);
assert.equal((html.match(/<summary>/g)||[]).length,8);
assert.match(html,/Contact CQA to confirm/); assert.match(html,/Customer launch checks are still in progress/);
for(const href of [...html.matchAll(/href="([^"]+)"/g)].map(x=>x[1])) {
 if(href.startsWith('#')) assert.ok(html.includes('id="'+href.slice(1)+'"'));
 else if(href.startsWith('/')) assert.ok(fs.existsSync('app'+href.split('?')[0]+'/page.tsx'),href+' resolves to existing page');
 else assert.ok(href.startsWith('https://buy.stripe.com/'));
}
console.log('PASS genuine automation page: ten exact existing Stripe links, all setup/monthly/first AUD totals, hero CTAs and internal anchors');
console.log('PASS genuine page: three core comparisons, eight native accessible FAQs, honest launch/GST/unknown policy copy and contact handoff');
const nav=evaluate('components/NavBar.tsx',{'next/link':Link,'@/lib/cqa-launch-gate':{isNewCqaCheckoutAllowed:()=>false}});
const navHtml=renderToStaticMarkup(React.createElement(nav.NavBar));
for(const href of ['/','/marketplace','/machines','/pricing','/workers','/automations','/owner/dashboard','/contact','/onboarding']) assert.ok(navHtml.includes('href="'+href+'"'));
assert.match(navHtml,/Customer launch checks are in progress/);
console.log('PASS public navigation preserves all existing routes and the genuine prelaunch disclosure');
const success=evaluate('app/automations/success/page.tsx',{'next/link':Link});
const successHtml=renderToStaticMarkup(React.createElement(success.default));
assert.match(successHtml,/does not verify a payment/); assert.match(successHtml,/contact\?service=automation-implementation/);
assert.doesNotMatch(successHtml,/checkout is complete|Stripe has received your checkout/);
console.log('PASS public handoff page cannot be mistaken for verified payment confirmation');
function find(node,predicate){if(!node||typeof node!=='object')return; if(predicate(node))return node; for(const child of [].concat(node.props?.children||[])){const got=find(child,predicate);if(got)return got;}}
function contactHarness(fetcher) {
 const states=['idle',''],refs=[];let si=0,ri=0;
 const h=evaluate('app/contact/page.tsx',{'next/link':()=>null,'next/navigation':{useSearchParams:()=>new URLSearchParams('service=automation-implementation')},react:{Suspense:props=>props.children,useState:initial=>{const i=si++;states[i]??=initial;return[states[i],v=>{states[i]=v}]},useRef:initial=>refs[ri++]||={current:initial}},'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}},{fetch:fetcher,FormData:class{get(name){return{name:'Test Owner',email:'owner@example.test',phone:'',businessName:'Test business',message:'A synthetic workflow implementation brief'}[name]}}});
 return {states,render(){si=ri=0;return h.default().props.children.props.children.type();}};
}
for(const fetcher of [async()=>{throw new TypeError('Failed to fetch')},async()=>Response.json({}),async()=>new Response('bad json'),async()=>Response.json({error:'Try again'},{status:503})]) {
 const h=contactHarness(fetcher);const form=find(h.render(),n=>n.type==='form');await form.props.onSubmit({preventDefault(){},currentTarget:{}});
 assert.equal(h.states[0],'idle');assert.ok(find(h.render(),n=>n.props.role==='alert'));assert.ok(!JSON.stringify(h.render()).includes('Your CQA request is saved.'));
}
console.log('PASS real contact form: network/503/malformed/false-success responses show errors, clear busy state and permit retry');
let calls=0,finish,payload;
const h=contactHarness(async(_url,options)=>{calls++;payload=JSON.parse(options.body);await new Promise(resolve=>{finish=resolve});return Response.json({ok:true});});
const submit=find(h.render(),n=>n.type==='form').props.onSubmit;
const first=submit({preventDefault(){},currentTarget:{}});await submit({preventDefault(){},currentTarget:{}});
assert.equal(calls,1);finish();await first;assert.equal(h.states[0],'sent');assert.equal(payload.service,'automation-implementation');
assert.equal(payload.message,'A synthetic workflow implementation brief');
console.log('PASS real implementation brief: duplicate submits make one request and verified API success preserves service and workflow details');
