import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const ALLOWED_ORIGINS = new Set(['https://www.creativequalityaustralia.tech']);
const COMPONENTS = ['database', 'stripe', 'legacyServiceRole', 'commerceSchema',
  'email', 'emailSender', 'platformWebhookSecret', 'connectWebhookSecret'];

export function validateConfig(config) {
  if (config.schemaVersion !== 1 || !ALLOWED_ORIGINS.has(config.origin) ||
      !Array.isArray(config.paths) || config.paths.length < 1 || config.paths.length > 10 ||
      config.paths.some(path => !/^\/(?:[a-z0-9/-]*)$/.test(path) || path.startsWith('//')) ||
      !Number.isInteger(config.timeoutMs) || config.timeoutMs < 100 || config.timeoutMs > 30000) {
    throw new Error('Invalid health configuration');
  }
  return config;
}

async function readBounded(response) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 1024 * 1024) throw new Error('Body too large');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { await reader.cancel().catch(() => {}); }
}

export async function probe(config, path, { fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  validateConfig(config);
  if (!config.paths.includes(path)) throw new Error('Probe path is not approved');
  const started = Date.now();
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetchImpl(new URL(path, config.origin), {
        method: 'GET', redirect: 'manual',
        signal: AbortSignal.timeout(config.timeoutMs),
        headers: { accept: path === '/api/health' ? 'application/json' : 'text/html', 'cache-control': 'no-cache' },
      });
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await response.body?.cancel(); await sleep(500); continue;
      }
      const body = await readBounded(response);
      const result = { path, status: 'failed', httpStatus: response.status, attempts: attempt, durationMs: Date.now() - started };
      if (path === '/api/health') {
        let data;
        try { data = JSON.parse(body); } catch { return { ...result, reason: 'invalid-health-json' }; }
        // Persist only recognised enums/booleans. Never persist arbitrary response bodies or headers.
        result.components = Object.fromEntries(COMPONENTS.map(key => [key,
          ['ok', 'missing', 'error'].includes(data?.[key]) ? data[key] : 'unknown']));
        const healthy = response.status === 200 && data?.status === 'ok' && data.launchConfigurationReady === true &&
          Object.values(result.components).every(value => value === 'ok');
        return { ...result, status: healthy ? 'passed' : 'failed', reason: healthy ? 'configuration-only' : 'configuration-degraded' };
      }
      const html = /<html[\s>]/i.test(body) && /text\/html/i.test(response.headers.get('content-type') ?? '');
      const errorPage = /<title[^>]*>[^<]*(?:404|500|not found|application error|authentication required|vercel security checkpoint)/i.test(body);
      return { ...result, status: response.status === 200 && html && !errorPage ? 'passed' : 'failed',
        reason: response.status >= 300 && response.status < 400 ? 'unexpected-redirect' : errorPage ? 'error-or-protection-page' : !html ? 'expected-html' : 'page-response' };
    } catch {
      if (attempt < 2) { await sleep(500); continue; }
      return { path, status: 'unreachable', reason: 'network-timeout-or-response-error', attempts: attempt, durationMs: Date.now() - started };
    }
  }
}

export async function checkHealth(config, dependencies) {
  validateConfig(config);
  const checks = [];
  for (const path of config.paths) checks.push(await probe(config, path, dependencies));
  return { schemaVersion: 1, observedAt: new Date().toISOString(), origin: config.origin,
    status: checks.every(check => check.status === 'passed') ? 'passed' : 'failed',
    proves: 'Public reachability and configuration only; does not verify signup, payment, fulfilment or security.', checks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = JSON.parse(await readFile(new URL('../../ops/cqa-engineer/config.json', import.meta.url), 'utf8'));
    const result = await checkHealth(config);
    const output = '.cqa-reports/health.json';
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== 'passed') process.exitCode = 1;
  } catch { console.error('Health check failed; no arbitrary response content was logged.'); process.exitCode = 1; }
}
