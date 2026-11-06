import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function evaluate(path, mocks = {}, context = {}) {
  const output = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(context), output)(id => Object.hasOwn(mocks, id) ? mocks[id] : require(id), module, module.exports, ...Object.values(context));
  return module.exports;
}

const assets = evaluate('lib/cqa-marketplace-assets.ts');
const owner = 'owner-A';
const businessId = '00000000-0000-4000-8000-000000000001';
const machineId = '00000000-0000-4000-8000-000000000002';
const offerId = '00000000-0000-4000-8000-000000000003';
const foreignBusiness = '00000000-0000-4000-8000-000000000004';
const foreignOffer = '00000000-0000-4000-8000-000000000005';
const serviceId = '00000000-0000-4000-8000-000000000006';
const pdf = new TextEncoder().encode('%PDF-1.7\nCQA test document\n%%EOF');

function harness(options = {}) {
  const existing = { deliveryDescription: 'Deliver the PDF', supportDetails: 'Contact the owner' };
  const rows = {
    cqa_businesses: [{ id: businessId, owner_id: owner }, { id: foreignBusiness, owner_id: 'owner-B' }],
    cqa_machines: [{ id: machineId, business_id: options.foreignMachine ? foreignBusiness : businessId }],
    cqa_offers: [
      { id: offerId, name: 'Owner PDF', business_id: businessId, machine_id: machineId,
        offer_type: options.notDigital ? 'service' : 'digital_product', fulfillment_type: options.notDigital ? 'service' : 'digital', active: true,
        fulfillment_config: options.existingAsset ? { ...existing, asset_key: `marketplace/${businessId}/${offerId}/existing.pdf` } : { ...existing } },
      { id: foreignOffer, name: 'Other tenant secret product', business_id: foreignBusiness, machine_id: 'foreign-machine',
        offer_type: 'digital_product', fulfillment_type: 'digital', active: true,
        fulfillment_config: { asset_key: 'private-other-tenant-key' } },
      { id: serviceId, name: 'Owner service', business_id: businessId, machine_id: machineId,
        offer_type: 'service', fulfillment_type: 'service', active: true, fulfillment_config: {} },
    ],
    cqa_orders: options.paidOrders ? [{ id: 'order', offer_id: offerId, business_id: businessId, status: 'paid' }] : [],
  };
  const queries = [], uploads = [], updates = [];
  const admin = { from(table) {
    const filters = []; let update;
    const record = { table, filters }; queries.push(record);
    const query = {
      select() { return query; },
      eq(key, value) { filters.push(['eq', key, value]); return query; },
      in(key, values) { filters.push(['in', key, values]); return query; },
      is(key, value) { filters.push(['eq', key, value]); return query; },
      order() { return query; }, limit() { return query; },
      or(value) { filters.push(['or', value]); return query; },
      update(value) {
        update = value; updates.push({ table, value, filters });
        if (options.concurrentWrite) rows.cqa_offers[0].fulfillment_config = { concurrentlyChanged: true };
        return query;
      },
      async maybeSingle() { return result(true); },
      async single() { return result(true); },
      then(resolve, reject) { return Promise.resolve(result(false)).then(resolve, reject); },
    };
    function result(single) {
      if (options.databaseError || (update && options.saveError)) return { data: null, error: new Error('private-provider-failure') };
      let data = (rows[table] || []).filter(row => filters.every(([kind, key, value]) => {
        if (kind === 'in') return value.includes(row[key]);
        if (kind === 'or') return key.split(',').some(condition => {
          const [field, operator, expected] = condition.split('.');
          return operator === 'eq' && row[field] === expected;
        });
        if (key === 'fulfillment_config' && typeof value === 'string') return JSON.stringify(row[key]) === value;
        return row[key] === value;
      }));
      if (update) data.forEach(row => Object.assign(row, structuredClone(update)));
      data = structuredClone(data);
      return { data: single ? (data[0] || null) : data, error: null };
    }
    return query;
  } };
  const route = evaluate('app/api/owner/marketplace-asset/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/cqa-marketplace-assets': assets,
    '@/lib/cqa-marketplace': { getPublicSupabaseClient: () => ({ auth: { getUser: async token => {
      if (options.providerError) throw new Error('private-auth-provider-detail');
      if (options.badToken || token !== 'valid-token') return { data: { user: null }, error: new Error('invalid') };
      return { data: { user: { id: owner, email_confirmed_at: options.unverified ? null : '2026-10-30' } }, error: null };
    } } }) },
    '@/lib/cqa-supabase-admin': { getCqaSupabaseAdmin: () => admin },
    '@/lib/storage': { uploadPrivateMarketplaceAsset: async (key, bytes, contentType) => {
      uploads.push({ key, bytes, contentType });
      if (options.storageError) throw new Error('private-storage-provider-detail');
    } },
  });
  return { ...route, rows, queries, uploads, updates, existing };
}

