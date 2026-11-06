import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function evaluate(path, mocks = {}, globals = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), compiled)(
    name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports, ...Object.values(globals));
  return module.exports;
}
async function test(name, run) { await run(); console.log('PASS ' + name); }

const businessId = '10000000-0000-4000-8000-000000000001';
const machineId = '10000000-0000-4000-8000-000000000002';
const offerId = '10000000-0000-4000-8000-000000000003';
const buyerId = '10000000-0000-4000-8000-000000000004';
const foreignId = '10000000-0000-4000-8000-000000000005';
const assetKey = `marketplace/${businessId}/${offerId}/10000000-0000-4000-8000-000000000006.pdf`;
const checkoutUrl = 'https://checkout.stripe.com/c/pay/cs_test_synthetic';
const testKey = 'sk_test_' + 'a'.repeat(24);
const liveKey = 'sk_live_' + 'a'.repeat(24);
const assets = evaluate('lib/cqa-marketplace-assets.ts');
const originalMarket = evaluate('lib/cqa-marketplace.ts', { '@supabase/supabase-js': { createClient() { throw Error('Unexpected real client'); } } });

function gates(env = {}) { return evaluate('lib/cqa-launch-gate.ts', {}, { process: { env } }); }
function harness(options = {}) {
  const env = { STRIPE_SECRET_KEY: testKey, ...options.env };
  const events = [], sessions = [], checks = [], queries = [], logs = [], authTokens = [];
  const context = { business_id: businessId, machine_id: machineId, offer_id: offerId, machine_slug: 'test-store',
    offer_type: options.type || 'digital_product', offer_name: 'Synthetic owner PDF', offer_description: 'Test-only file',
    currency: 'aud', price_cents: 1299, business_plan: 'pro', connected_account_id: 'acct_test', charges_enabled: true, onboarding_complete: true,
    ...options.context };
  const offer = { id: offerId, business_id: businessId, machine_id: machineId, offer_type: context.offer_type,
    fulfillment_type: context.offer_type === 'digital_product' ? 'digital' : 'manual',
    fulfillment_config: { asset_key: assetKey, asset_size_bytes: 64, asset_content_type: 'application/pdf', ...options.config }, ...options.offer };
  const admin = { from(table) {
    const filters = []; queries.push({ table, filters });
    const query = { select() { return query; }, eq(k, v) { filters.push([k, v]); return query; },
      async maybeSingle() { return answer(); }, async single() { return answer(); } };
    function answer() {
      if (options.dbError) return { data: null, error: Error('private-provider-detail') };
      const row = table === 'cqa_offers' ? offer : table === 'cqa_plan_subscriptions' ? { business_id: businessId, status: options.inactive ? 'cancelled' : 'active' } : null;
      return { data: options.missingOffer && table === 'cqa_offers' ? null : row && filters.every(([k, v]) => row[k] === v) ? row : null, error: null };
    }
    return query;
  } };
  const stripe = { accounts: { async retrieve(id) {
    events.push('account');
    return { id, metadata: { cqaBusinessId: options.accountMismatch ? foreignId : businessId }, charges_enabled: !options.disabledAccount, details_submitted: true };
  } }, checkout: { sessions: { async create(data, request) {
    events.push('session'); sessions.push({ data, request });
    if (options.stripeError) throw Error('private-stripe-provider-detail');
    return { url: options.noCheckoutUrl ? null : checkoutUrl };
  } } } };
  const route = evaluate('app/api/marketplace/checkout/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/cqa-site-url': { getCqaSiteUrl: () => 'https://cqa.example.test' },
    '@/lib/cqa-launch-gate': gates(env),
    '@/lib/stripe': { getStripeClient: () => stripe },
    '@/lib/cqa-supabase-admin': { getCqaSupabaseAdmin: () => admin },
    '@/lib/cqa-billing': { isActiveBillingStatus: status => ['active', 'trialing'].includes(status) },
    '@/lib/cqa-marketplace-assets': assets,
    '@/lib/cqa-marketplace': { platformFeePercent: originalMarket.platformFeePercent,
      getPublicSupabaseClient: () => ({
        rpc: async () => options.rpcError ? { data: null, error: Error('private-rpc-provider-detail') } : { data: options.noContext ? null : [context], error: null },
        auth: { getUser: async token => {
          events.push('auth'); authTokens.push(token);
          if (options.authError) throw Error('private-auth-provider-detail');
          if (options.invalidToken || token !== 'verified-buyer-token') return { data: { user: null }, error: Error('Invalid token') };
          return { data: { user: { id: buyerId, email: 'buyer@example.test', email_confirmed_at: options.unconfirmed ? null : '2026-10-31' } }, error: null };
        } },
      }) },
    '@/lib/storage': { verifyPrivateMarketplaceAsset: async (...args) => {
      events.push('head'); checks.push(args);
      if (options.headError) throw Error('private-storage-provider-detail');
      return !options.headMissing;
    } },
  }, { process: { env }, console: { error: (...args) => logs.push(args.map(String).join(' ')), warn: (...args) => logs.push(args.map(String).join(' ')) } });
  return { ...route, env, events, sessions, checks, queries, logs, authTokens, context,
    post(token = 'verified-buyer-token', extra = {}) {
      return route.POST(new Request('https://cqa.example.test/api/marketplace/checkout', { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token === null ? {} : { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ machineSlug: 'test-store', offerId, ...extra }) }));
    } };
}

