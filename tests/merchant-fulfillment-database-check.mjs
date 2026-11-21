import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db=new PGlite();
const id=n=>`70000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const owner=id(1), buyer=id(2), other=id(3), business=id(10), foreign=id(11), machine=id(20);
const terms={deliveryDescription:'A real test product',deliveryTiming:'Five days',supportDetails:'support@example.test',refundTerms:'Returns within14days'};
const shipping={supportedRegions:['AU','NZ'],flatFeeCents:750,dispatchTiming:'Two business days'};
const product={name:'Fixture Hair Care',description:'A physical product',offer_type:'physical_product',fulfillment_type:'shipping',shipping_required:true,inventory_tracking:true,price_cents:2900,currency:'aud',active:true,image_url:null,fulfillment_config:{provider:'merchant',...terms,shipping}};
async function role(name,sub=''){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[sub]);if(name!=='postgres')await db.exec(`set role ${name}`);}
async function rpc(name,args){const slots=args.map((_,i)=>'$'+(i+1)).join(',');return (await db.query(`select public.${name}(${slots}) as value`,args)).rows[0].value;}
async function denied(run,code){await assert.rejects(run,error=>error.code===code,`Expected PostgreSQL ${code}`);}
async function save(offerId=null,revision=null,delta=0,p=product,actor=owner){return rpc('cqa_owner_save_product',[business,machine,actor,offerId,revision,delta,JSON.stringify(p)]);}
async function reserve(offer,b=buyer,key=id(100),quantity=1){return (await rpc('cqa_reserve_inventory',[offer,b,key,quantity])).reservation;}
async function order(offer,number,session,amount=3650,type='physical_product',state='pending',customer=buyer){
const snapshot={title:'Purchased product',offerType:type,fulfillmentType:type==='physical_product'?'shipping':'digital',terms};
await db.query('insert into public.cqa_orders(id,business_id,machine_id,offer_id,customer_user_id,buyer_user_id,status,amount_cents,currency,stripe_checkout_session_id,purchase_snapshot) values($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10)',[id(number),business,machine,offer,customer,state,amount,'aud',session,JSON.stringify(snapshot)]);return id(number);}
const address={name:'Test Customer',line1:'1 Fixture Street',line2:'',city:'Adelaide',state:'SA',postal_code:'5000',country:'AU'};
try{
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth to anon,authenticated,service_role;
create table public.cqa_businesses(id uuid primary key,owner_id uuid references auth.users(id),status text default 'live');
create table public.cqa_machines(id uuid primary key,business_id uuid references public.cqa_businesses(id),status text default 'live');
create table public.cqa_offers(id uuid primary key default gen_random_uuid(),business_id uuid references public.cqa_businesses(id),machine_id uuid references public.cqa_machines(id),name text,description text,offer_type text,fulfillment_type text,shipping_required boolean default false,inventory_tracking boolean default false,inventory_quantity integer,price_cents integer,currency text,active boolean,image_url text,external_url text,fulfillment_config jsonb,updated_at timestamptz default now());
create table public.cqa_orders(id uuid primary key default gen_random_uuid(),business_id uuid references public.cqa_businesses(id),machine_id uuid,offer_id uuid,customer_user_id uuid,buyer_user_id uuid,status text,amount_cents integer,currency text,stripe_checkout_session_id text unique,purchase_snapshot jsonb default '{}'::jsonb,created_at timestamptz default now());
grant all on public.cqa_businesses,public.cqa_machines,public.cqa_offers,public.cqa_orders to service_role;
grant select on public.cqa_businesses,public.cqa_orders to authenticated;grant select,insert,update on public.cqa_offers to authenticated;
alter table public.cqa_businesses enable row level security;create policy owner_business on public.cqa_businesses for select to authenticated using(owner_id=(select auth.uid()));
alter table public.cqa_offers enable row level security;create policy owner_offer on public.cqa_offers to authenticated using(exists(select1 from public.cqa_businesses b where b.id=business_id and b.owner_id=(select auth.uid()))) with check(exists(select1 from public.cqa_businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
` .replaceAll('select1','select 1'));
for(const user of [owner,buyer,other])await db.query('insert into auth.users values($1)',[user]);
await db.query('insert into public.cqa_businesses(id,owner_id) values($1,$2),($3,$4)',[business,owner,foreign,other]);await db.query('insert into public.cqa_machines(id,business_id) values($1,$2)',[machine,business]);
await db.exec(await readFile(new URL('../supabase/migrations/20261121040553_merchant_product_fulfillment.sql',import.meta.url),'utf8'));
await role('service_role');
let saved=await save(null,null,2);const offer=saved.product.id;assert.equal(saved.product.product_revision,1);assert.equal(saved.available_quantity,2);
const a=await reserve(offer);assert.equal((await reserve(offer)).id,a.id);const b=await reserve(offer,other,id(101));await denied(()=>reserve(offer,other,id(102)),'23514');
assert.equal((await db.query('select inventory_quantity from public.cqa_offers where id=$1',[offer])).rows[0].inventory_quantity,2);
await denied(()=>save(offer,1,-1),'23514');await denied(()=>save(offer,0,1),'40001');await denied(()=>save(offer,1,1,product,other),'42501');
saved=await save(offer,1,1);assert.equal(saved.available_quantity,1);assert.equal(saved.reserved_quantity,2);assert.equal(saved.product.product_revision,2);
console.log('PASS actual PostgreSQL migration: stock reservations cannot oversell; retries, stock floors, actor isolation and revisions hold');
const o=await order(offer,40,'cs_shipping');await rpc('cqa_bind_inventory_reservation',[a.id,'cs_shipping',o]);
const o2=await order(offer,41,'cs_cancel',3650,'physical_product','pending',other);await rpc('cqa_bind_inventory_reservation',[b.id,'cs_cancel',o2]);
await db.query("update public.cqa_orders set status='paid' where id=$1",[o]);
await denied(()=>rpc('cqa_record_product_fulfillment',[o,'cs_shipping',JSON.stringify({...address,country:'US'})]),'23514');
assert.equal((await db.query('select state from public.cqa_inventory_reservations where id=$1',[a.id])).rows[0].state,'reserved');
let outcome=await rpc('cqa_record_product_fulfillment',[o,'cs_shipping',JSON.stringify(address)]);assert.equal(outcome.shipment.state,'ready');assert.equal(outcome.reservation.state,'committed');
await rpc('cqa_record_product_fulfillment',[o,'cs_shipping',JSON.stringify(address)]);
assert.equal((await db.query('select inventory_quantity from public.cqa_offers where id=$1',[offer])).rows[0].inventory_quantity,2);
assert.equal((await db.query('select count(*)::int n from public.cqa_product_fulfillment_jobs')).rows[0].n,1);
await denied(()=>rpc('cqa_record_product_fulfillment',[o,'cs_shipping',JSON.stringify({...address,line1:'Another address'})]),'23514');
await db.query("update public.cqa_orders set status='cancelled' where id=$1",[o2]);await denied(()=>db.query("update public.cqa_orders set status='paid' where id=$1",[o2]),'23514');
assert.equal((await db.query('select state from public.cqa_inventory_reservations where id=$1',[b.id])).rows[0].state,'released');
console.log('PASS nonzero shipping fee binding, invalid address rollback, exactly-one fulfilment/stock debit and late-paid released hold rejection');
await denied(()=>rpc('cqa_update_order_shipment',[o,other,'pack','{}',0]),'42501');
outcome=await rpc('cqa_update_order_shipment',[o,owner,'pack','{}',0]);assert.equal(outcome.shipment.state,'packing');
await denied(()=>rpc('cqa_update_order_shipment',[o,owner,'pack','{}',0]),'40001');
await denied(()=>rpc('cqa_update_order_shipment',[o,owner,'ship',JSON.stringify({carrier:'Carrier',tracking_number:'TRACK1',tracking_url:'https://user:password@example.test'}),1]),'23514');
outcome=await rpc('cqa_update_order_shipment',[o,owner,'ship',JSON.stringify({carrier:'Australia Post',tracking_number:'TRACK1',tracking_url:'https://auspost.com.au/track/TRACK1'}),1]);assert.equal(outcome.shipment.state,'shipped');
await db.query("update public.cqa_orders set status='refunded' where id=$1",[o]);
await denied(()=>rpc('cqa_update_order_shipment',[o,owner,'deliver','{}',2]),'23514');
assert.equal((await db.query('select state from public.cqa_order_shipments where order_id=$1',[o])).rows[0].state,'shipped');
assert.equal((await db.query('select inventory_quantity from public.cqa_offers where id=$1',[offer])).rows[0].inventory_quantity,2);
console.log('PASS merchant-only revisioned dispatch, safe tracking URL, refund stops actions and preserves shipment history without restocking');
await role('authenticated',other);assert.equal((await db.query('select count(*)::int n from public.cqa_order_shipments')).rows[0].n,0);await denied(()=>rpc('cqa_reserve_inventory',[offer,buyer,id(104),1]),'42501');
await role('authenticated',owner);assert.equal((await db.query('select count(*)::int n from public.cqa_order_shipments')).rows[0].n,1);await denied(()=>db.query('update public.cqa_offers set inventory_quantity=999 where id=$1',[offer]),'42501');await denied(()=>db.query("update public.cqa_order_shipments set state='delivered' where order_id=$1",[o]),'42501');
await role('anon');await denied(()=>db.query('select * from public.cqa_order_shipments'),'42501');await denied(()=>rpc('cqa_update_order_shipment',[o,owner,'deliver','{}',2]),'42501');
console.log('PASS actual RLS/grants: outsider and anonymous isolation, no browser inventory or shipment writes, server-only RPCs');
await role('service_role');
const digital={...product,active:false,name:'Digital PDF',offer_type:'digital_product',fulfillment_type:'digital',inventory_tracking:false,shipping_required:false,fulfillment_config:{...terms}};
saved=await save(null,null,0,digital);const d=saved.product.id;await db.query("update public.cqa_offers set fulfillment_config=fulfillment_config||$1::jsonb where id=$2",[JSON.stringify({asset_key:`marketplace/${business}/${d}/file.pdf`,asset_size_bytes:100,asset_content_type:'application/pdf'}),d]);
const digitalOrder=await order(d,42,'cs_digital',2900,'digital_product','paid');outcome=await rpc('cqa_record_product_fulfillment',[digitalOrder,'cs_digital','{}']);assert.equal(outcome.job.kind,'digital_access');assert.equal(outcome.job.state,'completed');assert.equal(outcome.shipment,null);
console.log('PASS digital paid fulfilment ledger is separate from shipping (no actual object transfer or Stripe used)');
}finally{await db.close();}
