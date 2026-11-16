import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const source = fs.readFileSync('lib/cqa-preview-isolation.ts', 'utf8');
const compiled = ts.transpileModule(source.replace(/export /g, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const diagnose = new Function(compiled + ';return getCqaPreviewIsolationDiagnostics;')();
const env = { VERCEL_ENV: 'preview', SUPABASE_URL: 'https://ndzmlywsuywkhgqdbzft.supabase.co', NEXT_PUBLIC_SUPABASE_URL: 'https://ndzmlywsuywkhgqdbzft.supabase.co', CQA_COMMERCE_TEST_PROJECT: 'ndzmlywsuywkhgqdbzft', STRIPE_SECRET_KEY: 'sk_test_' + 'x'.repeat(20) };
let calls = 0;
const request = async (url, options) => {
  calls++;
  assert.equal(url, 'https://api.stripe.com/v1/account');
  assert.equal(options.method, 'GET');
  assert.equal(options.cache, 'no-store');
  assert.equal(options.headers.Authorization, 'Bearer ' + env.STRIPE_SECRET_KEY);
  return new Response(JSON.stringify({ id: 'acct_1UPzM6P6kjGSpjgk', email: 'private@example.test', business_profile: { name: 'private' } }));
};
for (const mode of [undefined, 'production', 'development', 'Preview']) {
  assert.equal(await diagnose({ ...env, VERCEL_ENV: mode }, request), undefined);
}
assert.equal(calls, 0);
let result = await diagnose(env, request);
assert.equal(calls, 1); assert.equal(result.stripeTestAccountMatches, true);
assert.equal(result.stripeAccountCheck, 'matched');
assert.equal(result.r2Configured, false); assert.equal(result.emailConfigured, false);
for (const field of ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'CQA_COMMERCE_TEST_PROJECT']) {
  for (const value of ['', undefined, 'wrong', env[field] + '.evil.test', env[field] + '\n']) {
    result = await diagnose({ ...env, [field]: value }, request);
    assert.equal(result.stripeAccountCheck, 'skipped');
  }
}
for (const key of ['', 'sk_live_' + 'x'.repeat(20), 'sk_test_short', 'sk_test_' + 'x'.repeat(20) + '\n']) {
  result = await diagnose({ ...env, STRIPE_SECRET_KEY: key }, request);
  assert.equal(result.stripeAccountCheck, 'skipped');
}
assert.equal(calls, 1);
result = await diagnose(env, async () => new Response(JSON.stringify({ id: 'acct_wrong', email: 'private@example.test' })));
assert.equal(result.stripeAccountCheck, 'mismatched');
result = await diagnose(env, async () => new Response('secret provider error', { status: 403 }));
assert.equal(result.stripeAccountCheck, 'error');
result = await diagnose(env, async () => { throw Error('secret provider error'); });
assert.equal(result.stripeAccountCheck, 'error');
result = await diagnose({ ...env, R2_ACCOUNT_ID: 'secret-account', R2_ACCESS_KEY_ID: 'secret-key', R2_SECRET_ACCESS_KEY: 'secret-secret', R2_BUCKET: 'secret-bucket', RESEND_API_KEY: 'secret-email-key', CQA_EMAIL_FROM: 'private@example.test' }, request);
assert.equal(result.r2Configured, true); assert.equal(result.emailConfigured, true);
assert.doesNotMatch(JSON.stringify(result), /private|secret-|acct_|supabase\.co|sk_test_/);
const route = fs.readFileSync('app/api/health/route.ts', 'utf8');
assert.match(route, /process\.env\.VERCEL_ENV === "preview"\s*\? await getCqaPreviewIsolationDiagnostics/);
assert.match(route, /\.\.\.\(previewIsolation \? \{ previewIsolation \} : \{\}\)/);
console.log('PASS Preview-only read-only isolation diagnostics: genuine-account request contract, wrong-env skip, URL/key mismatch matrix, failure sanitization, configuration booleans');
