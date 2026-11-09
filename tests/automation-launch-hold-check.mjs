import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require=createRequire(import.meta.url);
function load(path,mocks={},globals={}) {
 const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const module={exports:{}};
 new Function('require','module','exports',...Object.keys(globals),code)(id=>Object.hasOwn(mocks,id)?mocks[id]:require(id),module,module.exports,...Object.values(globals));
 return module.exports;
}
const catalog=load('lib/cqa-automation-catalog.ts');
function page(env) {
 const gates=load('lib/cqa-launch-gate.ts',{}, {process:{env}});
 const component=load('app/automations/page.tsx',{
  'next/link':{__esModule:true,default:props=>React.createElement('a',props,props.children)},
  '@/lib/cqa-automation-catalog':catalog,'@/lib/cqa-launch-gate':gates
 });
 return {html:renderToStaticMarkup(React.createElement(component.default)),gates};
}
for(const env of [
 {},{STRIPE_SECRET_KEY:'sk_live_fixture'},
 {STRIPE_SECRET_KEY:'rk_live_fixture',CQA_CUSTOMER_LAUNCH_APPROVED:'false'},
 {STRIPE_SECRET_KEY:'sk_test_fixture'},
 {STRIPE_SECRET_KEY:'rk_test_fixture',CQA_CUSTOMER_LAUNCH_APPROVED:'true'},
 {STRIPE_SECRET_KEY:'rkcs_test_fixture',CQA_CUSTOMER_LAUNCH_APPROVED:'true'},
 {STRIPE_SECRET_KEY:'unknown',CQA_CUSTOMER_LAUNCH_APPROVED:'true'},
 {STRIPE_SECRET_KEY:'sk_live_fixture',CQA_CUSTOMER_LAUNCH_APPROVED:'TRUE'}
]) {
 const {html,gates}=page(env);
 assert.equal(gates.isCqaLiveCatalogCheckoutAllowed(),false);
 assert.doesNotMatch(html,/buy\.stripe\.com|checkout\.stripe\.com|LIVE CHECKOUT|Buy securely with Stripe/);
 assert.match(html,/Customer launch is not yet approved/);
 assert.match(html,/PRELAUNCH · PAYMENTS PAUSED/);
 assert.match(html,/href="\/founding-customers"/);
 assert.match(html,/without paying or committing to a subscription/);
 for(const offer of catalog.CQA_AUTOMATION_OFFERS.filter(offer=>offer.paymentUrl))assert.equal(html.includes(offer.paymentUrl),false);
}
console.log('PASS closed live/missing/unknown and sandbox configurations render no external payment URLs across eight cases');
for(const prefix of ['sk_live_','rk_live_','rkcs_live_']) {
 const {html,gates}=page({STRIPE_SECRET_KEY:prefix+'fixture',CQA_CUSTOMER_LAUNCH_APPROVED:'true'});
 assert.equal(gates.isCqaLiveCatalogCheckoutAllowed(),true);
 assert.match(html,/LIVE CHECKOUT/);
 const offers=catalog.CQA_AUTOMATION_OFFERS.filter(offer=>offer.paymentUrl);
 for(const offer of offers)assert.equal(html.includes(offer.paymentUrl),true);
 assert.equal((html.match(/Buy securely with Stripe/g)||[]).length,offers.length);
}
console.log('PASS explicit live approval preserves original catalogue checkout links across three credential types');
assert.doesNotMatch(load('app/automations/page.tsx',{
 'next/link':{__esModule:true,default:()=>null},'@/lib/cqa-automation-catalog':catalog,
 '@/lib/cqa-launch-gate':{isCqaLiveCatalogCheckoutAllowed:()=>false}
}).metadata.description,/live Stripe checkout/i);
console.log('PASS page metadata makes no unverified live checkout claim');
