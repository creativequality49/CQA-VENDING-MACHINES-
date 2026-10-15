import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { z } from 'zod';

const source = fs.readFileSync('app/api/owner/setup/generate/route.ts', 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const id = '11111111-1111-4111-8111-111111111111';
const cases = [
  { name: 'anonymous rejected before data/provider', anonymous: true, expected: 401 },
  { name: 'inactive Pro denied', plan: 'pro', status: 'canceled', expected: 402 },
  { name: 'missing subscription denied', missing: true, expected: 402 },
  { name: 'active Starter denied despite stale Pro workspace', plan: 'starter', status: 'active', businessPlan: 'pro', expected: 403 },
  { name: 'legacy basic Starter denied', plan: 'basic', status: 'active', expected: 403 },
  { name: 'unknown paid tier denied', plan: 'unknown', status: 'active', expected: 403 },
  { name: 'active Pro allowed despite stale Starter workspace', plan: 'pro', status: 'active', businessPlan: 'starter', expected: 200 },
  { name: 'trial Enterprise uses canonical subscription limits', plan: 'elite', status: 'trialing', businessPlan: 'pro', expected: 200 }
];
for (const t of cases) {
  let reads = 0, providers = 0, writes = 0;
  const admin = { from(table) {
    reads++;
    const q = {
      select() { return q; }, eq() { return q; }, delete() { writes++; return q; },
      insert() { writes++; return q; }, update() { writes++; return q; },
      maybeSingle: async () => ({ data: table === 'cqa_plan_subscriptions' ? (t.missing ? null : { plan: t.plan, status: t.status }) : table === 'cqa_machine_setup_profiles' ? { business_summary: 'Consultations', answers: {} } : { id: 'machine', customization: {} }, error: null }),
      then(resolve) { resolve({ error: null }); }
    };
    return q;
  } };
  const post = new Function('NextResponse', 'z', 'requireCqaOwner', 'buildAIExecutionPlan', 'getCqaChatProvider', 'console', js + ';return POST;')(
    { json: (body, o) => ({ body, status: o?.status || 200 }) }, z,
    async () => { if (t.anonymous) throw Object.assign(Error('Authentication required.'), { status: 401 }); return { business: { id, name: 'Example', category: 'Consulting', plan: t.businessPlan || t.plan }, admin }; },
    () => ({}), async () => { providers++; return null; }, { error() {} }
  );
  const r = await post(new Request('https://example.test/generate', { method: 'POST', body: JSON.stringify({ businessId: id }) }));
  assert.equal(r.status, t.expected, t.name);
  assert.equal(providers, t.expected === 200 ? 1 : 0, t.name);
  if (t.expected !== 200) assert.equal(writes, 0, t.name);
  if (t.anonymous) assert.equal(reads, 0);
  if (t.expected === 200) assert.equal(r.body.mode, t.plan === 'elite' ? 'done_for_you' : 'assisted');
  console.log('PASS ' + t.name);
}
