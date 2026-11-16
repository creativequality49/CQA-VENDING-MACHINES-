import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const validate = new Function(compile('lib/cqa-supabase-config.ts') + ';return requireCqaSupabaseUrl;')();
const prod = 'https://rjxiuukphwybujuclenn.supabase.co';
const test = 'https://ndzmlywsuywkhgqdbzft.supabase.co';
for (const url of [prod, test, prod + '/', test + '/']) assert.equal(validate(url), url.replace(/\/$/, ''));
for (const url of [undefined, '', ' ' + test, test + '\n', 'http://ndzmlywsuywkhgqdbzft.supabase.co', test + '.evil.test', test + '/path', test + '?x=1', test + '#x', 'https://user:pass@ndzmlywsuywkhgqdbzft.supabase.co', 'https://ndzmlywsuywkhgqdbzft.supabase.co:8443']) assert.throws(() => validate(url), /CQA Supabase URL/);
const load = (file, env) => new Function('process', 'requireCqaSupabaseUrl', 'createClient', compile(file) + ';return ' + (file.includes('marketplace') ? '{getPublicSupabaseClient,getBrowserSupabaseClient,getAuthenticatedSupabaseClient}' : '{getCqaSupabaseAdmin}') + ';')({ env }, validate, (url, key, options) => ({ url, key, options }));
for (const alias of ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
  const clients = load('lib/cqa-marketplace.ts', { NEXT_PUBLIC_SUPABASE_URL: test, [alias]: 'public-fixture' });
  assert.equal(clients.getPublicSupabaseClient().url, test);
  assert.equal(clients.getBrowserSupabaseClient().key, 'public-fixture');
  assert.equal(clients.getAuthenticatedSupabaseClient('token').options.global.headers.Authorization, 'Bearer token');
}
for (const env of [{}, { NEXT_PUBLIC_SUPABASE_URL: test }, { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-fixture' }, { NEXT_PUBLIC_SUPABASE_URL: test, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_server-only' }]) {
  const clients = load('lib/cqa-marketplace.ts', env);
  for (const fn of Object.values(clients)) assert.throws(() => fn('token'), /CQA Supabase/);
}
for (const alias of ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY']) {
  assert.equal(load('lib/cqa-supabase-admin.ts', { SUPABASE_URL: test, [alias]: 'server-fixture' }).getCqaSupabaseAdmin().url, test);
  assert.equal(load('lib/cqa-supabase-admin.ts', { NEXT_PUBLIC_SUPABASE_URL: prod, [alias]: 'server-fixture' }).getCqaSupabaseAdmin().url, prod);
}
assert.throws(() => load('lib/cqa-supabase-admin.ts', { SUPABASE_SECRET_KEY: 'server-fixture' }).getCqaSupabaseAdmin(), /CQA Supabase/);
assert.throws(() => load('lib/cqa-supabase-admin.ts', { SUPABASE_URL: test }).getCqaSupabaseAdmin(), /CQA Supabase/);
console.log('PASS explicit Supabase configuration: valid production/test URLs, bad/missing URL and public key fail closed, aliases and bearer binding retained, no implicit project');
