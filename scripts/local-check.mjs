import { pathToFileURL } from 'node:url';
import nextEnv from '@next/env';

const present = value => typeof value === 'string' && value.trim().length > 0;
const any = (env, names) => names.some(name => present(env[name]));

/** Configuration only: never contacts a provider or prints an environment value. */
export function inspectLocalConfiguration(env, nodeVersion = process.versions.node) {
  const [major, minor] = nodeVersion.split('.').map(Number);
  const checks = [];
  const add = (name, ready, required, message) => checks.push({ name, ready, required, message });
  add('Node.js', major > 22 || (major === 22 && minor >= 13), true, 'Use Node.js 22.13 or newer.');
  for (const name of ['NEXT_PUBLIC_SITE_URL', 'NEXTAUTH_URL']) {
    let local = false;
    try {
      const url = new URL(env[name]);
      local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
        ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password &&
        url.pathname === '/' && !url.search && !url.hash;
    } catch { /* Report a name, never the invalid value. */ }
    add(name, local, true, 'Set this origin to your localhost development server.');
  }
  let publicUrl = false;
  try {
    const raw = env.NEXT_PUBLIC_SUPABASE_URL;
    const url = new URL(raw);
    publicUrl = raw === raw.trim() && url.protocol === 'https:' &&
      /^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) && !url.username && !url.password &&
      !url.port && url.pathname === '/' && !url.search && !url.hash;
  } catch { /* Missing configuration is expected on a new checkout. */ }
  add('NEXT_PUBLIC_SUPABASE_URL', publicUrl, true, 'Choose an isolated Supabase project; do not copy production defaults.');
  let matchingServerUrl = !present(env.SUPABASE_URL);
  if (!matchingServerUrl && publicUrl) {
    try {
      const server = new URL(env.SUPABASE_URL);
      matchingServerUrl = env.SUPABASE_URL === env.SUPABASE_URL.trim() &&
        server.origin === new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin &&
        !server.username && !server.password && !server.port && server.pathname === '/' && !server.search && !server.hash;
    } catch { /* Keep mismatched server/browser projects blocked in preflight. */ }
  }
  add('Supabase server/browser project alignment', matchingServerUrl, true,
    'SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL must identify the same project.');
  const publicKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let publicKeySafe = present(publicKey) && publicKey === publicKey.trim() && !publicKey.startsWith('sb_secret_');
  // Legacy JWT keys must not carry the server-only service_role claim.
  if (publicKeySafe && publicKey.split('.').length === 3) {
    try { publicKeySafe = JSON.parse(Buffer.from(publicKey.split('.')[1], 'base64url').toString()).role === 'anon'; }
    catch { publicKeySafe = false; }
  } else if (publicKeySafe) publicKeySafe = publicKey.startsWith('sb_publishable_');
  add('Supabase browser key', publicKeySafe, true, 'Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or a legacy anon key; never a server secret.');
  add('Supabase server key', any(env, ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY']), false,
    'Server-backed account, entitlement and data operations require a server-only key.');
  add('Stripe', ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'].every(name => present(env[name])), false,
    'Checkout and webhook verification need real service configuration; existing launch gates still apply.');
  add('Private downloads', ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'].every(name => present(env[name])), false,
    'Private object storage is required for paid download delivery.');
  add('AI generation', any(env, ['CQA_CHAT_API_KEY', 'OPENAI_API_KEY']), false,
    'Generation requires an approved, configured provider.');
  add('Email', present(env.RESEND_API_KEY), false, 'Email delivery requires provider credentials and a verified sender.');
  add('Age assurance', false, false,
    'Provider verdict and callback/session validation remain unverified; configuration alone does not prove this flow.');
  return { ready: checks.filter(check => check.required).every(check => check.ready), checks };
}

export function loadLocalEnvironment(directory = process.cwd()) {
  let failed = false;
  nextEnv.loadEnvConfig(directory, true, { info() {}, error() { failed = true; } });
  return !failed;
}

export function formatLocalReport(report) {
  return [
    'Local configuration check (no network requests or changes)',
    ...report.checks.map(check => `${check.ready ? 'CONFIGURED' : check.required ? 'REQUIRED' : 'UNVERIFIED'} ${check.name}${check.ready ? '' : `: ${check.message}`}`),
    'Configuration presence is not proof of working integrations or database isolation.',
    'Payments remain subject to the existing release gates. No flags are changed.',
    'Database scripts under database/ require reviewed setup; no Prisma schema or seed is shipped.',
    'Legacy NextAuth has no sign-in providers configured; setting a secret alone does not enable /admin.',
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const loaded = loadLocalEnvironment();
  const report = inspectLocalConfiguration(process.env);
  console.log(formatLocalReport(report));
  if (!loaded) console.error('An environment file could not be loaded. Check its syntax locally.');
  if (!report.ready || !loaded) process.exitCode = 1;
}
