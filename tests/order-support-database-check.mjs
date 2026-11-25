import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Execute the production migration and transition function in PostgreSQL/WASM.
// No customer accounts, provider credentials or remote databases are involved.
const db = new PGlite();
const id = number => `26000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const owner = id(1), buyer = id(2), outsider = id(3), otherOwner = id(4);
const business = id(10), otherBusiness = id(11);
const order = id(20), otherOrder = id(21), refunded = id(22), pending = id(23), inProgress = id(24), digital = id(25), foreign = id(26);
const sql = 'select public.cqa_update_order_support($1::uuid,$2::uuid,$3,$4,$5::integer,$6::uuid) as result';
let requestNumber = 100;
const requestId = () => id(requestNumber++);
async function role(name) {
  assert.ok(['postgres', 'service_role', 'authenticated', 'anon'].includes(name));
  await db.exec('reset role');
  if (name !== 'postgres') await db.exec(`set role ${name}`);
}
async function call(orderId, actor, action, message = '', revision = 0, request = requestId()) {
  const result = await db.query(sql, [orderId, actor, action, message, revision, request]);
  // The API may wrap the row for future response additions; inspect persisted
  // state independently below rather than relying on one JSON envelope shape.
  return result.rows[0].result;
}
async function support(orderId) {
  return (await db.query('select * from public.cqa_order_support where order_id=$1', [orderId])).rows[0];
}
async function count(table, orderId) {
  assert.ok(['cqa_order_support', 'cqa_order_support_messages', 'cqa_order_support_requests'].includes(table));
  return (await db.query(`select count(*)::integer as count from public.${table} where order_id=$1`, [orderId])).rows[0].count;
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
    create table auth.users (id uuid primary key);
    grant usage on schema public,auth to anon,authenticated,service_role;
    create table public.cqa_businesses (id uuid primary key,owner_id uuid not null references auth.users(id));
    create table public.cqa_orders (
      id uuid primary key,business_id uuid not null references public.cqa_businesses(id),
      buyer_user_id uuid references auth.users(id),customer_user_id uuid references auth.users(id),status text not null
    );
    create table public.cqa_order_workspaces (
      order_id uuid primary key references public.cqa_orders(id),business_id uuid not null references public.cqa_businesses(id),state text not null
    );
    grant select,update on public.cqa_orders to service_role;
    grant select on public.cqa_businesses,public.cqa_order_workspaces to service_role;
  `);
  for (const actor of [owner, buyer, outsider, otherOwner]) await db.query('insert into auth.users values ($1)', [actor]);
  await db.query('insert into public.cqa_businesses values ($1,$2),($3,$4)', [business, owner, otherBusiness, otherOwner]);
  for (const [orderId, status, businessId] of [
    [order, 'paid', business], [otherOrder, 'paid', business], [refunded, 'refunded', business],
    [pending, 'pending', business], [inProgress, 'paid', business], [digital, 'paid', business], [foreign, 'paid', otherBusiness],
  ]) {
    await db.query('insert into public.cqa_orders values ($1,$2,$3,$4,$5)', [orderId, businessId, status === 'refunded' ? null : buyer, buyer, status]);
  }
  for (const [orderId, state] of [[order, 'delivered'], [otherOrder, 'delivered'], [refunded, 'delivered'], [pending, 'delivered'], [inProgress, 'in_progress']]) {
    await db.query('insert into public.cqa_order_workspaces values ($1,$2,$3)', [orderId, business, state]);
  }
  const migration = await readFile(new URL('../supabase/migrations/20261126010000_order_support.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  const functionInfo = (await db.query("select prosecdef from pg_proc where oid='public.cqa_update_order_support(uuid,uuid,text,text,integer,uuid)'::regprocedure")).rows[0];
  assert.equal(functionInfo.prosecdef, false, 'Support transitions must use the service role privileges, not SECURITY DEFINER');
  for (const table of ['cqa_order_support', 'cqa_order_support_messages', 'cqa_order_support_requests']) {
    assert.equal((await db.query('select relrowsecurity from pg_class where oid=$1::regclass', [`public.${table}`])).rows[0].relrowsecurity, true);
  }
  await role('service_role');
  await denied(() => db.query('select * from auth.users'), '42501');
  console.log('PASS support migration applies with RLS and an invoker-only service transition');

  await denied(() => call(order, outsider, 'message', 'This is not my order.'), '42501');
  await denied(() => call(order, otherOwner, 'message', 'This belongs to another merchant.'), '42501');
  await denied(() => call(foreign, owner, 'message', 'Wrong business.'), '42501');
  await denied(() => call(order, buyer, 'message', '   '), '23514');
  await denied(() => call(order, buyer, 'message', 'x'.repeat(3001)), '23514');
  await denied(() => call(order, buyer, 'unsupported', 'Invalid transition'), '23514');
  assert.equal(await count('cqa_order_support', order), 0);
  assert.equal(await count('cqa_order_support_messages', order), 0);
  assert.equal(await count('cqa_order_support_requests', order), 0);
  console.log('PASS foreign actors and invalid messages/actions fail without partial thread or request records');

  const firstRequest = requestId();
  await call(order, buyer, 'message', 'Please help connect my machine.', 0, firstRequest);
  let thread = await support(order);
  assert.equal(thread.business_id, business); assert.equal(thread.state, 'waiting_owner'); assert.equal(thread.revision, 1);
  const buyerMessage = (await db.query('select * from public.cqa_order_support_messages where id=$1', [firstRequest])).rows[0];
  assert.equal(buyerMessage.actor_user_id, buyer); assert.equal(buyerMessage.actor_role, 'buyer');
  assert.equal(buyerMessage.message, 'Please help connect my machine.');
  await denied(() => call(order, owner, 'message', 'Stale reply', 0), '40001');
  assert.equal(await count('cqa_order_support_messages', order), 1);
  await call(order, owner, 'message', 'Your machine settings are ready to review.', 1);
  thread = await support(order);
  assert.equal(thread.state, 'waiting_customer'); assert.equal(thread.revision, 2);
  assert.equal((await db.query("select actor_role from public.cqa_order_support_messages where order_id=$1 and actor_user_id=$2", [order, owner])).rows[0].actor_role, 'owner');
  await call(order, buyer, 'resolve', '', 2);
  thread = await support(order);
  assert.equal(thread.state, 'resolved'); assert.equal(thread.revision, 3);
  await call(order, buyer, 'message', 'I have a follow-up question.', 3);
  thread = await support(order);
  assert.equal(thread.state, 'waiting_owner'); assert.equal(thread.revision, 4);
  await call(order, owner, 'resolve', '', 4);
  await call(order, buyer, 'reopen', '', 5);
  thread = await support(order);
  assert.equal(thread.state, 'waiting_owner'); assert.equal(thread.revision, 6);
  console.log('PASS buyer/merchant replies, revision conflicts, resolution and customer follow-up/reopen');

  // A retry may arrive after replies and later revisions. It must return current
  // state, not append the original message again or require the stale revision.
  await call(order, buyer, 'message', 'Please help connect my machine.', 0, firstRequest);
  assert.equal((await support(order)).revision, 6);
  assert.equal(await count('cqa_order_support_messages', order), 3);
  await denied(() => call(order, buyer, 'message', 'Different body using the same ID', 6, firstRequest), '23514');
  await denied(() => call(order, buyer, 'resolve', '', 6, firstRequest), '23514');
  await denied(() => call(order, owner, 'message', 'Please help connect my machine.', 6, firstRequest), '23514');
  await denied(() => call(otherOrder, buyer, 'message', 'Please help connect my machine.', 0, firstRequest), '23514');
  assert.equal(await count('cqa_order_support', otherOrder), 0, 'A request ID collision must roll back newly initialized support state');
  assert.equal((await support(order)).revision, 6);
  console.log('PASS idempotent retries and request-ID collision protection across messages, actions, actors and orders');

  await call(refunded, buyer, 'message', 'Please explain my refund.', 0);
  await call(refunded, owner, 'message', 'Your refund is being handled.', 1);
  assert.equal((await support(refunded)).state, 'waiting_customer');
  assert.equal((await db.query('select status,buyer_user_id,customer_user_id from public.cqa_orders where id=$1', [refunded])).rows[0].status, 'refunded');
  await denied(() => call(refunded, buyer, 'confirm_delivery', '', 2), '23514');
  await denied(() => call(pending, buyer, 'confirm_delivery'), '23514');
  await denied(() => call(inProgress, buyer, 'confirm_delivery'), '23514');
  await denied(() => call(digital, buyer, 'confirm_delivery'), '23514');
  await denied(() => call(order, owner, 'confirm_delivery', '', 6), '42501');
  assert.equal((await support(order)).delivery_confirmed_at, null);
  const confirmRequest = requestId();
  await call(order, buyer, 'confirm_delivery', '', 6, confirmRequest);
  const confirmed = await support(order);
  assert.ok(confirmed.delivery_confirmed_at);
  await call(order, buyer, 'confirm_delivery', '', 6, confirmRequest);
  const repeated = await support(order);
  assert.equal(repeated.revision, confirmed.revision);
  assert.equal(String(repeated.delivery_confirmed_at), String(confirmed.delivery_confirmed_at));
  assert.equal((await db.query('select status from public.cqa_orders where id=$1', [order])).rows[0].status, 'paid');
  assert.equal((await db.query('select state from public.cqa_order_workspaces where order_id=$1', [order])).rows[0].state, 'delivered');
  console.log('PASS refund support remains available while confirmation requires a paid, delivered service and does not alter payment or fulfilment');

  const cappedMessageRequest = requestId();
  await call(otherOrder, buyer, 'message', 'First rate-limited conversation message.', 0, cappedMessageRequest);
  for (let index = 1; index < 5; index++) await call(otherOrder, buyer, 'message', `Additional message ${index}`, index);
  await denied(() => call(otherOrder, buyer, 'message', 'Sixth message must wait.', 5), '54000');
  assert.equal(await count('cqa_order_support_messages', otherOrder), 5);
  await call(otherOrder, buyer, 'message', 'First rate-limited conversation message.', 0, cappedMessageRequest);
  assert.equal((await support(otherOrder)).revision, 5, 'An idempotent retry must bypass message rate limits');
  let cappedActionRequest;
  for (let index = 0; index < 20; index++) {
    const key = requestId(); if (!index) cappedActionRequest = key;
    await call(otherOrder, owner, index % 2 ? 'reopen' : 'resolve', '', 5 + index, key);
  }
  await denied(() => call(otherOrder, owner, 'resolve', '', 25), '54000');
  assert.equal((await support(otherOrder)).revision, 25);
  assert.equal(await count('cqa_order_support_requests', otherOrder), 25);
  await call(otherOrder, owner, 'resolve', '', 5, cappedActionRequest);
  assert.equal((await support(otherOrder)).revision, 25, 'A valid idempotent retry must bypass the action update cap too');
  console.log('PASS message and resolve/reopen rate limits prevent unbounded writes while successful retries remain idempotent');

  for (const browserRole of ['authenticated', 'anon']) {
    await role(browserRole);
    for (const table of ['cqa_order_support', 'cqa_order_support_messages', 'cqa_order_support_requests']) {
      await denied(() => db.query(`select * from public.${table}`), '42501');
    }
    await denied(() => call(order, buyer, 'message', 'Forged browser mutation', confirmed.revision), '42501');
    await denied(() => db.query("update public.cqa_order_support set state='resolved' where order_id=$1", [order]), '42501');
    await denied(() => db.query('insert into public.cqa_order_support_messages(id,order_id,actor_user_id,actor_role,message) values ($1,$2,$3,$4,$5)', [requestId(), order, owner, 'owner', 'Forged owner reply']), '42501');
  }
  console.log('PASS anonymous and authenticated browser roles cannot read private support tables, write messages or invoke privileged transitions');
} finally {
  await db.close();
}
