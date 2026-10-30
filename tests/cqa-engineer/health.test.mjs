import test from 'node:test';
import assert from 'node:assert/strict';
import { checkHealth, probe, validateConfig } from '../../scripts/cqa-engineer/health.mjs';
import { claimRun, finishRun, launchVerdict, RELEASE_GATES } from '../../scripts/cqa-engineer/state.mjs';

const config = { schemaVersion: 1, origin: 'https://www.creativequalityaustralia.tech', paths: ['/', '/api/health'], timeoutMs: 500 };
const html = () => new Response('<html><title>CQA</title></html>', { headers: { 'content-type': 'text/html' } });
const noDelay = async () => {};
test('probes only an approved origin with bounded input', () => {
  for (const change of [{ origin: 'http://169.254.169.254' }, { paths: ['//evil.test'] }, { paths: ['/api?key=secret'] }, { timeoutMs: 99999 }, { paths: [] }]) {
    assert.throws(() => validateConfig({ ...config, ...change }));
  }
});
test('normal public response passes; cannot imply launch readiness', async () => {
  const result = await checkHealth({ ...config, paths: ['/'] }, { fetchImpl: async () => html() });
  assert.equal(result.status, 'passed'); assert.match(result.proves, /does not verify/);
});
test('a caller cannot substitute an unapproved URL for an allowed path', async () => {
  await assert.rejects(probe(config, 'https://evil.example', { fetchImpl: async () => html() }), /not approved/);
});
test('redirect, soft 404 and login/protection page do not pass', async () => {
  for (const response of [new Response('', { status: 302 }), new Response('<html><title>404: Not found</title></html>', { headers: { 'content-type': 'text/html' } }), new Response('<html><title>Authentication Required</title></html>', { headers: { 'content-type': 'text/html' } })]) {
    assert.equal((await probe(config, '/', { fetchImpl: async () => response })).status, 'failed');
  }
});
test('one retry for rate limit or tool failure; failures remain visible', async () => {
  let calls = 0;
  const success = await probe(config, '/', { fetchImpl: async () => ++calls === 1 ? new Response('', { status: 429 }) : html(), sleep: noDelay });
  assert.equal(success.status, 'passed'); assert.equal(calls, 2);
  calls = 0;
  const failure = await probe(config, '/', { fetchImpl: async () => { calls++; throw new Error('secret-response-value'); }, sleep: noDelay });
  assert.equal(failure.status, 'unreachable'); assert.equal(calls, 2);
  assert.doesNotMatch(JSON.stringify(failure), /secret-response-value/);
});
test('health configuration report allows only recognised values', async () => {
  const data = { status: 'ok', launchConfigurationReady: true, secret: 'must-not-be-written' };
  for (const key of ['database', 'stripe', 'legacyServiceRole', 'commerceSchema', 'email', 'emailSender', 'platformWebhookSecret', 'connectWebhookSecret']) data[key] = 'ok';
  const good = await probe(config, '/api/health', { fetchImpl: async () => Response.json(data) });
  assert.equal(good.status, 'passed'); assert.doesNotMatch(JSON.stringify(good), /must-not-be-written/);
  data.database = 'raw-secret-value';
  const bad = await probe(config, '/api/health', { fetchImpl: async () => Response.json(data) });
  assert.equal(bad.status, 'failed'); assert.equal(bad.components.database, 'unknown');
  assert.doesNotMatch(JSON.stringify(bad), /raw-secret-value/);
});
test('malformed or oversized responses never become success', async () => {
  const invalid = await probe(config, '/api/health', { fetchImpl: async () => new Response('invalid') });
  assert.equal(invalid.reason, 'invalid-health-json');
  const large = await probe(config, '/', { fetchImpl: async () => new Response('x'.repeat(1024 * 1024 + 1)), sleep: noDelay });
  assert.equal(large.status, 'unreachable');
});
const state = { schemaVersion: 1, lease: null, runs: [] };
const now = new Date('2026-10-30T06:00:00Z');
test('leases exclude overlapping runs and permit bounded crash recovery', () => {
  const claimed = claimRun(state, 'run_first', now);
  assert.equal(state.lease, null);
  assert.throws(() => claimRun(claimed, 'run_other', now), /lease/);
  assert.throws(() => finishRun(claimed, { id: 'run_other' }, now), /lease/);
  assert.throws(() => claimRun({ ...state, lease: { expiresAt: 'invalid' } }, 'run_other', now));
  const recovered = claimRun(claimed, 'run_other', new Date(now.getTime() + 46 * 60000));
  assert.equal(recovered.lease.runId, 'run_other');
});
test('finish requires exact commit evidence and prevents duplicate run completion', () => {
  const claimed = claimRun(state, 'run_first', now);
  assert.throws(() => finishRun(claimed, { id: 'run_first', status: 'completed', inspectedCommit: 'main', checks: [] }, now));
  const finished = finishRun(claimed, { id: 'run_first', status: 'blocked', inspectedCommit: 'a'.repeat(40), checks: [] }, now);
  assert.equal(finished.lease, null); assert.equal(finished.runs.length, 1);
  assert.throws(() => claimRun(finished, 'run_first', now), /completed/);
  for (const invalidTime of ['invalid', null]) {
    assert.throws(() => finishRun({ ...claimed, lease: { ...claimed.lease, expiresAt: invalidTime } },
      { id: 'run_first', status: 'completed', inspectedCommit: 'a'.repeat(40), checks: [] }, now), /lease/);
  }
  assert.throws(() => finishRun(claimed, { id: 'run_first' }, new Date('invalid')), /lease/);
});
test('release gates fail closed for missing, stale or skipped evidence', () => {
  const sha = 'a'.repeat(40);
  const gates = RELEASE_GATES.map(id => ({ id, status: 'verified', evidence: [{ commitSha: sha, result: 'passed', environment: 'test', source: 'test-run-reference', observedAt: now.toISOString() }] }));
  assert.equal(launchVerdict([], sha).status, 'NOT_READY');
  assert.equal(launchVerdict(gates, 'b'.repeat(40)).status, 'NOT_READY');
  assert.equal(launchVerdict(gates, sha).status, 'READY_FOR_RELEASE_REVIEW');
  assert.equal(launchVerdict(gates.map(gate => ({ ...gate, evidence: [{ ...gate.evidence[0], commitSha: 'main' }] })), 'main').status, 'NOT_READY');
  assert.equal(launchVerdict(gates.map(gate => ({ ...gate, evidence: [{ ...gate.evidence[0], source: '  ' }] })), sha).status, 'NOT_READY');
  gates[0].evidence[0].result = 'skipped';
  assert.equal(launchVerdict(gates, sha).status, 'NOT_READY');
});
