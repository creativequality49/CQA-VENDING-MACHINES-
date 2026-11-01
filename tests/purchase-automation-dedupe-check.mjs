import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Execute the production functions. Every database/provider boundary below is
// in-memory; this script never sends messages or calls a real provider.
const require = createRequire(import.meta.url);
const copy = value => structuredClone(value);
const ids = {
  business: '00000000-0000-4000-8000-000000000001',
  otherBusiness: '00000000-0000-4000-8000-000000000002',
  automation: '00000000-0000-4000-8000-000000000011',
  otherAutomation: '00000000-0000-4000-8000-000000000012',
  contact: '00000000-0000-4000-8000-000000000021'
};
const payload = (id = 'cs_test_purchaseA') => ({ checkoutSessionId: id, orderId: 'fixture-order' });
const tick = () => new Promise(resolve => setImmediate(resolve));
function barrier() { let release; const promise = new Promise(r => { release = r; }); return { promise, release }; }
function automation(id = ids.automation, business = ids.business, trigger = 'purchase') {
  return { id, business_id: business, trigger_type: trigger, status: 'active', name: 'Fixture automation', created_by: null };
}

function harness(options = {}) {
  let sequence = 0;
  const state = {
    automations: [automation()], runs: [], emails: [], claimAttempts: 0,
    insertFailures: new Map(), ...options
  };
  const steps = options.steps || [{ id: 'fixture-step', step_order: 1, step_type: 'email', name: 'Fixture email', enabled: true, config: { subject: 'Fixture', body: 'Fixture only' } }];
  function tableRows(table) {
    if (table === 'cqa_automations') return state.automations;
    if (table === 'cqa_automation_runs') return state.runs;
    if (table === 'cqa_businesses') return [ids.business, ids.otherBusiness].map(id => ({ id, name: 'Fixture business', email: null }));
    if (table === 'cqa_contacts') return [{ id: ids.contact, email: 'fixture@example.test', name: 'Fixture', tags: [], status: 'subscribed' }];
    if (table === 'cqa_automation_steps') return state.automations.flatMap(a => steps.map(s => ({ ...s, automation_id: a.id, business_id: a.business_id })));
    throw Error('Unexpected database table: ' + table);
  }
  function field(row, key) {
    if (key.includes('->>')) { const [base, leaf] = key.split('->>'); return row[base]?.[leaf]; }
    return row[key];
  }
  const admin = { from(table) {
    let op = 'select', values, conditions = [], orderKey, max = Infinity;
    const q = {
      select() { return q; },
      eq(key, value) { conditions.push(row => field(row, key) === value); return q; },
      neq(key, value) { conditions.push(row => field(row, key) !== value); return q; },
      is(key, value) { conditions.push(row => field(row, key) === value); return q; },
      in(key, list) { conditions.push(row => list.includes(field(row, key))); return q; },
      lte(key, value) { conditions.push(row => field(row, key) !== null && field(row, key) <= value); return q; },
      contains(key, value) { conditions.push(row => Object.entries(value).every(([k,v]) => row[key]?.[k] === v)); return q; },
      order(key) { orderKey = key; return q; },
      limit(value) { max = value; return q; },
      insert(value) { op = 'insert'; values = copy(value); return q; },
      update(value) { op = 'update'; values = copy(value); return q; },
      async single() { const r = await execute(); return { ...r, data: r.data?.[0] || null }; },
      async maybeSingle() { const r = await execute(); return { ...r, data: r.data?.[0] || null }; },
      then(resolve, reject) { return execute().then(resolve, reject); }
    };
    async function execute() {
      if (op === 'select' && table === 'cqa_automation_runs' && state.lookupReadError) {
        return { data: null, error: { code: '08006', message: 'Fixture lookup unavailable' } };
      }
      if (op === 'insert') {
        assert.equal(table, 'cqa_automation_runs');
        const left = state.insertFailures.get(values.automation_id) || 0;
        if (left) {
          state.insertFailures.set(values.automation_id, left - 1);
          return { data: null, error: { code: '08006', message: 'Fixture database unavailable' } };
        }
        if (state.unrelatedUniqueViolation) return { data: null, error: { code: '23505', message: 'Fixture different unique constraint' } };
        const id = values.id || `10000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
        if (state.runs.some(run => run.id === id)) return { data: null, error: { code: '23505', message: 'Duplicate primary key' } };
        const row = { id, current_step_order: 1, next_run_at: null, output: {}, updated_at: new Date().toISOString(), ...values };
        state.runs.push(row);
        return { data: [copy(row)], error: null };
      }
      if (op === 'update' && table === 'cqa_automation_runs' && !state.writeFailed) {
        const kind = values.status === 'waiting' ? 'wait' : values.status === 'needs_approval' ? 'approval' :
          values.status === 'succeeded' ? 'final' : values.status === undefined && values.current_step_order ? 'checkpoint' : null;
        if (kind && state.failWrite === kind) {
          state.writeFailed = true;
          return { data: null, error: { code: '08006', message: 'Fixture progress save unavailable' } };
        }
      }
      if (table === 'cqa_automation_runs' && op === 'update' && values.status === 'running') {
        state.claimAttempts++;
        if (state.failClaimOnce) {
          state.failClaimOnce = false;
          return { data: null, error: { code: '08006', message: 'Fixture claim unavailable' } };
        }
        if (state.beforeClaim) { const fn = state.beforeClaim; state.beforeClaim = null; fn(state); }
      }
      let rows = tableRows(table).filter(row => conditions.every(fn => fn(row)));
      if (orderKey) rows.sort((a,b) => String(a[orderKey]).localeCompare(String(b[orderKey])));
      rows = rows.slice(0, max);
      if (op === 'update') rows.forEach(row => Object.assign(row, copy(values)));
      return { data: rows.map(copy), error: null };
    }
    return q;
  } };
  class Resend {
    constructor() {
      this.emails = { send: async args => {
        state.emails.push(copy(args));
        if (state.emailBarrier) await state.emailBarrier.promise;
        return state.emailFailure ? { data: null, error: { message: 'Fixture email failure' } } : { data: { id: 'fixture-message' }, error: null };
      } };
    }
  }
  const modules = new Map();
  function load(file) {
    if (modules.has(file)) return modules.get(file);
    const exports = {}, module = { exports };
    modules.set(file, exports);
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true
    } }).outputText;
    function localRequire(name) {
      if (name === 'server-only') return {};
      if (name === 'resend') return { Resend };
      if (name === '@/lib/cqa-supabase-admin') return { getCqaSupabaseAdmin: () => admin };
      if (name === '@/lib/cqa-ai-provider') return { getCqaChatProvider: async () => true };
      if (name === '@/lib/cqa-ai-core') return { runCqaAgent: async () => { throw Error('Unexpected AI side effect'); } };
      if (name.startsWith('@/lib/')) return load(path.resolve('lib', name.slice('@/lib/'.length) + '.ts'));
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + (name.endsWith('.ts') ? '' : '.ts')));
      if (name === 'node:crypto' || name === 'crypto') return require(name);
      throw Error('Unexpected production dependency: ' + name);
    }
    new Function('require', 'module', 'exports', 'fetch', js)(localRequire, module, exports,
      async () => { throw Error('Unexpected external HTTP side effect'); });
    modules.set(file, module.exports);
    return module.exports;
  }
  const api = load(path.resolve('lib/cqa-automation-engine.ts'));
  return { state, api, purchaseRunId: load(path.resolve('lib/cqa-purchase-run-id.ts')).purchaseAutomationRunId,
    purchase: (id = 'cs_test_purchaseA', business = ids.business) => api.triggerBusinessAutomations(business, 'purchase', payload(id), ids.contact) };
}
process.env.RESEND_API_KEY = 'fixture-only-not-a-provider-key';
process.env.CQA_AUTOMATION_FROM_EMAIL = 'fixture@example.test';
process.env.CQA_WEBHOOK_ALLOWLIST = '';
async function test(name, fn) { await fn(); console.log('PASS ' + name); }

await test('durable purchase identity matches independently computed UUIDv5 vectors', async () => {
  const h = harness();
  for (const [business, automation, expected] of [
    ['business-a', 'automation-a', 'b214fa3e-5df3-5320-b8d0-b467fab257ae'],
    ['business-a', 'automation-b', '28558718-e82f-5ef5-8e93-3d9191625628'],
    ['business-b', 'automation-a', 'cc91a24b-7c80-5dda-b184-536ef60e7fca']
  ]) assert.equal(h.purchaseRunId(business, automation, 'cs_test_A'), expected);
});
await test('distinct completions for one checkout retain one run and one email', async () => {
  const h = harness(); const a = await h.purchase(); const b = await h.purchase();
  assert.equal(h.state.runs.length, 1); assert.equal(h.state.emails.length, 1);
  assert.equal(a[0].runId, b[0].runId);
});
await test('concurrent purchase deliveries execute a single durable run', async () => {
  const hold = barrier(); const h = harness({ emailBarrier: hold });
  const a = h.purchase(); await tick(); const b = h.purchase(); await tick();
  assert.equal(h.state.runs.length, 1); assert.equal(h.state.emails.length, 1);
  hold.release(); await Promise.all([a,b]); assert.equal(h.state.emails.length, 1);
});
await test('different checkouts create independent runs', async () => {
  const h = harness(); await h.purchase(); await h.purchase('cs_test_purchaseB');
  assert.equal(h.state.runs.length, 2); assert.equal(h.state.emails.length, 2);
});
await test('independent automations and businesses do not share purchase runs', async () => {
  const h = harness({ automations: [automation(), automation(ids.otherAutomation), automation('00000000-0000-4000-8000-000000000013', ids.otherBusiness)] });
  await h.purchase(); await h.purchase('cs_test_purchaseA', ids.otherBusiness);
  assert.equal(h.state.runs.length, 3); assert.equal(new Set(h.state.runs.map(r => r.id)).size, 3); assert.equal(h.state.emails.length, 3);
});
await test('partial scheduling failure surfaces and retry skips completed automation', async () => {
  const h = harness({ automations: [automation(), automation(ids.otherAutomation)], insertFailures: new Map([[ids.otherAutomation, 1]]) });
  await assert.rejects(h.purchase()); assert.equal(h.state.runs.length, 1); assert.equal(h.state.emails.length, 1);
  await h.purchase(); assert.equal(h.state.runs.length, 2); assert.equal(h.state.emails.length, 2);
});
await test('unrelated unique violation without the exact run is an error', async () => {
  const h = harness({ unrelatedUniqueViolation: true });
  await assert.rejects(h.purchase()); assert.equal(h.state.runs.length, 0); assert.equal(h.state.emails.length, 0);
});
await test('purchase lookup failure is visible and does not schedule blindly', async () => {
  const h = harness({ lookupReadError: true }); await assert.rejects(h.purchase());
  assert.equal(h.state.runs.length, 0); assert.equal(h.state.emails.length, 0);
});
await test('legacy random-ID purchase runs prevent delayed-event repetition', async () => {
  const legacy = { id: '10000000-0000-4000-8000-000000000099', business_id: ids.business,
    automation_id: ids.automation, trigger_type: 'purchase', trigger_payload: payload(),
    status: 'succeeded', created_at: '2026-01-01T00:00:00.000Z' };
  const h = harness({ runs: [legacy] }); const result = await h.purchase();
  assert.equal(result[0].runId, legacy.id); assert.equal(h.state.runs.length, 1); assert.equal(h.state.emails.length, 0);
});
await test('a duplicate ID belonging to another business is never reused', async () => {
  const h = harness(); await h.purchase(); h.state.runs[0].business_id = ids.otherBusiness;
  await assert.rejects(h.purchase()); assert.equal(h.state.emails.length, 1);
});
await test('a duplicate ID with another checkout payload is never reused', async () => {
  const h = harness(); await h.purchase(); h.state.runs[0].trigger_payload = payload('cs_test_other');
  await assert.rejects(h.purchase()); assert.equal(h.state.emails.length, 1);
});
await test('failed purchase run remains visible and does not replay side effects', async () => {
  const h = harness({ emailFailure: true }); await assert.rejects(h.purchase());
  assert.equal(h.state.runs[0].status, 'failed'); h.state.emailFailure = false;
  await assert.rejects(h.purchase()); assert.equal(h.state.runs.length, 1); assert.equal(h.state.emails.length, 1);
});
await test('waiting and approval states are preserved on duplicate completion', async () => {
  for (const status of ['waiting', 'needs_approval', 'running', 'succeeded']) {
    const h = harness(); await h.purchase(); h.state.runs[0].status = status;
    h.state.runs[0].next_run_at = status === 'waiting' ? '2099-01-01T00:00:00.000Z' : null;
    await h.purchase(); assert.equal(h.state.runs.length, 1); assert.equal(h.state.emails.length, 1); assert.equal(h.state.runs[0].status, status);
  }
});
await test('queued crash can be recovered by the scheduler without a second run', async () => {
  const h = harness({ failClaimOnce: true }); await assert.rejects(h.purchase());
  assert.equal(h.state.runs[0].status, 'queued'); await h.purchase(); assert.equal(h.state.emails.length, 0);
  await h.api.resumeDueAutomationRuns(); assert.equal(h.state.runs.length, 1); assert.equal(h.state.emails.length, 1); assert.equal(h.state.runs[0].status, 'succeeded');
});
await test('two workers cannot execute the same queued run simultaneously', async () => {
  const h = harness({ failClaimOnce: true }); await assert.rejects(h.purchase());
  await Promise.all([h.api.processAutomationRun(h.state.runs[0].id), h.api.processAutomationRun(h.state.runs[0].id)]);
  assert.equal(h.state.emails.length, 1);
});
await test('waiting snapshot changed by another worker defeats a stale claim', async () => {
  const h = harness({ failClaimOnce: true }); await assert.rejects(h.purchase());
  Object.assign(h.state.runs[0], { status: 'waiting', next_run_at: '2000-01-01T00:00:00.000Z', current_step_order: 1 });
  h.state.beforeClaim = s => Object.assign(s.runs[0], { status: 'waiting', current_step_order: 2, next_run_at: '2099-01-01T00:00:00.000Z', updated_at: '2099-01-01T00:00:00.000Z' });
  await h.api.processAutomationRun(h.state.runs[0].id);
  assert.equal(h.state.emails.length, 0); assert.equal(h.state.runs[0].current_step_order, 2); assert.equal(h.state.runs[0].status, 'waiting');
});
await test('future waits and approval/running runs are not scheduler-replayed', async () => {
  for (const status of ['waiting', 'needs_approval', 'running', 'failed', 'succeeded']) {
    const h = harness(); await h.purchase(); Object.assign(h.state.runs[0], { status, current_step_order: 1, next_run_at: '2099-01-01T00:00:00.000Z' });
    await h.api.resumeDueAutomationRuns(); assert.equal(h.state.emails.length, 1); assert.equal(h.state.runs[0].status, status);
  }
});
await test('a real wait resumes at its next step once without a new purchase run', async () => {
  const h = harness({ steps: [
    { id: 'wait', step_order: 1, step_type: 'wait', enabled: true, config: { minutes: 1 } },
    { id: 'email', step_order: 2, step_type: 'email', enabled: true, config: { subject: 'Fixture', body: 'Fixture' } }
  ] });
  await h.purchase(); assert.equal(h.state.runs[0].status, 'waiting'); assert.equal(h.state.emails.length, 0);
  h.state.runs[0].next_run_at = '2000-01-01T00:00:00.000Z';
  await h.api.resumeDueAutomationRuns(); await h.purchase(); await h.api.resumeDueAutomationRuns();
  assert.equal(h.state.runs.length, 1); assert.equal(h.state.runs[0].status, 'succeeded'); assert.equal(h.state.emails.length, 1);
});
await test('approval-gated work remains paused on duplicate and scheduler calls', async () => {
  const h = harness({ steps: [{ id: 'webhook', step_order: 1, step_type: 'webhook', enabled: true,
    config: { url: 'https://unapproved.example.test/fixture' } }] });
  await h.purchase(); assert.equal(h.state.runs[0].status, 'needs_approval');
  await h.purchase(); await h.api.resumeDueAutomationRuns();
  assert.equal(h.state.runs.length, 1); assert.equal(h.state.runs[0].status, 'needs_approval'); assert.equal(h.state.emails.length, 0);
});
await test('failed progress/wait/approval/final writes stay visible and never replay an email', async () => {
  for (const failWrite of ['checkpoint', 'final', 'wait', 'approval']) {
    const steps = failWrite === 'wait' ? [{ id: 'wait', step_order: 1, step_type: 'wait', enabled: true, config: { minutes: 1 } }] :
      failWrite === 'approval' ? [{ id: 'webhook', step_order: 1, step_type: 'webhook', enabled: true, config: { url: 'https://unapproved.example.test/fixture' } }] : undefined;
    const h = harness({ failWrite, ...(steps ? { steps } : {}) });
    await assert.rejects(h.purchase(), failWrite + ' must not acknowledge success');
    assert.equal(h.state.writeFailed, true); assert.equal(h.state.runs[0].status, 'failed');
    const sends = h.state.emails.length; await assert.rejects(h.purchase());
    assert.equal(h.state.emails.length, sends); assert.equal(h.state.runs.length, 1);
  }
});
await test('new queued work cannot starve an older due waiting run', async () => {
  const h = harness({ failClaimOnce: true }); await assert.rejects(h.purchase());
  const queued = h.state.runs[0]; queued.created_at = '2026-01-01T00:00:00.000Z';
  assert.equal(queued.output._cqaPurchaseRunVersion, 1);
  assert.equal(queued.id, h.purchaseRunId(ids.business, ids.automation, payload().checkoutSessionId));
  const base = { business_id: ids.business, automation_id: ids.automation, trigger_type: 'purchase', contact_id: ids.contact,
    current_step_order: 1, output: {}, updated_at: '2026-01-01T00:00:00.000Z' };
  const waiting = { ...base, id: '10000000-0000-4000-8000-000000000088', status: 'waiting', trigger_payload: payload('cs_test_old'),
    next_run_at: '2000-01-01T00:00:00.000Z', created_at: '2000-01-01T00:00:00.000Z' };
  h.state.runs.push(waiting); await h.api.resumeDueAutomationRuns(1);
  assert.equal(waiting.status, 'succeeded'); assert.equal(queued.status, 'queued'); assert.equal(h.state.emails.length, 1);
});
await test('legacy unmarked and nonpurchase queued work is never automatically replayed', async () => {
  const h = harness();
  const base = { business_id: ids.business, automation_id: ids.automation, trigger_type: 'purchase', contact_id: ids.contact,
    current_step_order: 1, output: {}, status: 'queued', trigger_payload: payload(), next_run_at: null,
    created_at: '2000-01-01T00:00:00.000Z', updated_at: '2000-01-01T00:00:00.000Z' };
  h.state.runs.push(
    { ...copy(base), id: '10000000-0000-4000-8000-000000000080' },
    { ...copy(base), id: h.purchaseRunId(ids.business, ids.automation, payload().checkoutSessionId) },
    { ...copy(base), id: '10000000-0000-4000-8000-000000000081', trigger_type: 'manual', output: { _cqaPurchaseRunVersion: 1 } },
    { ...copy(base), id: '10000000-0000-4000-8000-000000000082', trigger_type: 'new_booking' }
  );
  const result = await h.api.resumeDueAutomationRuns();
  assert.deepEqual(result, []); assert.equal(h.state.emails.length, 0); assert.equal(h.state.claimAttempts, 0);
  assert.ok(h.state.runs.every(run => run.status === 'queued'));
});
await test('many old queued rows cannot hide safe new queued recovery before the limit', async () => {
  const h = harness({ failClaimOnce: true }); await assert.rejects(h.purchase());
  const safe = h.state.runs[0]; safe.created_at = '2026-01-01T00:00:00.000Z';
  for (let i = 0; i < 8; i++) h.state.runs.unshift({
    ...copy(safe), id: `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    output: {}, created_at: '2000-01-01T00:00:00.000Z'
  });
  const result = await h.api.resumeDueAutomationRuns(1);
  assert.equal(result.length, 1); assert.equal(result[0].id, safe.id); assert.equal(result[0].ok, true);
  assert.equal(safe.status, 'succeeded'); assert.equal(h.state.emails.length, 1);
  assert.ok(h.state.runs.filter(run => run.id !== safe.id).every(run => run.status === 'queued'));
});
await test('marked queued work with an invalid deterministic identity requires review', async () => {
  const h = harness({ failClaimOnce: true }); await assert.rejects(h.purchase());
  const queued = h.state.runs[0]; queued.id = '10000000-0000-4000-8000-000000000090';
  const attempts = h.state.claimAttempts; const result = await h.api.resumeDueAutomationRuns();
  assert.equal(result.length, 1); assert.equal(result[0].ok, false); assert.match(result[0].error, /review/i);
  assert.equal(queued.status, 'queued'); assert.equal(h.state.emails.length, 0); assert.equal(h.state.claimAttempts, attempts);
});
await test('manual and nonpurchase events preserve independent execution', async () => {
  const h = harness({ automations: [automation(ids.automation, ids.business, 'manual'), automation(ids.otherAutomation, ids.business, 'new_booking')] });
  await h.api.startAutomationRun(ids.automation, 'manual', {}, ids.contact);
  await h.api.startAutomationRun(ids.automation, 'manual', {}, ids.contact);
  await h.api.triggerBusinessAutomations(ids.business, 'new_booking', { bookingId: 'fixture' }, ids.contact);
  await h.api.triggerBusinessAutomations(ids.business, 'new_booking', { bookingId: 'fixture' }, ids.contact);
  assert.equal(h.state.runs.length, 4); assert.equal(h.state.emails.length, 4);
});
await test('missing or invalid purchase identity fails before execution', async () => {
  const h = harness();
  for (const checkoutSessionId of [undefined, '', 'not-a-checkout', 'cs_' + 'a'.repeat(300)]) {
    await assert.rejects(h.api.triggerBusinessAutomations(ids.business, 'purchase', { checkoutSessionId }, ids.contact));
  }
  assert.equal(h.state.runs.length, 0); assert.equal(h.state.emails.length, 0);
});