function uploadRequest(options = {}) {
  const form = new FormData();
  form.set('offerId', options.offerId ?? offerId);
  if (!options.noFile) form.set('file', new File([options.bytes ?? pdf], options.filename ?? 'customer-product.pdf', { type: options.type ?? 'application/pdf' }));
  const headers = { ...(options.noAuth ? {} : { authorization: 'Bearer valid-token' }), ...options.headers };
  return new Request('https://cqa.test/api/owner/marketplace-asset', { method: 'POST', body: form, headers });
}
const getRequest = () => new Request('https://cqa.test/api/owner/marketplace-asset', { headers: { authorization: 'Bearer valid-token' } });

const normal = harness();
const response = await normal.POST(uploadRequest());
assert.equal(response.status, 200, 'genuine owner upload succeeds');
assert.match(response.headers.get('cache-control'), /\bno-store\b/);
assert.deepEqual(await response.json(), { uploaded: true, offerId });
assert.equal(normal.uploads.length, 1);
assert.match(normal.uploads[0].key, new RegExp(`^marketplace/${businessId}/${offerId}/[a-f0-9-]+\\.pdf$`));
assert.deepEqual(normal.uploads[0].bytes, pdf);
assert.equal(normal.uploads[0].contentType, 'application/pdf');
assert.equal(normal.rows.cqa_offers[0].fulfillment_config.deliveryDescription, normal.existing.deliveryDescription);
assert.equal(normal.rows.cqa_offers[0].fulfillment_config.supportDetails, normal.existing.supportDetails);
assert.equal(normal.rows.cqa_offers[0].fulfillment_config.asset_key, normal.uploads[0].key);
assert.ok(normal.updates[0].filters.some(([kind, key, value]) => kind === 'eq' && key === 'business_id' && value === businessId));
assert.ok(normal.updates[0].filters.some(([kind, key, value]) => kind === 'eq' && key === 'id' && value === offerId));
assert.ok(normal.updates[0].filters.some(([kind, key]) => kind === 'eq' && key === 'fulfillment_config'), 'metadata attach is conditional');
console.log('PASS real owner upload writes private tenant key and conditionally persists metadata without losing delivery details');

