import 'server-only';
import { isCqaPhysicalPilotEnabled } from './cqa-launch-gate';

export type SupplierAddress = {
  name: string;
  line1: string;
  line2?: string | null;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  phone?: string | null;
};

export type SupplierQuote = {
  variantId: string;
  stock: number;
  currency: 'aud' | 'usd';
  unitCost: number;
  shippingCost: number;
  totalCost: number;
  shippingMethod: string;
  estimatedDelivery: string | null;
};

export type SupplierSubmission = { supplierReference: string };
export type SupplierTracking = {
  status: 'processing' | 'shipped' | 'delivered' | 'cancelled';
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrier: string | null;
  supplierPaymentStatus: 'unpaid' | 'paid' | 'unknown';
};
type QuoteRequest = {
  sku: string;
  quantity: number;
  address: Pick<SupplierAddress, 'countryCode'> & Partial<SupplierAddress>;
};
type SubmitRequest = { sku: string; quantity: number; address: SupplierAddress; quote: SupplierQuote; reference: string };
export interface SupplierAdapter {
  quote(input: QuoteRequest): Promise<SupplierQuote>;
  submit(input: SubmitRequest): Promise<SupplierSubmission>;
  reconcile(reference: string): Promise<SupplierSubmission | null>;
  track(reference: string): Promise<SupplierTracking>;
}

const cjBase = 'https://developers.cjdropshipping.com/api2.0/v1';
const origin = 'CN';
type CjToken = { value: string; expiresAt: number; refreshToken: string | null; refreshExpiresAt: number };
let cachedToken: CjToken | undefined;
let tokenRequest: Promise<string> | undefined;

class CjError extends Error {
  constructor(readonly providerCode: number | null = null, readonly orderNotFound = false) {
    super('CJdropshipping request did not complete successfully.');
  }
}

