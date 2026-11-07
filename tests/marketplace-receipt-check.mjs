import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const js=ts.transpileModule(fs.readFileSync('lib/cqa-transactional-email.ts','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const base={businessId:'business',orderId:'order',checkoutId:'checkout',customerEmail:'editable-payer@example.test',offerId:'offer',amountCents:2900,currency:'aud'};
function harness(failOnce=false){
 const sent=[];let fail=failOnce;
 const admin={from(table){const q={select(){return q},eq(){return q},single:async()=>({data:{name:'Test business',email:'owner@example.test'},error:null}),maybeSingle:async()=>({data:{name:'Private guide'},error:null})};return q}};
 const notify=new Function('getCqaSupabaseAdmin','getCqaSiteUrl','fetch','process',js+';return notifyCqaOrder;')(()=>admin,()=> 'https://www.creativequalityaustralia.tech',async(url,request)=>{assert.equal(url,'https://api.resend.com/emails');sent.push({body:JSON.parse(request.body),key:request.headers['Idempotency-Key']});if(fail){fail=false;return{ok:false,status:503}}return{ok:true}},{env:{RESEND_API_KEY:'test-only',CQA_EMAIL_FROM:'test@example.test'}});
 return {notify,sent};
}
{
 const h=harness();await h.notify({...base,digital:true,buyerEmail:'verified-buyer@example.test'});
 assert.deepEqual(h.sent[0].body.to,['verified-buyer@example.test']);
 assert.equal(h.sent.some(email=>email.body.to.includes(base.customerEmail)),false);
 assert.match(h.sent[0].body.text,/https:\/\/www\.creativequalityaustralia\.tech\/marketplace\/library/);
 assert.match(h.sent[0].body.text,/Sign in with the verified account/);
 assert.doesNotMatch(h.sent[0].body.text,/cloudflarestorage|asset_key|X-Amz|signed-download|marketplace\/business\/offer/);
 assert.match(h.sent[1].body.text,/Customer: editable-payer@example.test/);
 assert.deepEqual(h.sent.map(email=>email.key),['order/checkout/customer','order/checkout/owner']);
 console.log('PASS digital receipt uses verified buyer, protected canonical library and existing idempotency keys');
}
{
 const h=harness();await h.notify(base);
 assert.deepEqual(h.sent[0].body.to,[base.customerEmail]);assert.match(h.sent[0].body.text,/fulfilment or booking enquiries/);assert.doesNotMatch(h.sent[0].body.text,/marketplace\/library/);
 console.log('PASS legacy service receipt recipient and fulfillment guidance stay unchanged');
}
{
 const h=harness();await assert.rejects(()=>h.notify({...base,digital:true}),/Verified digital buyer email/);assert.equal(h.sent.length,0);
 console.log('PASS missing verified buyer never falls back to editable payer email');
}
{
 const h=harness(true);const request={...base,digital:true,buyerEmail:'verified-buyer@example.test'};
 await assert.rejects(()=>h.notify(request),/Transactional email delivery failed/);await h.notify(request);
 assert.equal(h.sent[0].key,h.sent[1].key);assert.deepEqual(h.sent[0].body,h.sent[1].body);
 console.log('PASS provider failure stays retryable with identical recipient and idempotency key');
}
