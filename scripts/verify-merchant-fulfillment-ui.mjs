import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

// Intercepted local UI evidence only: this does not exercise real payments,
// storage, carrier systems or database permissions. Backend/SQL tests do that.
const baseURL = new URL(process.env.CQA_UI_BASE_URL || 'http://127.0.0.1:3100');
if (baseURL.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(baseURL.hostname)) throw new Error('Run intercepted browser QA only on a local HTTP server.');
const output = path.resolve('work/merchant-fulfillment-ui');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CQA_UI_BROWSER_EXECUTABLE, headless: true, args: ['--no-sandbox'] });
const businessId = '10000000-0000-4000-8000-000000000010';
const machineId = '10000000-0000-4000-8000-000000000020';
const orderId = '10000000-0000-4000-8000-000000000040';
const productId = '10000000-0000-4000-8000-000000000030';
const now = new Date().toISOString();
const products = [];
const writes = [];
let shipment = { orderId, status: 'ready', recipientName: 'QA Customer', address: { line1: '1 Fixture Street', line2: '', city: 'Sydney', state: 'NSW', postal_code: '2000', country: 'AU' }, carrier: null, trackingNumber: null, trackingUrl: null, dispatchedAt: null, deliveredAt: null, revision: 0 };
const workspace = { state: 'awaiting_intake', intake: null, deliveryMessage: null, hasAsset: false, assetName: null, revision: 0, updatedAt: now };
const buyerOrder = { id: orderId, title: 'QA Physical Kit', businessName: 'QA Merchant', businessId, machineSlug: 'qa-machine', offerType: 'physical_product', fulfillmentType: 'shipping', paymentStatus: 'paid', amountCents: 2900, currency: 'aud', createdAt: now, workspace };
const ownerOrder = { id: orderId, offerName: buyerOrder.title, status: 'paid', amountCents: 2900, currency: 'aud', createdAt: now, customerEmail: 'qa@example.test', offerType: 'physical_product', fulfillmentType: 'shipping', digital: false, workspace: { ...workspace, intake: {} } };
const pageErrors = [];
async function contextFor(owner) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(({ owner }) => {
    if (sessionStorage.getItem('qa-seeded')) return;
    const userId = owner ? '10000000-0000-4000-8000-000000000001' : '10000000-0000-4000-8000-000000000002';
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const encode = value => btoa(JSON.stringify(value)).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
    const token = encode({ alg: 'HS256', typ: 'JWT' }) + '.' + encode({ sub: userId, aud: 'authenticated', role: 'authenticated', exp }) + '.qa-fixture-signature';
    const user = { id: userId, email: 'qa@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString(), email_confirmed_at: new Date().toISOString() };
    localStorage.setItem('sb-portal-qa-fixture-auth-token', JSON.stringify({ access_token: token, refresh_token: 'qa-fixture-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp, user }));
    sessionStorage.setItem('qa-seeded', '1');
  }, { owner });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'portal-qa-fixture.supabase.co') return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) return route.abort();
    const pathname = url.pathname;
    const send = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    if (pathname === '/api/owner/readiness') return send({ merchantReady: true, checks: [], globalCheckoutHeld: true, digitalCheckoutHeld: true, physicalCheckoutHeld: true });
    if (pathname === '/api/owner/products') {
      if (route.request().method() === 'POST') {
        const payload = route.request().postDataJSON(); writes.push(payload);
        assert.equal(payload.kind, 'physical'); assert.equal(payload.priceCents, 2900); assert.equal(payload.shipping.flatFeeCents, 750); assert.deepEqual(payload.shipping.supportedRegions, ['AU', 'NZ']);
        const previous = products.find(product => product.id === payload.id);
        if (previous) assert.equal(payload.expectedRevision, previous.product_revision);
        const product = { id: previous?.id || productId, machine_id: machineId, name: payload.name, description: payload.description, price_cents: payload.priceCents, currency: 'aud', offer_type: 'physical_product', fulfillment_type: 'shipping', image_url: null, active: payload.active, inventory_tracking: true, inventory_quantity: (previous?.inventory_quantity || 0) + payload.inventoryDelta, reserved_quantity: 0, available_quantity: (previous?.inventory_quantity || 0) + payload.inventoryDelta, product_revision: (previous?.product_revision || 0) + 1, assetReady: false, fulfillment_config: { shipping: payload.shipping, deliveryDescription: payload.deliveryDescription, deliveryTiming: payload.deliveryTiming, supportDetails: payload.supportDetails, refundTerms: payload.refundTerms } };
        if (previous) products.splice(products.indexOf(previous), 1, product); else products.push(product);
        return send({ product });
      }
      return send({ business: { id: businessId, name: 'QA Merchant' }, machines: [{ id: machineId, name: 'QA Machine' }], products });
    }
    if (pathname.endsWith('/shipment')) {
      if (route.request().method() === 'POST') {
        assert.equal(owner, true);
        const payload = route.request().postDataJSON(); assert.equal(payload.expectedRevision, shipment.revision);
        const state = { pack: 'packing', ship: 'shipped', deliver: 'delivered' }[payload.action]; assert.ok(state);
        if (payload.action === 'ship') { assert.equal(payload.carrier, 'Australia Post'); assert.equal(payload.trackingNumber, 'QA123456'); assert.equal(payload.trackingUrl, 'https://auspost.com.au/track/QA123456'); }
        shipment = { ...shipment, status: state, revision: shipment.revision + 1, ...(payload.action === 'ship' ? { carrier: payload.carrier, trackingNumber: payload.trackingNumber, trackingUrl: payload.trackingUrl, dispatchedAt: now } : {}), ...(payload.action === 'deliver' ? { deliveredAt: now } : {}) };
        return send({ updated: true, shipment });
      }
      return send({ shipment });
    }
    if (pathname === '/api/owner/orders') return send({ business: { id: businessId, name: 'QA Merchant' }, orders: [ownerOrder], hasMore: false, page: 0 });
    if (pathname.startsWith('/api/owner/orders/')) return send({ order: ownerOrder, events: [] });
    if (pathname.startsWith('/api/customer/orders/')) return send({ order: buyerOrder, events: [] });
    return route.continue();
  });
  return context;
}
async function noOverflow(page, label) { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, label); }
try {
  const ownerContext = await contextFor(true); const merchant = await ownerContext.newPage(); merchant.on('pageerror', error => pageErrors.push(error.message));
  await merchant.goto(new URL('/owner/products', baseURL).href, { waitUntil: 'networkidle' });
  await merchant.getByLabel('Product name', { exact: true }).fill('QA Physical Kit');
  await merchant.getByLabel('Product type', { exact: true }).selectOption('physical');
  await merchant.getByLabel('Price · AUD', { exact: true }).fill('29.00');
  await merchant.getByLabel('Opening stock', { exact: false }).fill('12');
  await merchant.getByLabel('Countries you ship to', { exact: false }).fill('AU, NZ');
  await merchant.getByLabel('Flat shipping fee · AUD', { exact: true }).fill('7.50');
  await merchant.getByLabel('Dispatch timing', { exact: true }).fill('Within 2 business days');
  await merchant.getByRole('button', { name: 'Create product', exact: true }).click();
  await merchant.getByRole('button', { name: 'Edit QA Physical Kit', exact: true }).waitFor();
  assert.equal(products[0].inventory_quantity, 12);
  await merchant.getByRole('button', { name: 'Edit QA Physical Kit', exact: true }).click();
  assert.equal(await merchant.getByLabel('Product type', { exact: true }).isDisabled(), true);
  await merchant.getByLabel('Stock adjustment', { exact: false }).fill('3');
  await merchant.getByRole('button', { name: 'Save changes', exact: true }).click();
  await merchant.getByRole('button', { name: 'Edit QA Physical Kit', exact: true }).waitFor();
  await merchant.getByText('Product saved. Refreshing the catalogue to confirm its current stock and delivery settings.', { exact: true }).waitFor();
  await merchant.getByRole('button', { name: 'Create product', exact: true }).waitFor();
  assert.equal(writes.length, 2); assert.equal(writes[1].inventoryDelta, 3); assert.equal(products[0].inventory_quantity, 15);
  await noOverflow(merchant, 'desktop product overflow');
  await merchant.setViewportSize({ width: 390, height: 844 }); await noOverflow(merchant, 'mobile product overflow');
  await merchant.screenshot({ path: path.join(output, 'products-mobile.png'), fullPage: true });
  await merchant.goto(new URL('/owner/orders', baseURL).href, { waitUntil: 'networkidle' });
  await merchant.getByRole('button').filter({ hasText: 'QA Physical Kit' }).click();
  await merchant.getByRole('button', { name: 'Start packing', exact: true }).click();
  await merchant.getByText('Being packed by the merchant', { exact: true }).waitFor();
  assert.equal(await merchant.getByRole('button', { name: 'Start work', exact: true }).count(), 0);
  await merchant.getByLabel('Carrier', { exact: true }).fill('Australia Post');
  await merchant.getByLabel('Tracking number', { exact: true }).fill('QA123456');
  await merchant.getByLabel('Carrier tracking URL', { exact: false }).fill('https://auspost.com.au/track/QA123456');
  await merchant.getByLabel('I have handed this parcel', { exact: false }).check();
  await merchant.getByRole('button', { name: 'Confirm dispatch', exact: true }).click();
  await merchant.getByText('Dispatched by the merchant', { exact: true }).waitFor(); await noOverflow(merchant, 'mobile owner dispatch overflow');
  const buyerContext = await contextFor(false); const buyer = await buyerContext.newPage(); buyer.on('pageerror', error => pageErrors.push(error.message));
  await buyer.goto(new URL(`/account/orders/${orderId}`, baseURL).href, { waitUntil: 'networkidle' });
  await buyer.getByRole('heading', { name: 'Delivery tracking', exact: true }).waitFor();
  assert.equal(await buyer.getByRole('link', { name: 'Open carrier tracking ↗', exact: true }).getAttribute('href'), 'https://auspost.com.au/track/QA123456');
  assert.equal(await buyer.getByRole('button', { name: 'Confirm dispatch', exact: true }).count(), 0);
  assert.equal(await buyer.getByLabel('Business or project name', { exact: false }).count(), 0);
  await buyer.setViewportSize({ width: 390, height: 844 }); await noOverflow(buyer, 'mobile buyer tracking overflow');
  await buyer.screenshot({ path: path.join(output, 'buyer-tracking-mobile.png'), fullPage: true });
  await merchant.getByLabel('I have verified delivery', { exact: false }).check();
  await merchant.getByRole('button', { name: 'Mark delivery complete', exact: true }).click();
  await merchant.getByText('Delivery marked complete by merchant', { exact: true }).waitFor();
  await buyer.reload({ waitUntil: 'networkidle' }); await buyer.getByText('Delivery marked complete by merchant', { exact: true }).waitFor();
  assert.equal(shipment.revision, 3); assert.deepEqual(pageErrors, []);
  console.log('PASS local intercepted products create/edit stock and shipping fee contracts; physical packing→dispatch→buyer tracking→merchant-confirmed delivery; mobile overflow and no service intake for physical products.');
  await ownerContext.close(); await buyerContext.close();
} finally { await browser.close(); }
