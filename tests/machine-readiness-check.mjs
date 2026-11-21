import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
function evaluate(file, mocks={}) { const module={exports:{}}; const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(name=>{if(Object.hasOwn(mocks,name))return mocks[name];throw Error('Unexpected dependency '+name)},module,module.exports);return module.exports; }
const assets=evaluate('lib/cqa-marketplace-assets.ts');
const readiness=evaluate('lib/cqa-machine-readiness.ts',{'@/lib/cqa-offer-readiness':evaluate('lib/cqa-offer-readiness.ts'),'@/lib/cqa-marketplace-assets':assets}).evaluateCqaMachineReadiness;
const env={RESEND_API_KEY:'configured',CQA_EMAIL_FROM:'sales@example.com',R2_ACCOUNT_ID:'configured',R2_ACCESS_KEY_ID:'configured',R2_SECRET_ACCESS_KEY:'configured',R2_BUCKET:'private'};
const offer={id:'offer',machine_id:'machine',active:true,name:'Digital',price_cents:2900,offer_type:'digital_product',fulfillment_type:'digital',fulfillment_config:{asset_key:'marketplace/business/offer/file.pdf',asset_size_bytes:100,asset_content_type:'application/pdf'}};
let heads=0;
const base={businessId:'business',machineId:'machine',title:'Store',offers:[offer],siteUrl:'https://example.com',environment:env,verifyAsset:async()=>{heads++;return true}};
assert.equal((await readiness(base)).merchantReady,true);assert.equal(heads,1);
assert.equal((await readiness({...base,verifyAsset:async()=>false})).checks[0].code,'PRIVATE_PRODUCT_FILE_MISMATCH');
assert.equal((await readiness({...base,verifyAsset:async()=>{throw Error('provider unavailable')}})).checks[0].code,'PRIVATE_STORAGE_UNVERIFIED');
heads=0;assert.equal((await readiness({...base,offers:[{...offer,fulfillment_config:{...offer.fulfillment_config,asset_key:'marketplace/other/offer/file.pdf'}}]})).checks[0].code,'PRIVATE_PRODUCT_FILE_REQUIRED');assert.equal(heads,0);
assert.equal((await readiness({...base,environment:{...env,R2_BUCKET:''}})).checks[0].code,'PRIVATE_STORAGE_CONFIGURATION_REQUIRED');
assert.equal((await readiness({...base,environment:{...env,R2_PUBLIC_URL:'https://public.example'}})).merchantReady,false);
assert.equal((await readiness({...base,siteUrl:'http://localhost:3000'})).checks[0].code,'SECURE_SITE_URL_REQUIRED');
assert.equal((await readiness({...base,environment:{...env,RESEND_API_KEY:''}})).checks[0].code,'RECEIPT_EMAIL_CONFIGURATION_REQUIRED');
const terms={deliveryDescription:'One consultation',deliveryTiming:'Within 5 business days',supportDetails:'support@example.com',refundTerms:'Contact us for remedies under Australian Consumer Law'};
assert.equal((await readiness({...base,environment:{RESEND_API_KEY:'configured',CQA_EMAIL_FROM:'sales@example.com'},offers:[{...offer,offer_type:'service',fulfillment_type:'service',fulfillment_config:terms}]})).merchantReady,true);
assert.equal((await readiness({...base,offers:[{...offer,offer_type:'service',fulfillment_type:'service',fulfillment_config:{}}]})).merchantReady,false);
assert.equal((await readiness({...base,offers:[{...offer,machine_id:'other'}]})).checks[0].code,'ACTIVE_OFFER_REQUIRED');
assert.equal((await readiness({...base,offers:[{...offer,offer_type:'subscription'}]})).merchantReady,false);
assert.equal((await readiness({...base,offers:[{...offer,price_cents:29.5}]})).checks[0].code,'VALID_PRICE_REQUIRED');
const physical={...offer,offer_type:'physical_product',fulfillment_type:'shipping',inventory_tracking:false,inventory_quantity:0};
assert.ok((await readiness({...base,offers:[physical]})).checks.some(c=>c.code==='PHYSICAL_STOCK_REQUIRED'));
console.log('PASS machine readiness: valid digital HEAD, storage mismatch/outage, tenant isolation, private config, HTTPS, receipts, service contract, storefront isolation and stock holds');

const endpoint=evaluate('app/api/owner/readiness/route.ts',{
 'next/server':{NextResponse:{json:(body,init)=>({body,...init})}},'zod':require('zod'),
 '@/lib/cqa-owner-auth':{requireCqaOwner:async()=>{throw Object.assign(Error('Authentication required.'),{status:401})}},
 '@/lib/cqa-machine-readiness':{evaluateCqaMachineReadiness:readiness},'@/lib/cqa-billing':{},'@/lib/stripe':{},'@/lib/cqa-site-url':{},'@/lib/cqa-launch-gate':{},'@/lib/storage':{}
});
const denied=await endpoint.GET(new Request('https://example.com/api/owner/readiness'));
assert.equal(denied.status,401);assert.equal(denied.headers['Cache-Control'],'private, no-store');
const malformed=await endpoint.GET(new Request('https://example.com/api/owner/readiness?businessId=invalid'));
assert.equal(malformed.status,400);
console.log('PASS readiness endpoint denies unauthenticated access and invalid business IDs without caching');