await test('digital gate permits test credentials and requires both explicit live approvals', async () => {
  for (const prefix of ['sk_test_', 'rk_test_', 'rkcs_test_']) assert.equal(gates({ STRIPE_SECRET_KEY: prefix + 'a'.repeat(24) }).isCqaDigitalCheckoutAllowed(), true);
  for (const env of [{}, { CQA_CUSTOMER_LAUNCH_APPROVED: 'true', CQA_DIGITAL_DELIVERY_APPROVED: 'true' },
    { STRIPE_SECRET_KEY: liveKey }, { STRIPE_SECRET_KEY: liveKey, CQA_CUSTOMER_LAUNCH_APPROVED: 'true' },
    { STRIPE_SECRET_KEY: liveKey, CQA_DIGITAL_DELIVERY_APPROVED: 'true' }]) assert.equal(gates(env).isCqaDigitalCheckoutAllowed(), false);
  assert.equal(gates({ STRIPE_SECRET_KEY: liveKey, CQA_CUSTOMER_LAUNCH_APPROVED: 'true', CQA_DIGITAL_DELIVERY_APPROVED: 'true' }).isCqaDigitalCheckoutAllowed(), true);
  const h = harness({ env: { STRIPE_SECRET_KEY: liveKey, CQA_CUSTOMER_LAUNCH_APPROVED: 'true' } });
  const response = await h.post(); assert.equal(response.status, 409); assert.equal((await response.json()).code, 'CQA_DIGITAL_DELIVERY_PENDING');
  assert.deepEqual(h.events, []); assert.equal(h.sessions.length, 0);
});

await test('real digital checkout binds verified buyer, original price, fee, account and metadata after storage verification', async () => {
  const h = harness(); const response = await h.post(); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { url: checkoutUrl });
  assert.equal(h.sessions.length, 1); assert.deepEqual(h.checks, [[assetKey, 64, 'application/pdf']]);
  assert.equal(h.events[0], 'auth'); assert.ok(h.events.indexOf('head') < h.events.indexOf('session'));
  const { data, request } = h.sessions[0]; assert.equal(data.mode, 'payment'); assert.equal(data.customer_email, 'buyer@example.test');
  assert.equal(data.line_items[0].price_data.unit_amount, 1299); assert.equal(data.line_items[0].price_data.currency, 'aud');
  assert.equal(data.payment_intent_data.application_fee_amount, Math.round(1299 * .03));
  assert.deepEqual(data.metadata, { cqaBusinessId: businessId, cqaMachineId: machineId, cqaOfferId: offerId, cqaPlan: 'pro', cqaBuyerUserId: buyerId });
  assert.deepEqual(data.payment_intent_data.metadata, data.metadata); assert.deepEqual(request, { stripeAccount: 'acct_test' });
  assert.match(data.success_url, /^https:\/\/cqa\.example\.test\/checkout\/success\?/); assert.match(data.success_url, /session_id=\{CHECKOUT_SESSION_ID\}/);
  assert.equal(data.cancel_url, 'https://cqa.example.test/machine/test-store');
  for (const query of h.queries.filter(q => q.table === 'cqa_offers')) {
    for (const pair of [['id', offerId], ['business_id', businessId], ['machine_id', machineId]]) assert.ok(query.filters.some(([k, v]) => k === pair[0] && v === pair[1]));
  }
  assert.doesNotMatch(JSON.stringify(h.logs), /verified-buyer-token|marketplace\/|private-/);
});

