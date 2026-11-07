import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const js=ts.transpileModule(fs.readFileSync('lib/cqa-marketplace-checkout-binding.ts','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const originalMetadata={cqaBusinessId:'business',cqaMachineId:'machine',cqaOfferId:'offer',cqaBuyerUserId:'buyer',cqaDigitalDelivery:'1'};
{
 let reads=0;
 const admin={from(table){reads++;assert.equal(table,'cqa_orders','unrelated event must not query offers with undefined UUIDs');const q={select(){return q},eq(k,v){assert.equal(k,'stripe_checkout_session_id');assert.equal(v,'unrelated');return q},maybeSingle:async()=>({data:null,error:null})};return q}};
 const helper=new Function('getCqaSupabaseAdmin','getStripeClient',js+';return verifyMarketplaceDigitalCheckout;')(()=>admin,()=>{throw Error('Unrelated event must not call Stripe')});
 assert.equal(await helper({account:'seller'},{id:'unrelated',payment_status:'paid',metadata:{}}),null);
 assert.equal(reads,1);
 console.log('PASS unrelated paid Connect checkout is ignored before any offer or provider query');
}
for(const t of [
 {name:'durable pending purchase binds PI before charge inspection'},
 {name:'editable payer email cannot replace durable buyer',payerEmail:'other@example.test'},
 {name:'missing durable purchase cannot grant',missingOrder:true,reject:true},
 {name:'unbound legacy purchase cannot grant digital access',missingBuyer:true,reject:true},
 {name:'wrong event account cannot grant',wrongAccount:true,reject:true},
 {name:'retrieved checkout wrong buyer cannot grant',wrongBuyer:true,reject:true},
 {name:'retrieved checkout wrong business cannot grant',wrongBusiness:true,reject:true},
 {name:'retrieved checkout wrong offer cannot grant',wrongOffer:true,reject:true},
 {name:'retrieved checkout wrong machine cannot grant',wrongMachine:true,reject:true},
 {name:'retrieved checkout wrong amount cannot grant',wrongAmount:true,reject:true},
 {name:'retrieved checkout wrong currency cannot grant',wrongCurrency:true,reject:true},
 {name:'signed event and current offer must match',eventOffer:'other',reject:true},
 {name:'signed event and current buyer must match',eventBuyer:'other',reject:true},
 {name:'signed event and current machine must match',eventMachine:'other',reject:true},
 {name:'signed event and current amount must match',eventAmount:1,reject:true},
 {name:'signed event and current PI must match',eventPi:'other',reject:true},
 {name:'unconfirmed account cannot receive digital access',unconfirmed:true,reject:true},
 {name:'anonymous account cannot receive digital access',anonymous:true,reject:true},
 {name:'unsettled PI cannot bind',piStatus:'processing',reject:true},
 {name:'PI amount cannot differ from purchase',piAmount:1,reject:true},
 {name:'PI currency cannot differ from purchase',piCurrency:'usd',reject:true},
 {name:'existing bound PI cannot be replaced',boundPi:'other',reject:true},
 {name:'binding persistence failure stays retryable',bindError:true,reject:true},
 {name:'full refund is terminal without provider or buyer mutation',status:'refunded',terminal:true},
 {name:'cancelled purchase is terminal without provider or buyer mutation',status:'cancelled',terminal:true},
 {name:'legacy nondigital completion remains separate',legacy:true},
 {name:'unpaid completion does not inspect or mutate ledger',unpaid:true}
]){
 const order={id:'order',business_id:'business',machine_id:'machine',offer_id:'offer',buyer_user_id:t.missingBuyer?null:'buyer',amount_cents:2900,currency:'aud',stripe_checkout_session_id:'checkout',stripe_payment_intent_id:t.boundPi||null,status:t.status||'pending'};
 let providerCalls=0,bindAttempts=0,mutations=0,reads=0;
 const admin={auth:{admin:{getUserById:async id=>{assert.equal(id,'buyer');return{data:{user:{id,email:'buyer@example.test',email_confirmed_at:t.unconfirmed?null:'confirmed',is_anonymous:t.anonymous||false}},error:null}}}},from(table){reads++;let patch;const filters=[];const q={select(){return q},eq(k,v){filters.push([k,v]);return q},update(v){patch=v;return q},single:async()=>({data:{stripe_account_id:'seller'},error:null}),maybeSingle:async()=>({data:table==='cqa_orders'?(t.missingOrder?null:order):{offer_type:t.legacy?'service':'digital_product',fulfillment_type:t.legacy?'service':'digital'},error:null}),then(resolve){assert.equal(table,'cqa_orders');bindAttempts++;assert.deepEqual(patch,{stripe_payment_intent_id:'pi'});assert.deepEqual(filters,[['id','order'],['business_id','business'],['status','pending']]);if(!t.bindError&&order.status==='pending'){Object.assign(order,patch);mutations++}resolve({error:t.bindError?Error('db unavailable'):null})}};return q}};
 const session={id:'checkout',mode:'payment',payment_status:'paid',amount_total:t.wrongAmount?1:2900,currency:t.wrongCurrency?'usd':'aud',client_reference_id:t.wrongBuyer?'other':'buyer',customer_email:t.payerEmail||'buyer@example.test',metadata:{...originalMetadata,cqaBuyerUserId:t.wrongBuyer?'other':'buyer',cqaBusinessId:t.wrongBusiness?'other':'business',cqaOfferId:t.wrongOffer?'other':'offer',cqaMachineId:t.wrongMachine?'other':'machine'},payment_intent:{id:'pi',status:t.piStatus||'succeeded',amount:t.piAmount??2900,currency:t.piCurrency||'aud'}};
 const stripe={checkout:{sessions:{retrieve:async(id,_expand,opts)=>{providerCalls++;assert.equal(id,'checkout');assert.equal(opts.stripeAccount,'seller');return session}}}};
 const helper=new Function('getCqaSupabaseAdmin','getStripeClient',js+';return verifyMarketplaceDigitalCheckout;')(()=>admin,()=>stripe);
 const supplied={id:'checkout',mode:'payment',payment_status:t.unpaid?'unpaid':'paid',amount_total:t.eventAmount??2900,currency:'aud',payment_intent:t.eventPi||'pi',metadata:{...originalMetadata,cqaOfferId:t.eventOffer||'offer',cqaBuyerUserId:t.eventBuyer||'buyer',cqaMachineId:t.eventMachine||'machine',...(t.legacy?{cqaDigitalDelivery:undefined}:{})}};
 const call=()=>helper({account:t.wrongAccount?'other':'seller'},supplied);
 if(t.reject)await assert.rejects(call);else{const result=await call();if(t.unpaid||t.legacy)assert.equal(result,null);else if(t.terminal){assert.equal(result.terminal,true);assert.equal(result.buyerUserId,null)}else{assert.equal(result.terminal,false);assert.equal(result.buyerUserId,'buyer');assert.equal(order.stripe_payment_intent_id,'pi')}}
 assert.equal(mutations,!t.reject&&!t.unpaid&&!t.legacy&&!t.terminal?1:0,t.name);
 if(t.terminal||t.legacy||t.unpaid){assert.equal(providerCalls,0);assert.equal(bindAttempts,0)}
 if(t.unpaid)assert.equal(reads,0);
 console.log('PASS '+t.name);
}