async function cjRequest(path: string, token?: string, body?: object): Promise<unknown> {
  try {
    const response = await fetch(cjBase + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(token ? { 'CJ-Access-Token': token } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await response.json();
    if (!response.ok || payload?.result !== true || payload.code !== 200) {
      if (payload?.code === 1600001 && cachedToken && cachedToken.value === token) {
        cachedToken = { ...cachedToken, expiresAt: 0 };
      }
      const orderNotFound = path.startsWith('/shopping/order/getOrderDetail?') &&
        (payload?.code === 1603100 ||
          (payload?.code === 1600300 && payload?.message === 'order not found'));
      throw new CjError(Number.isInteger(payload?.code) ? payload.code : null, orderNotFound);
    }
    return payload.data;
  } catch (error) {
    if (error instanceof CjError) throw error;
    throw new CjError();
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new CjError();
  return value as Record<string, unknown>;
}

function nonempty(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function minorAmount(value: unknown): number {
  if (typeof value !== 'number' && typeof value !== 'string') throw new CjError();
  const decimal = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(decimal)) throw new CjError();
  const [whole, fraction = ''] = decimal.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount)) throw new CjError();
  return amount;
}

function hasFreshToken(expiry: number): boolean {
  return expiry > Date.now() + 60_000;
}

async function obtainCjToken(): Promise<string> {
  const apiKey = process.env.CQA_CJ_API_KEY;
  if (!apiKey) throw new Error('CJdropshipping is not configured.');
  const refreshToken = cachedToken?.refreshToken;
  const shouldRefresh = refreshToken && cachedToken && hasFreshToken(cachedToken.refreshExpiresAt);
  let data: unknown;
  try {
    data = shouldRefresh
      ? await cjRequest('/authentication/refreshAccessToken', undefined, { refreshToken })
      : await cjRequest('/authentication/getAccessToken', undefined, { apiKey });
  } catch (error) {
    if (!shouldRefresh || !(error instanceof CjError) || error.providerCode !== 1600003) throw error;
    data = await cjRequest('/authentication/getAccessToken', undefined, { apiKey });
  }
  const payload = record(data);
  const value = nonempty(payload.accessToken);
  const expiresAt = Date.parse(String(payload.accessTokenExpiryDate));
  if (!value || !hasFreshToken(expiresAt)) throw new CjError();
  cachedToken = {
    value, expiresAt,
    refreshToken: nonempty(payload.refreshToken),
    refreshExpiresAt: Date.parse(String(payload.refreshTokenExpiryDate)),
  };
  return value;
}

async function cjToken(): Promise<string> {
  if (cachedToken && hasFreshToken(cachedToken.expiresAt)) return cachedToken.value;
  tokenRequest ??= obtainCjToken().finally(() => { tokenRequest = undefined; });
  return tokenRequest;
}

function assertCjReference(reference: string) {
  if (!/^[A-Za-z0-9_-]{1,50}$/.test(reference)) throw new CjError();
}

async function findCjOrder(reference: string): Promise<Record<string, unknown> | null> {
  assertCjReference(reference);
  try {
    const query = new URLSearchParams({ orderId: reference });
    return record(await cjRequest('/shopping/order/getOrderDetail?' + query, await cjToken()));
  } catch (error) {
    // Absence is explicit. Timeouts, malformed data, and auth failures remain ambiguous.
    if (error instanceof CjError && error.orderNotFound) return null;
    throw error;
  }
}

function cjOrderReference(data: Record<string, unknown>): SupplierSubmission {
  const supplierReference = nonempty(data.orderId);
  if (!supplierReference) throw new CjError();
  return { supplierReference };
}

function safeTrackingUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

const cjAdapter: SupplierAdapter = {
  async quote({ sku, quantity, address }) {
    const token = await cjToken();
    const query = new URLSearchParams({ variantSku: sku });
    const matches = await cjRequest('/product/variant/query?' + query, token);
    if (!Array.isArray(matches)) throw new CjError();
    const variant = record(matches.find(item => record(item).variantSku === sku));
    const variantId = nonempty(variant.vid);
    if (!variantId || !Array.isArray(variant.inventories)) throw new CjError();
    const stock = variant.inventories.map(record)
      .filter(inventory => inventory.countryCode === origin)
      .reduce((total, inventory) => {
        const units = inventory.cjInventory;
        if (typeof units !== 'number' || !Number.isSafeInteger(units) || units < 0) throw new CjError();
        return total + units;
      }, 0);
    const unitCost = minorAmount(variant.variantSellPrice);
    const options = await cjRequest('/logistic/freightCalculate', token, {
      startCountryCode: origin,
      endCountryCode: address.countryCode,
      ...(address.postalCode ? { zip: address.postalCode } : {}),
      products: [{ quantity, vid: variantId }],
    });
    if (!Array.isArray(options)) throw new CjError();
    const methods = options.map(record).map(option => ({
      method: nonempty(option.logisticName),
      cost: minorAmount(option.totalPostageFee ?? option.logisticPrice),
      estimate: nonempty(option.logisticAging),
    })).sort((a, b) => a.cost - b.cost || (a.method || '').localeCompare(b.method || ''));
    const cheapest = methods.find(option => option.method);
    if (!cheapest?.method) throw new Error('No supplier shipping option is available.');
    return {
      variantId, stock, currency: 'usd', unitCost,
      shippingCost: cheapest.cost, totalCost: unitCost * quantity + cheapest.cost,
      shippingMethod: cheapest.method, estimatedDelivery: cheapest.estimate,
    };
  },
  async submit({ sku, quantity, address, quote, reference }) {
    assertCjReference(reference);
    if (sku.length > 50 || quote.variantId.length > 50 || quote.shippingMethod.length > 50 ||
        !Number.isSafeInteger(quantity) || quantity < 1 || !/^[A-Z]{2}$/.test(address.countryCode) ||
        !address.name || address.name.length > 50 || !address.city || address.city.length > 50 ||
        !address.region || address.region.length > 50 || !address.line1 || address.line1.length > 500 ||
        (address.line2?.length ?? 0) > 500 || address.postalCode.length > 20 ||
        (address.phone?.length ?? 0) > 20) {
      throw new Error('Shipping information exceeds the supplier limits.');
    }
    const country = new Intl.DisplayNames(['en'], { type: 'region' }).of(address.countryCode);
    const token = await cjToken();
    const order = await cjRequest('/shopping/order/createOrderV2', token, {
      orderNumber: reference,
      shippingZip: address.postalCode,
      shippingCountryCode: address.countryCode,
      shippingCountry: country,
      shippingProvince: address.region,
      shippingCity: address.city,
      shippingCustomerName: address.name,
      shippingAddress: address.line1,
      ...(address.line2 ? { shippingAddress2: address.line2 } : {}),
      ...(address.phone ? { shippingPhone: address.phone } : {}),
      fromCountryCode: origin,
      logisticName: quote.shippingMethod,
      payType: 3,
      isSandbox: 1,
      orderFlow: 1,
      products: [{ vid: quote.variantId, sku, quantity, storeLineItemId: reference }],
    });
    return cjOrderReference(record(order));
  },
  async reconcile(reference) {
    const order = await findCjOrder(reference);
    if (!order) return null;
    const lineItems = order.productList;
    const matchesExternalReference = order.orderNum === reference ||
      (Array.isArray(lineItems) && lineItems.length === 1 &&
        record(lineItems[0]).storeLineItemId === reference);
    if (!matchesExternalReference || order.isSandbox === 0) throw new CjError();
    return cjOrderReference(order);
  },
  async track(reference) {
    const order = await findCjOrder(reference);
    if (!order || cjOrderReference(order).supplierReference !== reference || order.isSandbox === 0) {
      throw new Error('Supplier order was not found.');
    }
    const status = order.orderStatus;
    return {
      status: status === 'DELIVERED' || status === 'COMPLETED' ? 'delivered'
        : status === 'SHIPPED' ? 'shipped'
        : status === 'CLOSED' || status === 'CANCELLED' ? 'cancelled' : 'processing',
      trackingNumber: nonempty(order.trackNumber),
      trackingUrl: safeTrackingUrl(order.trackingUrl),
      carrier: nonempty(order.trackingProvider) ?? nonempty(order.logisticName),
      supplierPaymentStatus: nonempty(order.paymentDate) ||
        ['PENDING', 'PROCESSING', 'UNSHIPPED', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(String(status)) ? 'paid'
        : ['CREATED', 'IN_CART', 'UNPAID'].includes(String(status)) ? 'unpaid' : 'unknown',
    };
  },
};

const submittedMockOrders = new Set<string>();
function mockValue(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(parsed)) throw new Error('Mock supplier is misconfigured.');
  return parsed;
}

const mockAdapter: SupplierAdapter = {
  async quote({ sku, quantity }) {
    const unitCost = mockValue('CQA_MOCK_SUPPLIER_UNIT_COST_CENTS', 800);
    const shippingCost = mockValue('CQA_MOCK_SUPPLIER_SHIPPING_CENTS', 600);
    return {
      variantId: sku, stock: mockValue('CQA_MOCK_SUPPLIER_STOCK', 20),
      currency: 'aud', unitCost, shippingCost, totalCost: unitCost * quantity + shippingCost,
      shippingMethod: 'Mock standard', estimatedDelivery: '3–7 business days',
    };
  },
  async submit({ reference }) {
    // Stable synthetic references make the mock side-effect idempotent even across workers.
    submittedMockOrders.add(reference);
    return { supplierReference: 'mock-' + reference };
  },
  async reconcile(reference) {
    return submittedMockOrders.has(reference) ? { supplierReference: 'mock-' + reference } : null;
  },
  async track(reference) {
    if (!reference.startsWith('mock-')) throw new Error('Supplier order was not found.');
    return {
      status: 'processing', trackingNumber: null, trackingUrl: null,
      carrier: null, supplierPaymentStatus: 'unpaid',
    };
  },
};

export function getSupplierAdapter(provider: string): SupplierAdapter {
  if (!isCqaPhysicalPilotEnabled()) throw new Error('The fulfilment pilot is disabled.');
  if (provider === 'mock') return mockAdapter;
  if (provider === 'cjdropshipping') return cjAdapter;
  throw new Error('Unsupported fulfilment provider.');
}
