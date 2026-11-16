import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const Link={__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
function evaluate(path,mocks={}){
 const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const m={exports:{}};new Function('require','module','exports',code)(id=>Object.hasOwn(mocks,id)?mocks[id]:require(id),m,m.exports);return m.exports;
}
const catalog=evaluate('lib/catalog.ts');
for(const configured of [false,true]){
 const page=evaluate('app/digital-products/page.tsx',{'next/link':Link,'@/lib/catalog':{...catalog,getProductReadiness:()=>({sellable:configured})},'./digital-products.css':{}});
 const html=renderToStaticMarkup(React.createElement(page.default));
 const products=catalog.machines.flatMap(m=>m.products);
 for(const product of products){assert.ok(html.includes(renderToStaticMarkup(React.createElement('h3',null,product.title))));assert.ok(html.includes('product='+encodeURIComponent(product.id)));}
 assert.doesNotMatch(html,/buy\.stripe\.com|\/machine\/store|Delivery verified|Ready for purchase/);
 assert.match(html,/This page accepts enquiries only/);
 assert.equal((html.match(/Enquire about this kit/g)||[]).length,products.length);
}
console.log('PASS digital kit preview remains enquiry-only with missing or complete configuration; no asset-delivery or payment claim');
const success=evaluate('app/automations/success/page.tsx',{'next/link':Link});
const html=renderToStaticMarkup(React.createElement(success.default));
assert.match(html,/does not verify a payment or activate a service/);assert.match(html,/contact\?service=automation-implementation/);
assert.doesNotMatch(html,/checkout is complete|Stripe has received/);
console.log('PASS checkout-return page cannot independently imply verified payment');
