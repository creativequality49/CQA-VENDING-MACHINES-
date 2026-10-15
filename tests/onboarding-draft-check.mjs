import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const source = fs.readFileSync('app/onboarding/page.tsx', 'utf8');
const js = ts.transpileModule(source.replace(/^import .*;\r?\n/gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const lib = fs.readFileSync('lib/cqa-marketplace.ts', 'utf8').replaceAll('\r', '');
const plansJs = ts.transpileModule(lib.slice(lib.indexOf('export const CQA_PLANS'), lib.indexOf('export const CQA_WORKERS')), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
new Function('exports', plansJs)(exports);
const plans = exports.CQA_PLANS;
const find = (n, p) => { if (!n || typeof n !== 'object')
    return; if (p(n))
    return n; for (const c of [].concat(n.props?.children || [])) {
    const f = find(c, p);
    if (f)
        return f;
} };
class Button {
    constructor(value) { this.value = value; }
}
const stateNames = [...source.matchAll(/const \[(\w+),\s*\w+\]\s*=\s*useState/g)].map(m => m[1]);
function harness(t = {}) {
    let index = 0, ri = 0;
    const state = { userId: 'owner', checking: false, name: 'Real Studio', category: 'Professional Services', description: 'Real customer description', location: 'Adelaide', phone: '', businessEmail: 'owner@example.test', plan: 'pro', launchPackage: true, offers: [{ name: 'Consultation', price: '30' }], colour: '#ff7bd3', reviewed: true, restored: true, usingExample: false, error: '', loading: false, submissionMode: 'activate' }, refs = [], effects = [], requests = [], redirects = [], storage = new Map(), sharedStorage = t.sharedStorage || new Map();
    if (t.sample) {
        state.name = 'Example Studio';
        state.usingExample = true;
    }
    if (t.changedName)
        state.name = 'New name';
    if (t.anonymous)
        state.userId = null;
    if (t.unreviewed)
        state.reviewed = false;
    const fn = new Function('require', 'exports', 'useState', 'useMemo', 'useRef', 'useEffect', 'useRouter', 'useSearchParams', 'getBrowserSupabaseClient', 'CQA_PLANS', 'fetch', 'window', 'HTMLButtonElement', 'sessionStorage', 'localStorage', 'const Link=()=>null;const CqaMachinePreview=()=>null;' + js + ';return OnboardingForm;')(() => ({ jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }), {}, initial => { const key = stateNames[index++]; return [state[key] === undefined ? initial : state[key], v => state[key] = v]; }, f => f(), value => refs[ri++] ||= { current: value }, f => effects.push(f), () => ({ push: p => redirects.push(p) }), () => new URLSearchParams('plan=pro'), () => ({ auth: { getSession: async () => { if (t.sessionThrow)
                throw Error('network'); return { data: { session: t.noSession ? null : { access_token: 'fake-token', user: { id: 'owner', email: 'owner@example.test' } } } }; } } }), plans, async (path, options) => { requests.push([path, options]); if (t.pending && path === '/api/onboarding') await t.pending; if (t.network && path === '/api/onboarding')
        throw Error('network'); if (t.billingFailure && path.includes('checkout'))
        throw Error('network'); return { ok: true, status: 200, json: async () => path === '/api/onboarding' ? { businessId: 'fixture-business', existing: !!t.existing } : path.includes('checkout') ? { url: 'https://checkout.stripe.test/session' } : path.startsWith('/api/owner/setup?') ? { setup: t.setup ?? null, business: { name: 'Real Studio', category: 'Professional Services', location_text: 'Adelaide', description: 'Real customer description' } } : { ok: true } }; }, { location: { assign: p => redirects.push(p) }, sessionStorage: {getItem:k=>storage.get(k)??null,removeItem:k=>storage.delete(k)}, localStorage:{getItem:k=>sharedStorage.get(k)??null,removeItem:k=>sharedStorage.delete(k)} }, Button, { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) }, { getItem: k => sharedStorage.get(k) ?? null, setItem: (k,v) => sharedStorage.set(k,v), removeItem: k => sharedStorage.delete(k) });
    return { state, requests, redirects, refs, effects, storage, sharedStorage, render() { index = ri = 0; effects.length = 0; return fn(); }, async submit(mode = 'activate') { return find(this.render(), n => n.type === 'form').props.onSubmit({ preventDefault() { }, nativeEvent: { submitter: new Button(mode) } }); } };
}
for (const t of [{ name: 'existing different business without setup cannot be changed', existing: true, changedName: true }, { name: 'sample cannot become purchased workspace', sample: true }, { name: 'changed business name cannot charge old preview', existing: true, changedName: true, setup: { business_summary: 'Real customer description', primary_color: '#ff7bd3', answers: { catalogBrief: 'Consultation — AUD 30' } } }, { name: 'anonymous preview visible before login', anonymous: true }, { name: 'review required before payment', unreviewed: true }, { name: 'reviewed preview saves brief before Stripe' }, { name: 'free draft avoids Stripe', mode: 'draft' }, { name: 'existing different profile cannot be overwritten', existing: true, setup: { business_summary: 'Existing content', primary_color: '#123456', answers: { catalogBrief: 'Existing offer' } } }, { name: 'same preview safely retries checkout', existing: true, setup: { business_summary: 'Real customer description', primary_color: '#ff7bd3', answers: { catalogBrief: 'Consultation — AUD 30' } } }, { name: 'billing failure retains saved workspace', billingFailure: true }]) {
    const h = harness(t);
    const tree = h.render();
    assert.ok(find(tree, n => n.props?.id === 'machine-preview'));
    await h.submit(t.mode);
    if (t.sample) {
        assert.equal(h.requests.length, 0);
        assert.match(h.state.error, /Replace the sample/);
    }
    else if (t.unreviewed) {
        assert.equal(h.requests.length, 0);
        assert.match(h.state.error, /Review/);
    }
    else if (t.anonymous) {
        assert.equal(h.requests.length, 0);
        assert.match(h.redirects[0], /^\/login\?next=/);
    }
    else if (t.existing) {
        assert.equal(h.requests.some(([p, o]) => p === '/api/owner/setup' && o.method === 'POST'), false);
        assert.equal(h.requests.some(([p]) => p.includes('checkout')), t.name.startsWith('same'));
    }
    else {
        const saved = h.requests.find(([p, o]) => p === '/api/owner/setup' && o.method === 'POST');
        assert.ok(saved);
        const body = JSON.parse(saved[1].body);
        assert.equal(body.answers.catalogBrief, 'Consultation — AUD 30');
        assert.equal(body.primaryColor, '#ff7bd3');
        assert.equal(h.requests.some(([p]) => p.includes('checkout')), t.mode !== 'draft');
        if (t.mode === 'draft')
            assert.deepEqual(h.redirects, ['/owner/dashboard']);
    }
    assert.equal(h.state.loading, false);
    console.log('PASS ' + t.name);
}
assert.deepEqual(plans.map(p => p.price), [97, 297, 997]);
console.log('PASS plan prices use canonical AUD definitions');
{
    const h = harness();
    h.render();
    h.effects[1]();
    assert.equal(h.state.reviewed, false);
    const saved = JSON.parse(h.storage.get('cqa-onboarding-preview-v1'));
    assert.equal(saved.name, 'Real Studio');
    assert.equal(saved.phone, undefined);
    assert.equal(saved.businessEmail, undefined);
    assert.equal(saved.reviewed, undefined);
    console.log('PASS browser draft excludes contact details and review consent');
}
{
    const h = harness();
    h.storage.set('cqa-onboarding-preview-v1', JSON.stringify({ version: 2, expiresAt:Date.now()+60000, name: 'Restored', description: 'Saved brief', colour: 'url(bad)', offers: [{ name: 'Valid', price: '10' }, null, { name: 2, price: 3 }, { name: 'Fourth', price: '4' }], reviewed: true }));
    h.render();
    h.effects[0]();
    assert.equal(h.state.name, 'Restored');
    assert.equal(h.state.colour, '#ff7bd3');
    assert.deepEqual(h.state.offers, [{ name: 'Valid', price: '10' }]);
    h.render();
    h.effects[1]();
    assert.equal(h.state.reviewed, false);
    console.log('PASS restored draft filters corrupt offers, rejects invalid colour, requires fresh review');
}
for (const t of [{ name: 'expired session blocks persistence', noSession: true }, { name: 'session network error resets busy', sessionThrow: true }, { name: 'workspace network error resets busy', network: true }]) {
    const h = harness(t);
    await h.submit();
    assert.equal(h.state.loading, false);
    assert.equal(h.refs[0].current, false);
    assert.equal(h.redirects.length, 0);
    if (!t.network)
        assert.equal(h.requests.length, 0);
    console.log('PASS ' + t.name);
}

for (const unmount of [false, true]) {
 const h=harness({sessionThrow:true});h.state.checking=true;h.render();const cleanup=h.effects[2]();if(unmount)cleanup();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(h.state.checking,unmount);assert.equal(Boolean(h.state.error),!unmount);console.log('PASS session check failure '+(unmount?'avoids updates after unmount':'releases checking with recovery'));
}
{
 let resolve;const pending=new Promise(r=>resolve=r);const h=harness({pending});const first=h.submit('draft');await Promise.resolve();await h.submit('draft');assert.equal(h.requests.length,1);resolve();await first;assert.equal(h.state.loading,false);assert.equal(h.refs[0].current,false);console.log('PASS concurrent submissions persist one workspace');
}

{
 const h=harness();h.state.phone='PRIVATE PHONE';h.state.businessEmail='private@example.test';h.render();h.effects[1]();const raw=h.sharedStorage.get('cqa-onboarding-preview-v1');assert.equal(raw,h.storage.get('cqa-onboarding-preview-v1'));const saved=JSON.parse(raw);assert.equal(saved.version,2);assert.ok(saved.expiresAt>Date.now()+23*60*60*1000);assert.ok(saved.expiresAt<=Date.now()+24*60*60*1000);for(const key of ['phone','businessEmail','reviewed','token','userId'])assert.equal(saved[key],undefined);
 const next=harness({sharedStorage:h.sharedStorage});assert.equal(next.storage.size,0);next.state.name='New tab blank';next.render();next.effects[0]();assert.equal(next.state.name,'Real Studio');assert.deepEqual(next.state.offers,[{name:'Consultation',price:'30'}]);assert.equal(next.state.businessEmail,'owner@example.test');next.render();next.effects[1]();assert.equal(next.state.reviewed,false);console.log('PASS email-login new tab restores business-only draft and requires fresh review');
}
for(const expiry of [Date.now()-1, Date.now()+48*60*60*1000]){
 const h=harness();const raw=JSON.stringify({version:2,expiresAt:expiry,name:'Stale name',reviewed:true});h.storage.set('cqa-onboarding-preview-v1',raw);h.sharedStorage.set('cqa-onboarding-preview-v1',raw);h.render();h.effects[0]();assert.equal(h.state.name,'Real Studio');assert.equal(h.storage.size,0);assert.equal(h.sharedStorage.size,0);console.log('PASS '+(expiry<Date.now()?'expired':'excessive expiry')+' preview discarded from both stores');
}
{
 const h=harness();h.storage.set('cqa-onboarding-preview-v1','{broken');h.sharedStorage.set('cqa-onboarding-preview-v1',JSON.stringify({version:2,expiresAt:Date.now()+60000,name:'Fallback restored'}));h.render();h.effects[0]();assert.equal(h.state.name,'Fallback restored');console.log('PASS corrupted session draft still permits local fallback');
}