const cases = [
  { name: 'missing login', request: { noAuth: true }, status: 401 },
  { name: 'invalid token', server: { badToken: true }, status: 401 },
  { name: 'unverified owner', server: { unverified: true }, status: 401 },
  { name: 'foreign owner', request: { offerId: foreignOffer }, status: 404 },
  { name: 'foreign machine', server: { foreignMachine: true }, status: 404 },
  { name: 'nondigital product', server: { notDigital: true }, status: 404 },
  { name: 'paid order prevents changing delivery', server: { paidOrders: true }, status: 409 },
  { name: 'attached asset is immutable', server: { existingAsset: true }, status: 409 },
  { name: 'invalid offer ID', request: { offerId: 'not-a-uuid' }, status: 400 },
  { name: 'missing file', request: { noFile: true }, status: 400 },
  { name: 'spoofed PDF MIME', request: { bytes: new TextEncoder().encode('not a PDF') }, status: 400 },
  { name: 'unsupported type', request: { type: 'text/html' }, status: 400 },
  { name: 'empty file', request: { bytes: new Uint8Array() }, status: 400 },
  { name: 'oversized file', request: { bytes: new Uint8Array(assets.MAX_MARKETPLACE_ASSET_BYTES + 1) }, status: 413 },
  { name: 'oversized declared body', request: { headers: { 'content-length': String(assets.MAX_MARKETPLACE_UPLOAD_BODY_BYTES + 1) } }, status: 413 },
  { name: 'auth provider failure', server: { providerError: true }, status: 503 },
  { name: 'database failure', server: { databaseError: true }, status: 503 },
  { name: 'private storage failure', server: { storageError: true }, status: 503, uploaded: 1 },
  { name: 'metadata save failure', server: { saveError: true }, status: 503, uploaded: 1 },
  { name: 'concurrent attachment conflict', server: { concurrentWrite: true }, status: 409, uploaded: 1 },
];
for (const scenario of cases) {
  const run = harness(scenario.server);
  const result = await run.POST(uploadRequest(scenario.request));
  assert.equal(result.status, scenario.status, scenario.name);
  const body = await result.json();
  assert.notEqual(body.uploaded, true, scenario.name + ' must not report success');
  assert.doesNotMatch(JSON.stringify(body), /private-(?:auth|storage|provider)|asset_key|private-other-tenant-key/);
  assert.equal(run.uploads.length, scenario.uploaded || 0, scenario.name + ' storage call count');
  console.log('PASS ' + scenario.name);
}

const list = harness({ existingAsset: true });
const listing = await list.GET(getRequest());
assert.equal(listing.status, 200);
assert.match(listing.headers.get('cache-control'), /\bno-store\b/);
const listed = await listing.json();
assert.deepEqual(listed.offers, [{ id: offerId, name: 'Owner PDF', hasFile: true }]);
assert.doesNotMatch(JSON.stringify(listed), /asset_key|private-other-tenant-key|Other tenant|supportDetails|deliveryDescription/);
assert.ok(list.queries.some(query => query.table === 'cqa_businesses' && query.filters.some(([, key, value]) => key === 'owner_id' && value === owner)), 'business ownership is queried');
for (const options of [{ badToken: true }, { unverified: true }, { providerError: true }]) {
  const run = harness(options);
  const result = await run.GET(getRequest());
  assert.equal(result.status, options.providerError ? 503 : 401);
}
console.log('PASS owner product picker is authenticated, tenant-filtered and returns no private delivery configuration');

for (const [type, bytes, extension, storedType] of [
  ['application/x-zip-compressed', new Uint8Array([80,75,5,6,...new Uint8Array(18)]), 'zip', 'application/zip'],
  ['image/jpg', new Uint8Array([255,216,255,224]), 'jpg', 'image/jpeg'],
]) {
  const run = harness();
  assert.equal((await run.POST(uploadRequest({ type, bytes }))).status, 200);
  assert.equal(run.uploads[0].contentType, storedType);
  assert.ok(run.uploads[0].key.endsWith('.' + extension));
}
assert.equal((await harness().GET(new Request('https://cqa.test/api/owner/marketplace-asset'))).status, 401);
console.log('PASS browser MIME aliases are normalised and anonymous product-list access is denied');

for (const [bytes, type] of [
  [pdf, 'application/pdf'],
  [new Uint8Array([137,80,78,71,13,10,26,10,0]), 'image/png'],
  [new Uint8Array([255,216,255,224]), 'image/jpeg'],
  [new Uint8Array([80,75,5,6,...new Uint8Array(18)]), 'application/zip'],
  [new TextEncoder().encode('CQA plain text product ✓'), 'text/plain'],
]) assert.equal(assets.validateMarketplaceAsset(bytes, type), true, type + ' recognised content');
for (const [bytes, type] of [
  [new Uint8Array(), 'application/pdf'],
  [new TextEncoder().encode('<html>spoof</html>'), 'application/pdf'],
  [pdf, 'image/png'],
  [new Uint8Array([0,1,2]), 'text/plain'],
  [new Uint8Array([255,255]), 'text/plain'],
  [pdf, 'application/x-msdownload'],
]) assert.equal(assets.validateMarketplaceAsset(bytes, type), false, type + ' rejects invalid content');
assert.equal(assets.validateMarketplaceAsset(new Uint8Array(assets.MAX_MARKETPLACE_ASSET_BYTES).fill(65), 'text/plain'), true);
assert.equal(assets.validateMarketplaceAsset(new Uint8Array(assets.MAX_MARKETPLACE_ASSET_BYTES + 1).fill(65), 'text/plain'), false);
console.log('PASS file signatures, text validity, empty files and exact 4 MiB boundary');

