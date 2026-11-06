import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = fs.readFileSync('app/marketplace/library/page.tsx', 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export default function', 'function');
const compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.ReactJSX
} }).outputText;
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function nodes(node, match) {
  if (Array.isArray(node)) return node.flatMap(item => nodes(item, match));
  if (!node || typeof node !== 'object') return [];
  return [...(match(node) ? [node] : []), ...nodes(node.props?.children, match)];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join(' ');
  if (node && typeof node === 'object') return text(node.props?.children);
  return typeof node === 'string' ? node : '';
}
function harness() {
  let cursor = 0, tree, authCallback, session = { access_token: 'fixture-token-A' }, writes = 0;
  const hooks = [], effects = [], timers = new Map(), requests = [], navigations = [];
  let timerId = 0;
  const useState = initial => {
    const id = cursor++;
    if (!hooks[id]) hooks[id] = { value: initial };
    return [hooks[id].value, value => { writes++; hooks[id].value = value; }];
  };
  const useRef = initial => { const id = cursor++; return hooks[id] ||= { current: initial }; };
  const useCallback = (fn, deps) => {
    const id = cursor++;
    if (!hooks[id] || deps.some((v, i) => v !== hooks[id].deps[i])) hooks[id] = { fn, deps };
    return hooks[id].fn;
  };
  const useEffect = (fn, deps) => {
    const id = cursor++;
    if (!hooks[id] || deps.some((v, i) => v !== hooks[id].deps[i])) {
      hooks[id] = { deps }; effects.push(() => { hooks[id].cleanup = fn(); });
    }
  };
  const browser = () => ({ auth: {
    getSession: async () => ({ data: { session } }),
    onAuthStateChange: fn => { authCallback = fn; return { data: { subscription: { unsubscribe() {} } } }; }
  } });
  const fetch = (url, options) => {
    const d = deferred(); requests.push({ url, options, ...d }); return d.promise;
  };
  const Page = new Function('useState', 'useRef', 'useCallback', 'useEffect', 'Link',
    'getBrowserSupabaseClient', 'require', 'exports', 'window', 'fetch', 'setTimeout', 'clearTimeout',
    compiled + ';return MarketplaceLibraryPage;')(
    useState, useRef, useCallback, useEffect, 'a', browser, require, {},
    { location: { assign: url => navigations.push(url) } }, fetch,
    fn => { const id = ++timerId; timers.set(id, fn); return id; }, id => timers.delete(id)
  );
  const render = () => { cursor = 0; tree = Page(); effects.splice(0).forEach(fn => fn()); return tree; };
  render();
  return {
    requests, navigations, render,
    get writes() { return writes; },
    get content() { return text(render()); },
    button(label) { return nodes(render(), n => n.type === 'button' && text(n) === label)[0]; },
    async auth(access) {
      session = access ? { access_token: access } : null;
      authCallback('SIGNED_IN', session);
      const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); await tick();
    },
    unmount() { hooks.forEach(h => h?.cleanup?.()); },
    async reply(index, body, status = 200) {
      // Deliberately ignore AbortSignal: generation checks must also reject late responses.
      requests[index].resolve({ status, ok: status >= 200 && status < 300, json: async () => body }); await tick();
    }
  };
}
const purchase = title => ({ products: [{ orderId: 'fixture-order', title, downloadable: true }] });
async function test(name, fn) { await fn(); console.log('PASS ' + name); }

await test('account switch cannot reveal a late prior-account library response', async () => {
  const h = harness(); await tick(); await h.auth('fixture-token-B');
  assert.equal(h.requests[0].options.signal.aborted, true);
  await h.reply(0, purchase('Buyer A private title'));
  assert.match(h.content, /Loading purchases/); assert.doesNotMatch(h.content, /Buyer A/);
  await h.reply(1, purchase('Buyer B private title'));
  assert.match(h.content, /Buyer B/); assert.doesNotMatch(h.content, /Buyer A/);
  assert.equal(h.requests[1].options.headers.Authorization, 'Bearer fixture-token-B'); h.unmount();
});
await test('sign-out cannot be undone by an old library response', async () => {
  const h = harness(); await tick(); await h.auth(null); await h.reply(0, purchase('Buyer A private title'));
  assert.match(h.content, /Sign in/); assert.doesNotMatch(h.content, /Buyer A/); h.unmount();
});
await test('an older refresh cannot replace a newer completed refresh', async () => {
  const h = harness(); await tick(); await h.reply(0, purchase('Initial'));
  const refresh = h.button('Refresh').props.onClick;
  refresh(); await tick(); refresh(); await tick();
  await h.reply(2, purchase('Newest')); await h.reply(1, purchase('Stale'));
  assert.match(h.content, /Newest/); assert.doesNotMatch(h.content, /Stale/); h.unmount();
});
await test('sign-out cancels a pending signed-download navigation', async () => {
  const h = harness(); await tick(); await h.reply(0, purchase('Buyer A'));
  h.button('Secure download').props.onClick(); await tick(); await h.auth(null);
  await h.reply(1, { url: 'https://private.example.test/fixture-download' });
  assert.equal(h.requests[1].options.signal.aborted, true); assert.deepEqual(h.navigations, []); h.unmount();
});
await test('unmount rejects late purchase responses without state writes', async () => {
  const h = harness(); await tick(); h.unmount(); const writes = h.writes;
  await h.reply(0, purchase('Private title'));
  assert.equal(h.writes, writes); assert.equal(h.requests[0].options.signal.aborted, true);
});
await test('malformed purchase responses show recoverable feedback', async () => {
  const h = harness(); await tick(); await h.reply(0, { products: [{ title: 'Incomplete' }] });
  assert.match(h.content, /Could not load your purchases/); assert.ok(h.button('Refresh')); h.unmount();
});
await test('current account may still load and open a valid secure download', async () => {
  const h = harness(); await tick(); await h.reply(0, purchase('Own product'));
  h.button('Secure download').props.onClick(); await tick();
  await h.reply(1, { url: 'https://private.example.test/fixture-download' });
  assert.deepEqual(h.navigations, ['https://private.example.test/fixture-download']); h.unmount();
});
