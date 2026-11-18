import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL/PLpgSQL in memory. No Supabase project or provider is contacted.
const db = new PGlite();
const id = number => `10000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const owner = id(1), buyer = id(2), outsider = id(3), otherOwner = id(4);
const business = id(10), otherBusiness = id(11), machine = id(20), otherMachine = id(21);
const offer = id(30), digitalOffer = id(31), otherOffer = id(32);
const order = id(40), pending = id(41), refunded = id(42), digital = id(43), editable = id(44), foreign = id(45);
const brief = { businessName: 'Fixture business', goals: 'Deliver the purchased service', details: 'Local SQL test only.' };
const rpcSql = 'select public.cqa_update_order_workspace($1::uuid,$2::uuid,$3,$4::jsonb,$5::integer) as result';
async function role(name, userId = '') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userId]);
  assert.ok(['postgres', 'service_role', 'authenticated', 'anon'].includes(name));
  if (name !== 'postgres') await db.exec(`set role ${name}`);
}
async function call(orderId, actor, action, payload = {}, revision = 0) {
  const result = await db.query(rpcSql, [orderId, actor, action, JSON.stringify(payload), revision]);
  return result.rows[0].result.workspace;
}
async function denied(operation, code) {
  await assert.rejects(operation, error => error.code === code, `Expected PostgreSQL SQLSTATE ${code}`);
}

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    create table public.cqa_businesses (id uuid primary key,owner_id uuid not null references auth.users(id));
    create table public.cqa_offers (id uuid primary key,business_id uuid not null,machine_id uuid not null,offer_type text,fulfillment_type text);
    create table public.cqa_orders (
      id uuid primary key,business_id uuid not null references public.cqa_businesses(id),machine_id uuid,offer_id uuid,
      customer_user_id uuid references auth.users(id),buyer_user_id uuid references auth.users(id),status text not null,
      created_at timestamptz default now()
    );
    grant select,update on public.cqa_orders to service_role;
    grant select on public.cqa_businesses,public.cqa_offers to service_role;
    grant select on public.cqa_businesses,public.cqa_orders to authenticated;
    alter table public.cqa_businesses enable row level security;
    create policy business_owner_read on public.cqa_businesses for select to authenticated using (owner_id=(select auth.uid()));
    alter table public.cqa_orders enable row level security;
    create policy order_owner_customer_read on public.cqa_orders for select to authenticated using (
      customer_user_id=(select auth.uid()) or exists(select 1 from public.cqa_businesses b where b.id=business_id and b.owner_id=(select auth.uid()))
    );
  `);
  for (const user of [owner, buyer, outsider, otherOwner]) {
    await db.query('insert into auth.users(id,email_confirmed_at) values ($1,now())', [user]);
  }
  await db.query('insert into public.cqa_businesses values ($1,$2),($3,$4)', [business, owner, otherBusiness, otherOwner]);
  await db.query("insert into public.cqa_offers values ($1,$2,$3,'service','service'),($4,$2,$3,'digital_product','digital'),($5,$6,$7,'service','service')",
    [offer,business,machine,digitalOffer,otherOffer,otherBusiness,otherMachine]);
  for (const [orderId, status, offerId, businessId, machineId] of [
    [order,'paid',offer,business,machine], [pending,'pending',offer,business,machine],
    [refunded,'refunded',offer,business,machine], [digital,'paid',digitalOffer,business,machine],
    [editable,'paid',offer,business,machine], [foreign,'paid',otherOffer,otherBusiness,otherMachine],
  ]) {
    await db.query('insert into public.cqa_orders(id,business_id,machine_id,offer_id,buyer_user_id,status) values ($1,$2,$3,$4,$5,$6)',
      [orderId,businessId,machineId,offerId,buyer,status]);
  }

  const migration = await readFile(new URL('../supabase/migrations/20261118235214_customer_fulfillment.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  assert.equal((await db.query('select customer_user_id from public.cqa_orders where id=$1', [order])).rows[0].customer_user_id, buyer);
  await role('service_role');
  await denied(() => db.query('select id from auth.users'), '42501');
  console.log('PASS actual migration applies and backfills identity without requiring service-role access to auth.users');

  await denied(() => call(order, outsider, 'submit_intake', brief), '42501');
  await denied(() => call(order, otherOwner, 'start'), '42501');
  await denied(() => call(pending, buyer, 'submit_intake', brief), '23514');
  await denied(() => call(refunded, buyer, 'submit_intake', brief), '23514');
  await denied(() => call(digital, buyer, 'submit_intake', brief), '23514');
  await denied(() => call(order, owner, 'deliver', { message: 'too early' }), '23514');
  await denied(() => call(order, owner, 'submit_intake', brief), '42501');
  await denied(() => call(order, buyer, 'submit_intake', { businessName: '', goals: '' }), '23514');
  assert.equal((await db.query('select count(*)::integer as count from public.cqa_order_workspaces')).rows[0].count, 0);
  console.log('PASS foreign actors, unpaid/digital orders and invalid transitions fail atomically');

  let workspace = await call(order, buyer, 'submit_intake', brief);
  assert.equal(workspace.state, 'queued'); assert.equal(workspace.revision, 1);
  assert.deepEqual(workspace.intake, brief);
  await denied(() => call(order, owner, 'start', {}, 0), '40001');
  await denied(() => call(order, buyer, 'start', {}, 1), '42501');
  workspace = await call(order, owner, 'start', {}, 1);
  assert.equal(workspace.state, 'in_progress'); assert.equal(workspace.revision, 2);
  await denied(() => call(order, buyer, 'submit_intake', brief, 2), '23514');
  await denied(() => call(order, owner, 'deliver', {}, 2), '23514');
  const asset = { asset_key: `fulfillment/${business}/${order}/${id(60)}.txt`, asset_name: 'delivery.txt', asset_size: 20, asset_type: 'text/plain' };
  for (const key of [`fulfillment/${otherBusiness}/${order}/file.txt`, `${asset.asset_key}/../other.txt`, 'https://public.example/paid.pdf']) {
    await denied(() => call(order, owner, 'attach_asset', { ...asset, asset_key: key }, 2), '23514');
  }
  await denied(() => call(order, owner, 'attach_asset', { ...asset, asset_size: 4194305 }, 2), '23514');
  await denied(() => call(order, owner, 'attach_asset', { ...asset, asset_type: 'text/html' }, 2), '23514');
  workspace = await call(order, owner, 'attach_asset', asset, 2);
  assert.equal(workspace.asset_key, asset.asset_key); assert.equal(workspace.revision, 3);
  workspace = await call(order, owner, 'deliver', { message: 'Your private service deliverable is ready.' }, 3);
  assert.equal(workspace.state, 'delivered'); assert.equal(workspace.revision, 4);
  const events = (await db.query('select kind,actor_role,message from public.cqa_order_events where order_id=$1 order by created_at,id', [order])).rows;
  assert.deepEqual(events.map(event => event.kind), ['intake_submitted','work_started','asset_attached','delivered']);
  assert.deepEqual(events.map(event => event.actor_role), ['buyer','owner','owner','owner']);
  assert.ok(events.every(event => !event.message.includes('private service deliverable')));
  console.log('PASS intake, work, private asset and delivery persist revisions and a content-free audit timeline');

  await call(editable, buyer, 'submit_intake', brief);
  workspace = await call(editable, buyer, 'submit_intake', { ...brief, goals: 'Updated brief before work starts' }, 1);
  assert.equal(workspace.state, 'queued'); assert.equal(workspace.revision, 2);
  await denied(() => call(editable, owner, 'start', {}, 1), '40001');
  await call(foreign, buyer, 'submit_intake', brief);
  await role('authenticated', owner);
  assert.equal((await db.query('select count(*)::integer as count from public.cqa_order_workspaces')).rows[0].count, 2);
  assert.equal((await db.query('select count(*)::integer as count from public.cqa_order_workspaces where order_id=$1', [foreign])).rows[0].count, 0);
  assert.equal((await db.query('select count(*)::integer as count from public.cqa_order_events')).rows[0].count, 6);
  await denied(() => call(order, owner, 'deliver', { message: 'Spoofed direct client request' }, 4), '42501');
  await denied(() => db.query("update public.cqa_order_workspaces set state='delivered' where order_id=$1", [editable]), '42501');
  await role('authenticated', buyer);
  assert.equal((await db.query('select count(*)::integer as count from public.cqa_order_workspaces')).rows[0].count, 0);
  await denied(() => call(editable, buyer, 'submit_intake', brief, 2), '42501');
  await role('anon');
  await denied(() => db.query('select * from public.cqa_order_workspaces'), '42501');
  await denied(() => call(order, buyer, 'submit_intake', brief, 4), '42501');
  console.log('PASS owner-only RLS reads and no direct browser/anonymous fulfilment writes or RPC access');

  await role('service_role');
  await db.query("update public.cqa_orders set status='refunded',buyer_user_id=null where id=$1", [order]);
  await denied(() => call(order, owner, 'deliver', { message: 'Cannot restore a refunded order' }, 4), '23514');
  const history = (await db.query('select customer_user_id,buyer_user_id from public.cqa_orders where id=$1', [order])).rows[0];
  assert.equal(history.customer_user_id, buyer); assert.equal(history.buyer_user_id, null);
  assert.equal((await db.query('select count(*)::integer as count from public.cqa_order_events where order_id=$1', [order])).rows[0].count, 4);
  console.log('PASS refund retains purchaser history and cannot create further fulfilment or events');

  // Purchase classification is historical. A seller changing the catalogue
  // must not turn an old digital purchase into a service order, or vice versa.
  await role('postgres');
  const historicalDigitalOffer = id(70), historicalServiceOffer = id(71), fallbackServiceOffer = id(72), fallbackDigitalOffer = id(73);
  const historicalDigital = id(80), historicalService = id(81), malformedService = id(82), malformedDigital = id(83), missingOffer = id(84), wrongScope = id(85);
  const serviceSnapshot = { title: 'Purchased service', offerType: 'service', fulfillmentType: null };
  const digitalSnapshot = { title: 'Purchased download', offerType: 'digital_product', fulfillmentType: 'digital' };
  await db.query(`insert into public.cqa_offers values
    ($1,$2,$3,'digital_product','digital'),($4,$2,$3,'service','service'),
    ($5,$2,$3,'service','service'),($6,$2,$3,'digital_product','digital')`,
  [historicalDigitalOffer,business,machine,historicalServiceOffer,fallbackServiceOffer,fallbackDigitalOffer]);
  for (const [orderId, offerId, snapshot] of [
    [historicalDigital,historicalDigitalOffer,digitalSnapshot],
    [historicalService,historicalServiceOffer,serviceSnapshot],
    [malformedService,fallbackServiceOffer,{ ...digitalSnapshot, title: 7 }],
    [malformedDigital,fallbackDigitalOffer,{ ...serviceSnapshot, offerType: 'unsupported-type' }],
    [missingOffer,id(99),serviceSnapshot],
    [wrongScope,otherOffer,serviceSnapshot],
  ]) {
    await db.query(`insert into public.cqa_orders
      (id,business_id,machine_id,offer_id,customer_user_id,buyer_user_id,status,purchase_snapshot)
      values ($1,$2,$3,$4,$5,$5,'paid',$6::jsonb)`,
    [orderId,business,machine,offerId,buyer,JSON.stringify(snapshot)]);
  }
  await db.query("update public.cqa_offers set offer_type='service',fulfillment_type='service' where id=$1", [historicalDigitalOffer]);
  await db.query("update public.cqa_offers set offer_type='digital_product',fulfillment_type='digital' where id=$1", [historicalServiceOffer]);
  await role('service_role');
  await denied(() => call(historicalDigital, buyer, 'submit_intake', brief), '23514');
  workspace = await call(historicalService, buyer, 'submit_intake', brief);
  assert.equal(workspace.state, 'queued'); assert.equal(workspace.revision, 1);
  workspace = await call(malformedService, buyer, 'submit_intake', brief);
  assert.equal(workspace.state, 'queued'); assert.equal(workspace.revision, 1);
  await denied(() => call(malformedDigital, buyer, 'submit_intake', brief), '23514');
  await denied(() => call(missingOffer, buyer, 'submit_intake', brief), 'P0002');
  await denied(() => call(wrongScope, buyer, 'submit_intake', brief), 'P0002');
  const snapshotRows = (await db.query(`select order_id,state from public.cqa_order_workspaces
    where order_id in ($1,$2,$3,$4,$5,$6) order by order_id`,
  [historicalDigital,historicalService,malformedService,malformedDigital,missingOffer,wrongScope])).rows;
  assert.deepEqual(snapshotRows, [
    { order_id: historicalService, state: 'queued' }, { order_id: malformedService, state: 'queued' }
  ]);
  console.log('PASS valid historical snapshots preserve purchased type; malformed snapshots fall back, missing/foreign offers fail closed');
} finally {
  await db.close();
}
