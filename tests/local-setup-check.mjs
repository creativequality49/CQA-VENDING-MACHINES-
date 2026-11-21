import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectLocalConfiguration, formatLocalReport } from '../scripts/local-check.mjs';

const env = {
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000', NEXTAUTH_URL: 'http://localhost:3000',
  NEXT_PUBLIC_SUPABASE_URL: 'https://isolated-example.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_local_fixture',
};
assert.equal(inspectLocalConfiguration(env, '22.13.0').ready, true);
assert.equal(inspectLocalConfiguration(env, '22.12.0').ready, false);
assert.equal(inspectLocalConfiguration({}, '24.0.0').ready, false);
assert.equal(inspectLocalConfiguration({ ...env, SUPABASE_URL: 'https://another-project.supabase.co' }).ready, false);
assert.equal(inspectLocalConfiguration({ ...env, SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL + '/' }).ready, true);
assert.equal(inspectLocalConfiguration({ ...env, SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1' }).ready, false);
for (const value of ['https://production.example', 'http://localhost.evil.test', 'http://localhost:3000/path']) {
  assert.equal(inspectLocalConfiguration({ ...env, NEXT_PUBLIC_SITE_URL: value }).ready, false);
}
const serverJwt = ['header', Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url'), 'signature'].join('.');
for (const key of ['sb_secret_do_not_expose', serverJwt]) {
  assert.equal(inspectLocalConfiguration({ ...env, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }).ready, false);
}
const marker = 'private-value-must-never-appear';
assert.ok(!formatLocalReport(inspectLocalConfiguration({ ...env, STRIPE_SECRET_KEY: marker, RESEND_API_KEY: marker })).includes(marker));
assert.equal(env.VERCEL_ENV, undefined);

// Verify the command loads .env.local from a real checkout directory and emits only status.
const directory = await mkdtemp(join(tmpdir(), 'cqa-local-setup-'));
try {
  await writeFile(join(directory, '.env.local'), Object.entries({ ...env, STRIPE_SECRET_KEY: marker }).map(([key, value]) => `${key}=${value}`).join('\n'));
  const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !key.startsWith('NEXT_') && !key.startsWith('NEXTAUTH_') && !key.startsWith('SUPABASE_') &&
    !key.startsWith('STRIPE_') && key !== '__NEXT_PROCESSED_ENV'));
  const result = spawnSync(process.execPath, [resolve('scripts/local-check.mjs')], { cwd: directory, env: cleanEnv, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /CONFIGURED NEXT_PUBLIC_SITE_URL/);
  assert.ok(!(result.stdout + result.stderr).includes(marker));
} finally { await rm(directory, { recursive: true, force: true }); }
console.log('PASS local environment loading, required configuration, server-key rejection and output redaction');
