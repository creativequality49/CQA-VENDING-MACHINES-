import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const js = ts.transpileModule(fs.readFileSync('app/api/safety-report/route.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
function harness(send, configured = true) {
  const sent = [];
  const compiledModule = { exports: {} };
  const require = name => {
    if (name === 'next/server') return { NextResponse: {
      json: (body, init) => Response.json(body, init),
      redirect: (url, status) => new Response(null, { status, headers: { Location: String(url) } }),
    } };
    if (name === 'resend') return { Resend: class {
      emails = { send: async payload => { sent.push(payload); return send(); } };
    } };
    throw new Error(`Unexpected import: ${name}`);
  };
  new Function('require', 'module', 'exports', 'process', js)(require, compiledModule, compiledModule.exports, {
    env: configured ? { RESEND_API_KEY: 'test-only', SAFETY_REPORT_EMAIL: 'safety@example.test', CQA_EMAIL_FROM: 'Safety <safety@example.test>' } : {},
  });
  return { sent, run(fields = { email: 'reporter@example.test', category: 'Safety concern', details: 'Synthetic report for regression testing.' }) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    return compiledModule.exports.POST(new Request('http://localhost:3000/api/safety-report', { method: 'POST', body: form }));
  } };
}

for (const send of [async () => ({ error: { message: 'private-provider-error' } }), async () => { throw new Error('private-provider-error'); }]) {
  const h = harness(send);
  const response = await h.run();
  assert.equal(response.status, 502);
  assert.equal(response.headers.has('location'), false);
  const body = await response.text();
  assert.match(body, /Report delivery failed/);
  assert.doesNotMatch(body, /private-provider-error|submitted/);
  assert.equal(h.sent.length, 1);
}
const success = harness(async () => ({ data: { id: 'synthetic-message' }, error: null }));
const response = await success.run();
assert.equal(response.status, 303);
assert.equal(response.headers.get('location'), 'http://localhost:3000/compliance?report=submitted');
assert.equal(success.sent[0].from, 'Safety <safety@example.test>');
assert.equal(success.sent[0].reply_to, 'reporter@example.test');
assert.match(success.sent[0].text, /Synthetic report for regression testing/);
const missing = harness(async () => { throw new Error('Must not send'); }, false);
assert.equal((await missing.run()).status, 503);
assert.equal(missing.sent.length, 0);
const invalid = harness(async () => { throw new Error('Must not send'); });
assert.equal((await invalid.run({ email: 'reporter@example.test' })).status, 400);
assert.equal(invalid.sent.length, 0);
console.log('PASS safety report: provider rejection/throw returns 502 without success redirect or error leakage; confirmed send redirects 303; invalid/unconfigured reports never send');
