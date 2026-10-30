import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readdir, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { repo: { type: 'string' } } });
const repoRoot = await realpath(values.repo ?? process.cwd());
const harnessRoot = fileURLToPath(new URL('../../', import.meta.url));
const reportRoot = join(harnessRoot, '.cqa-reports');
function gitValue(cwd, args) {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}
const inspectedCommit = gitValue(repoRoot, ['rev-parse', 'HEAD']);
const startStatus = gitValue(repoRoot, ['status', '--porcelain', '--untracked-files=normal']);

// Run repository regressions, including those missing from package.json, exactly once.
const files = (await readdir(join(repoRoot, 'tests'))).sort();
const commands = [
  { name: 'engineer-tests', args: ['--test', ...((await readdir(join(harnessRoot, 'tests/cqa-engineer'))).filter(name => name.endsWith('.test.mjs')).map(name => join(harnessRoot, 'tests/cqa-engineer', name)))] },
  ...files.filter(name => name.endsWith('-check.mjs')).map(name => ({ name, args: [`tests/${name}`] })),
  ...files.filter(name => name.endsWith('-check.ts') || name.endsWith('.test.ts')).map(name => ({ name, args: ['--import', 'tsx', '--test', `tests/${name}`] })),
  { name: 'typecheck', args: ['node_modules/typescript/bin/tsc', '--noEmit'], timeoutMs: 180000 },
  { name: 'lint', args: ['node_modules/eslint/bin/eslint.js', '.'], timeoutMs: 180000 },
  { name: 'production-build', args: ['node_modules/next/dist/bin/next', 'build'], timeoutMs: 600000 },
];
await mkdir(join(reportRoot, 'checks'), { recursive: true });
const results = [];
for (const command of commands) {
  const started = Date.now();
  // Logs stay local; public JSON contains names, durations and exit codes only.
  const result = await new Promise(resolve => {
    const child = spawn(process.execPath, command.args, { cwd: repoRoot, shell: false, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } });
    let output = '', timedOut = false, spawnError = false;
    const collect = chunk => { if (output.length < 200000) output += chunk.toString().slice(0, 200000 - output.length); };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, command.timeoutMs ?? 60000);
    child.on('error', () => { spawnError = true; });
    child.on('close', code => { clearTimeout(timer); resolve({ name: command.name,
      status: !spawnError && !timedOut && code === 0 ? 'passed' : 'failed',
      exitCode: code, timedOut, durationMs: Date.now() - started, output }); });
  });
  await writeFile(join(reportRoot, 'checks', `${command.name}.log`), result.output);
  const { output: _output, ...summary } = result;
  results.push(summary); console.log(`${summary.status.toUpperCase()} ${summary.name} (${summary.durationMs}ms)`);
}
const report = { schemaVersion: 1, observedAt: new Date().toISOString(),
  commit: inspectedCommit, harnessCommit: gitValue(harnessRoot, ['rev-parse', 'HEAD']),
  worktreeDirtyAtStart: startStatus === null ? null : startStatus.length > 0,
  headChangedDuringChecks: gitValue(repoRoot, ['rev-parse', 'HEAD']) !== inspectedCommit,
  node: process.version,
  status: results.every(result => result.status === 'passed') && inspectedCommit &&
    gitValue(repoRoot, ['rev-parse', 'HEAD']) === inspectedCommit ? 'passed' : 'failed',
  proves: 'Local regressions, TypeScript and compilation; external integration evidence is required separately.', results };
await writeFile(join(reportRoot, 'checks.json'), JSON.stringify(report, null, 2) + '\n');
if (process.env.GITHUB_STEP_SUMMARY) {
  const rows = results.map(result => `| ${result.name} | ${result.status} | ${result.exitCode ?? 'none'} |`).join('\n');
  await writeFile(process.env.GITHUB_STEP_SUMMARY, `## CQA engineer checks\n\n| Check | Result | Exit |\n|---|---|---|\n${rows}\n\nExternal commerce tests remain separate.\n`, { flag: 'a' });
}
if (report.status !== 'passed') process.exitCode = 1;