let sent = false;
const streamed = new Request('https://cqa.test/api/owner/marketplace-asset', {
  method: 'POST', duplex: 'half', headers: { 'content-type': 'multipart/form-data; boundary=cqa', authorization: 'Bearer valid-token' },
  body: new ReadableStream({ pull(controller) {
    if (sent) { controller.close(); return; }
    sent = true; controller.enqueue(new Uint8Array(assets.MAX_MARKETPLACE_UPLOAD_BODY_BYTES + 1));
  } }),
});
const streamRun = harness();
assert.equal((await streamRun.POST(streamed)).status, 413);
assert.equal(streamRun.uploads.length, 0);
const malformed = new Request('https://cqa.test/api/owner/marketplace-asset', { method: 'POST', headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' }, body: '{}' });
assert.equal((await harness().POST(malformed)).status, 400);
console.log('PASS chunked body limit and malformed multipart fail before any storage write');

const storageCalls = [];
class Command { constructor(input) { this.input = input; } }
const storage = evaluate('lib/storage.ts', {
  '@/lib/cqa-marketplace-assets': assets,
  '@aws-sdk/client-s3': { GetObjectCommand: Command, PutObjectCommand: Command,
    S3Client: class { async send(command) { storageCalls.push(command.input); return {}; } } },
  '@aws-sdk/s3-request-presigner': { getSignedUrl: async () => { throw new Error('Upload must not create a public or signed URL'); } },
}, { process: { env: { R2_ACCOUNT_ID: 'test-account', R2_ACCESS_KEY_ID: 'test-key', R2_SECRET_ACCESS_KEY: 'test-secret', R2_BUCKET: 'private-test-bucket' } } });
await storage.uploadPrivateMarketplaceAsset(`marketplace/${businessId}/${offerId}/test.pdf`, pdf, 'application/pdf');
assert.equal(storageCalls.length, 1);
assert.equal(storageCalls[0].Bucket, 'private-test-bucket');
assert.equal(storageCalls[0].CacheControl, 'private, no-store');
assert.equal(storageCalls[0].ContentDisposition, 'attachment');
assert.equal(storageCalls[0].ACL, undefined);
console.log('PASS actual storage helper writes configured bucket as private attachment without creating a URL');

function findNode(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (predicate(node)) return node;
  for (const child of [].concat(node.props?.children || [])) {
    const result = findNode(child, predicate); if (result) return result;
  }
}
const flushUI = async () => { await new Promise(resolve => setImmediate(resolve)); };
function uiHarness(options = {}) {
  const selectedFile = options.file ?? new File([pdf], 'product.pdf', { type: 'application/pdf' });
  const state = options.mount ? [] : [[{ id: offerId, name: 'Owner PDF', hasFile: !!options.attached }], options.foreignSelection ? foreignOffer : offerId, selectedFile, false, true, false, '', ''];
  const refs = []; let stateIndex = 0, refIndex = 0, effect;
  const requests = [];
  const jsx = (type, props) => ({ type, props });
  const component = evaluate('app/owner/marketplace-upload/page.tsx', {
    react: {
      useState(initial) { const index = stateIndex++; if (!(index in state)) state[index] = initial;
        return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }]; },
      useRef(initial) { const index = refIndex++; return refs[index] ||= { current: initial }; },
      useEffect(callback) { effect = callback; },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/link': { default: 'Link' },
    '@/lib/cqa-marketplace-assets': assets,
    '@/lib/cqa-marketplace': { getBrowserSupabaseClient: () => ({ auth: { getSession: async () => ({ data: { session: options.noSession ? null : { access_token: 'test-token' } }, error: null }) } }) },
  }, {
    window: { location: { search: options.search || '' } },
    fetch: async (url, request) => {
      requests.push({ url, request });
      if (request?.method === 'POST') return options.post ? options.post(request) : Response.json({ uploaded: true, offerId });
      return Response.json({ offers: [{ id: offerId, name: 'Owner PDF', hasFile: false }] });
    },
  }).default;
  return { state, refs, requests,
    render() { stateIndex = refIndex = 0; return component(); },
    effect() { return effect(); },
  };
}
const anonymousUI = uiHarness({ mount: true, noSession: true });
anonymousUI.render(); anonymousUI.effect(); await flushUI();
assert.ok(findNode(anonymousUI.render(), node => node.type === 'Link' && node.props.href.startsWith('/login?')));
assert.equal(findNode(anonymousUI.render(), node => node.type === 'form'), undefined);
assert.equal(anonymousUI.requests.length, 0);
const ownedPickerUI = uiHarness({ mount: true, search: '?offerId=' + foreignOffer });
ownedPickerUI.render(); ownedPickerUI.effect(); await flushUI();
assert.equal(findNode(ownedPickerUI.render(), node => node.type === 'select').props.value, offerId);
assert.equal(findNode(ownedPickerUI.render(), node => node.type === 'input' && node.props.type !== 'file'), undefined);
console.log('PASS real upload page requires a session and selects only loaded owned products, ignoring an arbitrary URL offer ID');

for (const options of [
  { file: new File([new Uint8Array(assets.MAX_MARKETPLACE_ASSET_BYTES + 1)], 'large.pdf', { type: 'application/pdf' }) },
  { noSession: true }, { foreignSelection: true }, { attached: true },
]) {
  const ui = uiHarness(options);
  await findNode(ui.render(), node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(ui.requests.length, 0);
  assert.ok(findNode(ui.render(), node => node.props.role === 'alert'));
}
console.log('PASS real upload form rejects oversized files, expired sessions, unloaded products and attached-file replacement before any upload');

for (const post of [
  async () => Response.json({}),
  async () => Response.json({ uploaded: true, offerId: foreignOffer }),
  async () => new Response('not-json'),
  async () => Response.json({ error: 'Save failed' }, { status: 503 }),
]) {
  const ui = uiHarness({ post });
  await findNode(ui.render(), node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.ok(findNode(ui.render(), node => node.props.role === 'alert'));
  assert.equal(ui.state[6], '', 'unconfirmed response has no success message');
  assert.equal(ui.state[0][0].hasFile, false);
  assert.notEqual(ui.state[2], null);
}
console.log('PASS genuine upload form rejects malformed, false-success, wrong-product and failed server responses');

let resolveUpload;
const duplicateUI = uiHarness({ post: () => new Promise(resolve => { resolveUpload = resolve; }) });
const submit = findNode(duplicateUI.render(), node => node.type === 'form').props.onSubmit;
duplicateUI.refs[0].current = { value: 'product.pdf' };
const firstSubmit = submit({ preventDefault() {} });
await submit({ preventDefault() {} }); await flushUI();
assert.equal(duplicateUI.requests.length, 1, 'same-frame duplicate submits send one request');
resolveUpload(Response.json({ uploaded: true, offerId })); await firstSubmit;
assert.equal(duplicateUI.state[0][0].hasFile, true);
assert.equal(duplicateUI.state[2], null);
assert.equal(duplicateUI.refs[0].current.value, '');
assert.match(duplicateUI.state[6], /saved privately/);
assert.equal(findNode(duplicateUI.render(), node => node.type === 'button'), undefined);
console.log('PASS real form sends one upload for duplicate submit, then clears file and marks the product attached');