await test('digital checkout rejects missing invalid unconfirmed and mismatched-email buyers before storage or Stripe', async () => {
  for (const scenario of [{ token: null }, { token: 'expired-token' }, { options: { invalidToken: true } }, { options: { unconfirmed: true } }, { payload: { customerEmail: 'other@example.test' } }]) {
    const h = harness(scenario.options); const r = await h.post(Object.hasOwn(scenario, 'token') ? scenario.token : 'verified-buyer-token', scenario.payload);
    assert.equal(r.status, 401); assert.equal((await r.json()).code, 'CQA_BUYER_LOGIN_REQUIRED'); assert.equal(h.checks.length, 0); assert.equal(h.sessions.length, 0); assert.equal(h.events.includes('account'), false);
  }
});

await test('cross-tenant machine offer and invalid private asset configuration never create checkout', async () => {
  const keys = ['', 'https://public.example.test/product.pdf', 'cqa-machine-media/public.pdf', `marketplace/${foreignId}/${offerId}/file.pdf`,
    `marketplace/${businessId}/${foreignId}/file.pdf`, `marketplace/${businessId}/${offerId}/../file.pdf`,
    assetKey + '?public=1', assetKey + '#public', `marketplace/${businessId}/${offerId}/folder\\file.pdf`];
  const scenarios = [ ...keys.map(key => ({ config: { asset_key: key } })),
    { offer: { business_id: foreignId } }, { offer: { machine_id: foreignId } }, { offer: { id: foreignId } },
    ...[0, -1, 4 * 1024 * 1024 + 1, '64', null].map(size => ({ config: { asset_size_bytes: size } })),
    ...['text/html', 'constructor', 'toString', '__proto__', null].map(type => ({ config: { asset_content_type: type } })), { offer: { fulfillment_config: null } } ];
  for (const scenario of scenarios) {
    const h = harness(scenario); const r = await h.post(); assert.ok([404, 409].includes(r.status)); assert.equal(h.sessions.length, 0); assert.equal(h.checks.length, 0);
    assert.doesNotMatch(JSON.stringify(await r.json()), /asset_key|marketplace\/|private-/);
  }
});

