import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';import Stripe from 'stripe';
const compiled=ts.transpileModule(fs.readFileSync('app/api/stripe/webhook/route.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const stripe=new Stripe('sk_test_fixture_only');const secret='whsec_fixture_only';const oldSecret=process.env.STRIPE_WEBHOOK_SECRET;process.env.STRIPE_WEBHOOK_SECRET=secret;
try{for(const t of [
 {name:'invalid signed event denied before database',invalid:true,status:400},
 {name:'tampered raw payload denied before database',tampered:true,status:400},
 {name:'paid checkout grants verified metadata owner',grants:1},
 {name:'unpaid checkout does not grant',unpaid:true},
 {name:'duplicate does not grant again',duplicate:true},
 {name:'late checkout cannot restore fully refunded purchase',refunded:true,grants:1,grantStatus:'cancelled'},
 {name:'late checkout cannot restore cancelled subscription',subscription:true,cancelled:true,grants:1,grantStatus:'cancelled'},
 {name:'subscription created uses current cancelled state',type:'customer.subscription.created',cancelled:true,updates:1},
 {name:'subscription deletion revokes only subscription identity',type:'customer.subscription.deleted',cancelled:true,updates:1},
 {name:'full refund revokes matching checkout only',type:'charge.refunded',refunded:true,revokes:1},
 {name:'partial refund preserves product access',type:'charge.refunded'},
 {name:'CQA handled event does not grant catalog entitlement',billing:true}
 ]){
  const grants=[],updates=[],revokes=[];let reads=0,marked=0;
  const object=t.type?.startsWith('customer.subscription')?{id:'sub_fixture',status:'canceled',metadata:{userId:'buyer'}}:t.type==='charge.refunded'?{id:'ch_fixture',refunded:!!t.refunded,payment_intent:'pi_fixture'}:{id:'cs_fixture',payment_status:t.unpaid?'unpaid':'paid',customer:'cus_fixture',subscription:t.subscription?'sub_fixture':null,payment_intent:'pi_fixture',metadata:{userId:'buyer',productId:'product',tier:t.subscription?'subscription':'pro',machineSlug:'store'}};
  const event={id:'evt_fixture',type:t.type||'checkout.session.completed',data:{object}};
  const client={webhooks:stripe.webhooks,subscriptions:{retrieve:async()=>({id:'sub_fixture',status:t.cancelled?'canceled':'active',metadata:{userId:'buyer'}})},paymentIntents:{retrieve:async()=>({latest_charge:{refunded:!!t.refunded}})},checkout:{sessions:{list:async input=>{assert.equal(input.payment_intent,'pi_fixture');return{data:[{id:'cs_fixture',mode:'payment',metadata:{userId:'buyer',productId:'product'}},{id:'cs_other',mode:'subscription',metadata:{userId:'buyer',productId:'product'}},{id:'cs_unrelated',mode:'payment',metadata:{}}]}}}}};
  const deps={'next/server':{NextResponse:{json:(body,o)=>({body,status:o?.status||200})}},'stripe':Stripe,'@/lib/stripe':{getStripeClient:()=>client},'@/lib/entitlements':{hasProcessedStripeEvent:async()=>{reads++;return !!t.duplicate},markStripeEventProcessed:async()=>{marked++},upsertCheckoutEntitlement:async v=>grants.push(v),updateSubscriptionEntitlement:async v=>updates.push(v),revokeCheckoutEntitlement:async v=>revokes.push(v)},'@/lib/cqa-billing':{handleCqaBillingStripeEvent:async()=>!!t.billing},'@/lib/fanx-commerce':{handleFanXStripeEvent:async()=>false},'@/lib/cqa-webhook-events':{claimCqaWebhookEvent:async()=>({duplicate:false,claimedAt:'lease'}),finishCqaWebhookEvent:async()=>{}}};
  const exports={};new Function('require','exports',compiled)(name=>{assert.ok(deps[name],name);return deps[name]},exports);
  const payload=JSON.stringify(event),signature=t.invalid?'t=1,v1=invalid':stripe.webhooks.generateTestHeaderString({payload,secret});
  const result=await exports.POST(new Request('https://example.test/webhook',{method:'POST',headers:{'stripe-signature':signature},body:t.tampered?payload+' ':payload}));
  assert.equal(result.status,t.status||200,t.name);assert.equal(grants.length,t.grants||0,t.name);assert.equal(updates.length,t.updates||0,t.name);assert.equal(revokes.length,t.revokes||0,t.name);
  if(t.status===400)assert.equal(reads,0);if(t.duplicate)assert.equal(marked,0);if(grants.length){assert.equal(grants[0].userId,'buyer');assert.equal(grants[0].status,t.grantStatus||'active')}if(updates.length){assert.equal(updates[0].userId,'buyer');assert.equal(updates[0].stripeSubscriptionId,'sub_fixture');assert.equal(updates[0].status,'cancelled')}if(revokes.length)assert.deepEqual(revokes,['cs_fixture']);console.log('PASS '+t.name);
}}finally{if(oldSecret===undefined)delete process.env.STRIPE_WEBHOOK_SECRET;else process.env.STRIPE_WEBHOOK_SECRET=oldSecret}
