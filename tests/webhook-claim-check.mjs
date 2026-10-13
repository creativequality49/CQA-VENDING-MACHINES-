import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const source=fs.readFileSync('lib/cqa-webhook-events.ts','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
for(const test of [{name:'new event claims processing',fresh:true},{name:'processed duplicate skips effects',status:'processed',duplicate:true},{name:'active processing lease requests retry',status:'processing',reject:true},{name:'failed event can retry',status:'failed',reclaim:true},{name:'crashed expired lease can retry',status:'processing',expired:true,reclaim:true},{name:'lost compare-and-swap cannot duplicate processing',status:'failed',lost:true,reject:true},{name:'database claim failure remains retryable',dbError:true,reject:true}]){
 let row={status:test.status,processed_at:new Date(Date.now()-(test.expired?700000:1000)).toISOString()},filters=[],updates=0;
 const admin={from(table){assert.equal(table,'cqa_stripe_webhook_events');const q={insert:async()=>({error:test.fresh?null:{code:test.dbError?'XX000':'23505'}}),select(){return q},eq(key,value){filters.push([key,value]);return q},is(){return q},single:async()=>({data:row,error:null}),update(){updates++;return q},maybeSingle:async()=>({data:test.lost?null:{event_id:'evt_fixture'},error:null})};return q}};
 const claim=new Function('getCqaSupabaseAdmin',compiled+';return claimCqaWebhookEvent')(()=>admin);
 if(test.reject)await assert.rejects(claim({id:'evt_fixture',type:'checkout.session.completed'}));else{const result=await claim({id:'evt_fixture',type:'checkout.session.completed'});assert.equal(result.duplicate,!!test.duplicate);if(!result.duplicate)assert.ok(result.claimedAt)}
 assert.equal(updates,test.reclaim||test.lost?1:0);if(updates){assert.ok(filters.some(([k,v])=>k==='status'&&v===row.status));assert.ok(filters.some(([k,v])=>k==='processed_at'&&v===row.processed_at))}
 console.log('PASS '+test.name);
}
{
 let payload,filters=[];const admin={from(){const q={update:p=>{payload=p;return q},eq:(k,v)=>{filters.push([k,v]);return q},then:r=>r({error:null})};return q}};
 const finish=new Function('getCqaSupabaseAdmin',compiled+';return finishCqaWebhookEvent')(()=>admin);await finish('evt_fixture','lease','failure');assert.equal(payload.status,'failed');assert.deepEqual(filters,[['event_id','evt_fixture'],['status','processing'],['processed_at','lease']]);console.log('PASS finishing failure is scoped to current processing lease');
}