await test('unconfirmed storage metadata and storage provider errors fail closed without leaking details', async () => {
  for (const scenario of [{ headMissing: true }, { headError: true }]) {
    const h = harness(scenario); const r = await h.post(); assert.equal(r.status, scenario.headError ? 503 : 409);
    if (scenario.headError) assert.equal((await r.clone().json()).code, 'CQA_DIGITAL_ASSET_UNAVAILABLE');
    assert.equal(h.sessions.length, 0); assert.doesNotMatch(await r.text(), /private-storage|marketplace\//); assert.doesNotMatch(JSON.stringify(h.logs), /private-storage|marketplace\/|verified-buyer-token/);
  }
});

await test('unavailable offers billing and connected accounts cannot charge', async () => {
  for (const scenario of [{ noContext: true }, { missingOffer: true }, { inactive: true }, { accountMismatch: true }, { disabledAccount: true }, { context: { connected_account_id: null } }]) {
    const h = harness(scenario); const r = await h.post(); assert.ok([404, 409].includes(r.status)); assert.equal(h.sessions.length, 0);
  }
});

await test('provider failures and unusable prices never return a checkout URL or expose private details', async () => {
  for (const [options, status, attempts] of [[{ dbError: true }, 500, 0], [{ rpcError: true }, 503, 0],
    [{ authError: true }, 500, 0], [{ stripeError: true }, 500, 1], [{ noCheckoutUrl: true }, 502, 1],
    [{ context: { price_cents: 0 } }, 409, 0], [{ context: { price_cents: -1 } }, 409, 0]]) {
    const h = harness(options); const r = await h.post(); assert.equal(r.status, status); assert.equal(h.sessions.length, attempts);
    const body = await r.text(); assert.doesNotMatch(body, /private-|marketplace\/|verified-buyer-token|checkout\.stripe\.com/);
    assert.doesNotMatch(JSON.stringify(h.logs), /private-|marketplace\/|verified-buyer-token/);
  }
});

await test('legacy service and subscription checkout preserve original anonymous pricing and fee behavior', async () => {
  for (const type of ['service', 'subscription']) {
    const h = harness({ type }); const r = await h.post(null); assert.equal(r.status, 200); assert.equal(h.checks.length, 0);
    const data = h.sessions[0].data; assert.equal(data.mode, type === 'subscription' ? 'subscription' : 'payment');
    assert.equal(data.line_items[0].price_data.unit_amount, 1299); assert.equal(data.metadata.cqaBuyerUserId, undefined);
    if (type === 'subscription') { assert.deepEqual(data.line_items[0].price_data.recurring, { interval: 'month' }); assert.equal(data.subscription_data.application_fee_percent, 3); }
    else assert.equal(data.payment_intent_data.application_fee_amount, 39);
  }
  const h = harness({ type: 'service', env: { STRIPE_SECRET_KEY: liveKey } }); assert.equal((await h.post(null)).status, 503); assert.equal(h.sessions.length, 0);
});

await test('actual private-storage verification checks HeadObject metadata before permitting a sale', async () => {
  const commands = []; let head = { ContentLength: 64, ContentType: 'application/pdf' }, fail = false;
  class Command { constructor(input) { this.input = input; } }
  class HeadObjectCommand extends Command {}
  class S3Client { async send(command) { commands.push(command); if (fail) throw Error('Synthetic storage failure'); return head; } }
  const storage = evaluate('lib/storage.ts', { '@aws-sdk/client-s3': { S3Client, HeadObjectCommand, GetObjectCommand: Command, PutObjectCommand: Command },
    '@aws-sdk/s3-request-presigner': { getSignedUrl() { throw Error('Unexpected signing'); } }, '@/lib/cqa-marketplace-assets': assets,
  }, { process: { env: { R2_ACCOUNT_ID: 'synthetic', R2_ACCESS_KEY_ID: 'synthetic', R2_SECRET_ACCESS_KEY: 'synthetic', R2_BUCKET: 'private-test' } } });
  assert.equal(await storage.verifyPrivateMarketplaceAsset(assetKey, 64, 'application/pdf'), true);
  assert.ok(commands[0] instanceof HeadObjectCommand); assert.deepEqual(commands[0].input, { Bucket: 'private-test', Key: assetKey });
  for (const type of ['constructor', 'toString', '__proto__']) {
    const count = commands.length; assert.equal(await storage.verifyPrivateMarketplaceAsset(assetKey, 64, type), false); assert.equal(commands.length, count);
  }
  for (const value of [{ ContentLength: 0, ContentType: 'application/pdf' }, { ContentLength: 65, ContentType: 'application/pdf' },
    { ContentLength: 4 * 1024 * 1024 + 1, ContentType: 'application/pdf' }, { ContentLength: 64, ContentType: 'text/html' },
    { ContentLength: 64 }, {}]) { head = value; assert.equal(await storage.verifyPrivateMarketplaceAsset(assetKey, 64, 'application/pdf'), false); }
  fail = true; await assert.rejects(storage.verifyPrivateMarketplaceAsset(assetKey, 64, 'application/pdf'));
});

function find(node, predicate) { if (!node || typeof node !== 'object') return; if (predicate(node)) return node; for (const child of Array.isArray(node) ? node : [].concat(node.props?.children || [])) { const result = find(child, predicate); if (result) return result; } }
function textOf(node) { return !node || typeof node !== 'object' ? String(node ?? '') : (Array.isArray(node) ? node : [].concat(node.props?.children || [])).map(textOf).join(' '); }
function buttonHarness(options = {}) {
  const state = [], refs = [], requests = [], destinations = []; let index = 0, refIndex = 0;
  const jsx = (type, props) => ({ type, props });
  const component = evaluate('components/MarketplaceCheckoutButton.tsx', {
    react: { useState(initial) { const i = index++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
      useRef(initial) { return refs[refIndex++] ||= { current: initial }; } },
    'react/jsx-runtime': { jsx, jsxs: jsx }, 'next/link': { default: 'Link' },
    '@/lib/cqa-marketplace': { getBrowserSupabaseClient: () => ({ auth: { getSession: async () => {
      if (options.sessionError) throw Error('Session unavailable'); return { data: { session: options.noSession ? null : { access_token: 'verified-buyer-token' } }, error: null };
    } } }) },
  }, { fetch: async (url, request) => { requests.push({ url, request }); return options.response ? options.response() : Response.json({ url: checkoutUrl }); },
    window: { location: { assign: value => destinations.push(value) } } }).MarketplaceCheckoutButton;
  return { state, requests, destinations, render() { index = refIndex = 0; return component({ machineSlug: 'test-store', offerId, requiresBuyerAccount: !!options.requiresBuyerAccount }); } };
}

await test('actual purchase button supplies current bearer token and prevents same-frame duplicate sessions', async () => {
  let release;
  const ui = buttonHarness({ response: () => new Promise(resolve => { release = resolve; }) });
  const click = find(ui.render(), node => node.type === 'button').props.onClick;
  const first = click(); await click(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.requests.length, 1); assert.equal(new Headers(ui.requests[0].request.headers).get('authorization'), 'Bearer verified-buyer-token');
  assert.deepEqual(JSON.parse(ui.requests[0].request.body), { machineSlug: 'test-store', offerId });
  release(Response.json({ url: checkoutUrl })); await first; assert.deepEqual(ui.destinations, [checkoutUrl]);
});

await test('actual purchase button recovers from errors and gives a local sign-in destination for digital auth failure', async () => {
  const optional = buttonHarness({ sessionError: true });
  await find(optional.render(), node => node.type === 'button').props.onClick(); assert.equal(optional.requests.length, 1); assert.deepEqual(optional.destinations, [checkoutUrl]);
  const required = buttonHarness({ sessionError: true, requiresBuyerAccount: true });
  await find(required.render(), node => node.type === 'button').props.onClick(); assert.equal(required.requests.length, 0); assert.equal(required.destinations.length, 0); assert.ok(find(required.render(), node => node.props.role === 'alert'));
  const digital = buttonHarness({ noSession: true, requiresBuyerAccount: true });
  await find(digital.render(), node => node.type === 'button').props.onClick(); assert.equal(digital.requests.length, 0);
  assert.ok(find(digital.render(), node => node.type === 'Link')); assert.equal(digital.destinations.length, 0);
  const ui = buttonHarness({ noSession: true, response: async () => Response.json({ error: 'Verified buyer required', code: 'CQA_BUYER_LOGIN_REQUIRED' }, { status: 401 }) });
  await find(ui.render(), node => node.type === 'button').props.onClick();
  assert.equal(ui.destinations.length, 0); const link = find(ui.render(), node => node.type === 'Link'); assert.ok(link);
  const target = new URL(link.props.href, 'https://cqa.example.test'); assert.equal(target.origin, 'https://cqa.example.test'); assert.equal(target.pathname, '/login'); assert.equal(target.searchParams.get('next'), '/machine/test-store');
  for (const response of [async () => new Response('not-json'), async () => Response.json({ error: 'Unavailable' }, { status: 503 }), async () => { throw Error('Network unavailable'); }]) {
    const failed = buttonHarness({ response }); await find(failed.render(), node => node.type === 'button').props.onClick();
    assert.equal(failed.destinations.length, 0); assert.ok(find(failed.render(), node => node.props.role === 'alert')); assert.equal(find(failed.render(), node => node.type === 'button').props.disabled, false);
  }
});

await test('actual purchase button rejects unsafe checkout destinations', async () => {
  for (const url of ['javascript:alert(1)', 'http://checkout.stripe.com/unsafe', 'https://attacker.example.test/fake',
    'https://user:pass@checkout.stripe.com/unsafe', 'https://checkout.stripe.com:444/unsafe']) {
    const ui = buttonHarness({ response: async () => Response.json({ url }) }); await find(ui.render(), node => node.type === 'button').props.onClick();
    assert.equal(ui.destinations.length, 0); assert.ok(find(ui.render(), node => node.props.role === 'alert'));
  }
});

await test('actual storefront keeps live digital holds closed and marks sandbox digital purchases as account-required', async () => {
  const jsx = (type, props) => ({ type, props });
  const machine = { id: machineId, slug: 'test-store', title: 'Synthetic storefront', subtitle: '', theme: 'pink', assistant_enabled: false,
    business: { id: businessId, category: 'Testing', name: 'Synthetic business', description: '', plan: 'pro', verified: false },
    offers: [ { id: offerId, name: 'Digital file', offer_type: 'digital_product', fulfillment_type: 'digital', price_cents: 1299 },
      { id: foreignId, name: 'Digital fulfilment', offer_type: 'physical_product', fulfillment_type: 'digital', price_cents: 1299 },
      { id: 'service', name: 'Service', offer_type: 'service', price_cents: 1299 },
      { id: 'subscription', name: 'Subscription', offer_type: 'subscription', price_cents: 1299 } ] };
  for (const [allowed, demo] of [[false, false], [true, false], [true, true]]) {
    const page = evaluate('app/machine/[slug]/page.tsx', {
      'next/link': { default: 'Link' }, 'next/navigation': { notFound() { throw Error('Unexpected missing machine'); } },
      'react/jsx-runtime': { jsx, jsxs: jsx }, '@/components/MarketplaceCheckoutButton': { MarketplaceCheckoutButton: 'Checkout' },
      '@/lib/cqa-launch-gate': { isCqaDigitalCheckoutAllowed: () => allowed },
      '@/lib/cqa-marketplace': { DEMO_MACHINES: [], formatAud: originalMarket.formatAud, getPublicSupabaseClient: () => ({
        from() { const q = { select() { return q; }, eq() { return q; }, single: async () => ({ data: { ...machine, demo }, error: null }) }; return q; },
      }) },
    }).default;
    const tree = await page({ params: Promise.resolve({ slug: 'test-store' }) });
    const digital = find(tree, node => node.type === 'Checkout' && node.props.offerId === offerId);
    const alternate = find(tree, node => node.type === 'Checkout' && node.props.offerId === foreignId);
    if (allowed && !demo) { assert.equal(digital.props.requiresBuyerAccount, true); assert.equal(alternate.props.requiresBuyerAccount, true); }
    else { assert.equal(digital, undefined); assert.equal(alternate, undefined); }
    assert.equal(Boolean(find(tree, node => node.type === 'Checkout' && node.props.offerId === 'subscription')), !demo);
    assert.equal(Boolean(find(tree, node => node.type === 'Checkout' && node.props.offerId === 'service')), !demo);
    if (!allowed) assert.ok(find(tree, node => node.type === 'button' && node.props.disabled && /DELIVERY SETUP PENDING/.test(textOf(node))));
  }
});

await test('public success page points to authenticated purchases without claiming verified payment', async () => {
  const jsx = (type, props) => ({ type, props });
  const page = evaluate('app/checkout/success/page.tsx', { 'next/link': { default: 'Link' }, 'react/jsx-runtime': { jsx, jsxs: jsx } }).default;
  const tree = await page({ searchParams: Promise.resolve({ marketplace: '1', session_id: 'arbitrary-unverified' }) });
  assert.ok(find(tree, node => node.type === 'Link' && node.props.href === '/marketplace/library'));
  assert.doesNotMatch(textOf(tree), /payment (?:has been |is )?verified|payment confirmed|purchase complete|download ready/i);
  assert.match(textOf(tree), /confirm|pending|processing/i);
});
