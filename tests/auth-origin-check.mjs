import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const code = ts.transpileModule(fs.readFileSync('lib/cqa-auth-origin.ts', 'utf8').replace(/export /g, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const production = 'https://www.creativequalityaustralia.tech';
const preview = 'https://cqa-vending-machines-fixture-creativequality.vercel.app';
const sandbox = { NEXT_PUBLIC_SITE_URL: preview, NEXT_PUBLIC_SUPABASE_URL: 'https://ndzmlywsuywkhgqdbzft.supabase.co' };
const origin = (url, env = {}) => new Function('window', 'process', code + ';return getCqaAuthOrigin();')(url ? { location: { origin: url } } : undefined, { env });
assert.equal(origin(undefined), production);
for (const url of [production, 'https://creativequalityaustralia.tech', 'https://cqavmachine.live', 'https://localhost.evil.test']) assert.equal(origin(url), production);
for (const url of ['http://localhost:3000', 'http://127.0.0.1:3001']) assert.equal(origin(url), url);
assert.equal(origin(preview, sandbox), preview);
assert.equal(origin(preview, { NEXT_PUBLIC_VERCEL_URL: new URL(preview).host, NEXT_PUBLIC_SUPABASE_URL: sandbox.NEXT_PUBLIC_SUPABASE_URL }), preview);
assert.throws(() => origin(preview, { NEXT_PUBLIC_VERCEL_URL: "other.vercel.app", NEXT_PUBLIC_SUPABASE_URL: sandbox.NEXT_PUBLIC_SUPABASE_URL }), /test deployment/);
assert.equal(origin(preview, { ...sandbox, NEXT_PUBLIC_SUPABASE_URL: sandbox.NEXT_PUBLIC_SUPABASE_URL + '/' }), preview);
for (const env of [{}, { ...sandbox, NEXT_PUBLIC_SITE_URL: production }, { ...sandbox, NEXT_PUBLIC_SUPABASE_URL: 'https://rjxiuukphwybujuclenn.supabase.co' }, { ...sandbox, NEXT_PUBLIC_SITE_URL: preview + '/path' }]) assert.throws(() => origin(preview, env), /test deployment/);
assert.throws(() => origin(production, sandbox), /test deployment/);
assert.throws(() => origin('https://other-team.vercel.app', sandbox), /test deployment/);
assert.throws(() => origin(preview.replace('https:', 'http:'), sandbox), /test deployment/);
console.log('PASS canonical production and exact localhost origins; isolated Preview links stay on configured Preview; mismapped Preview fails closed before email');

for (const env of [{ NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' }, { NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3000' }, { NEXT_PUBLIC_SITE_URL: 'https://evil.test' }]) {
  assert.equal(origin(production, env), production, 'hosted email redirects cannot inherit a bad local site configuration');
}
for (const env of [{ ...sandbox, NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' }, { ...sandbox, NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3000' }]) {
  assert.throws(() => origin(preview, env), /test deployment/, 'mismapped Preview must refuse email rather than redirect to localhost');
}
const siteCode = ts.transpileModule(fs.readFileSync('lib/cqa-site-url.ts', 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const site = (env, request) => new Function('process', siteCode + ';return getCqaSiteUrl(arguments[1]);')({ env }, request ? new Request(request) : undefined);
assert.equal(site({ VERCEL_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' }, production), production);
for (const configured of ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000']) {
  assert.throws(() => site({ NEXT_PUBLIC_SITE_URL: configured }, production), /localhost/);
  assert.throws(() => site({ VERCEL_ENV: 'preview', NEXT_PUBLIC_SITE_URL: configured }), /localhost/);
  assert.equal(site({ NEXT_PUBLIC_SITE_URL: configured }, configured), configured);
}
assert.equal(site({}, preview), preview);
assert.throws(() => site({ NEXT_PUBLIC_SITE_URL: 'http://hosted.example.test' }), /HTTPS/);
assert.equal(site({ NEXT_PUBLIC_SITE_URL: preview }, production), preview);
console.log('PASS hosted email and server links cannot redirect to localhost from bad site configuration; local development stays local');
