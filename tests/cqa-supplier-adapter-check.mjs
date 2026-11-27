import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync('lib/cqa-supplier.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

const externalReference = '10000000-0000-4000-8000-000000000001';
const supplierReference = 'CJ123';
const address = {
  name: 'Test User', line1: '1 Test St', city: 'Adelaide', region: 'SA',
  postalCode: '5000', countryCode: 'AU', phone: '+61123456789',
};

const calls = [];
const env = { CQA_CJ_API_KEY: 'fixture-test-key' };
let enabled = false;
let lookupMode = 'success';

function reply(data, code = 200, message = 'Success') {
  return new Response(JSON.stringify({ result: code === 200, code, data, message }));
}

async function fetchFixture(url, options) {
  const request = new URL(url);
  const body = options.body && JSON.parse(options.body);
  calls.push({ request, body });
  if (request.pathname.endsWith('/getAccessToken')) {
    assert.deepEqual(body, { apiKey: 'fixture-test-key' });
    return reply({ accessToken: 'fixture-token', accessTokenExpiryDate: '2099-01-01T00:00:00+08:00' });
  }
  assert.equal(options.headers['CJ-Access-Token'], 'fixture-token');
  if (request.pathname.endsWith('/query')) {
    return reply([{
      variantSku: 'CJ-SKU', vid: 'VID', variantSellPrice: '2.81',
      inventories: [{ countryCode: 'CN', cjInventory: 5 }, { countryCode: 'AU', cjInventory: 20 }],
    }]);
  }
  if (request.pathname.endsWith('/freightCalculate')) {
    return reply([
      { logisticName: 'Better', logisticPrice: '4.29', totalPostageFee: '4.39', logisticAging: '3–7' },
      { logisticName: 'Worse', logisticPrice: 5 },
    ]);
  }
  if (request.pathname.endsWith('/createOrderV2')) return reply({ orderId: supplierReference });
  if (request.pathname.endsWith('/getOrderDetail')) {
    if (lookupMode === 'missing') return reply(null, 1600300, 'order not found');
    if (lookupMode === 'wrong') {
      return reply({ orderId: supplierReference, orderNum: 'someone-else', isSandbox: 1 });
    }
    if (lookupMode === 'unknown') return reply(null, 1600000, 'contains private buyer data');
    return reply({
      orderId: supplierReference, orderNum: externalReference, orderStatus: 'SHIPPED',
      trackingProvider: 'Carrier', trackNumber: 'TRACK', trackingUrl: 'https://example.com/track',
      isSandbox: 1,
    });
  }
  throw new Error('Unexpected fixture endpoint');
}

const moduleExports = {};
vm.runInNewContext(compiled, {
  exports: moduleExports,
  require: name => name === 'server-only' ? {} : { isCqaPhysicalPilotEnabled: () => enabled },
  fetch: fetchFixture,
  process: { env },
  AbortSignal, URL, URLSearchParams, Intl, Date,
});

const { getSupplierAdapter } = moduleExports;
assert.throws(() => getSupplierAdapter('mock'));
enabled = true;
assert.throws(() => getSupplierAdapter('no-provider'));

const mock = getSupplierAdapter('mock');
assert.equal((await mock.quote({ sku: 'mock', quantity: 1, address })).totalCost, 1400);
env.CQA_MOCK_SUPPLIER_STOCK = '1';
assert.equal((await mock.quote({ sku: 'mock', quantity: 1, address })).stock, 1);
assert.equal((await mock.submit({ reference: externalReference })).supplierReference, 'mock-' + externalReference);
assert.equal((await mock.reconcile(externalReference)).supplierReference, 'mock-' + externalReference);
assert.equal(calls.length, 0, 'The mock supplier performs no network I/O');

const cj = getSupplierAdapter('cjdropshipping');
const quote = await cj.quote({ sku: 'CJ-SKU', quantity: 2, address });
assert.equal(quote.totalCost, 1001);
assert.equal(quote.stock, 5);
assert.equal(calls[1].request.searchParams.get('variantSku'), 'CJ-SKU');
assert.deepEqual(calls[2].body, {
  startCountryCode: 'CN', endCountryCode: 'AU', zip: '5000', products: [{ quantity: 2, vid: 'VID' }],
});

const submission = await cj.submit({ sku: 'CJ-SKU', quantity: 2, address, quote, reference: externalReference });
assert.equal(submission.supplierReference, supplierReference);
assert.equal(calls[3].body.payType, 3, 'Creation must leave the supplier order unpaid');
assert.equal(calls[3].body.isSandbox, 1, 'Preview cannot create a real supplier order');
assert.equal(calls[3].body.orderNumber, externalReference);
assert.equal(calls[3].body.products[0].storeLineItemId, externalReference);
assert.equal((await cj.reconcile(externalReference)).supplierReference, supplierReference);
assert.equal((await cj.track(supplierReference)).supplierPaymentStatus, 'paid');

lookupMode = 'wrong';
await assert.rejects(cj.reconcile(externalReference));
lookupMode = 'missing';
assert.equal(await cj.reconcile(externalReference), null);
lookupMode = 'unknown';
await assert.rejects(cj.reconcile(externalReference), error => !error.message.includes('private buyer data'));

console.log('CJ request/response fixtures and mock supplier checks passed');
