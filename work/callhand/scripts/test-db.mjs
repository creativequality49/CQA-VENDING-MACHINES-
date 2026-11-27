// Applies every Supabase migration to a throwaway local PostgreSQL cluster and
// runs the SQL tests in tests/db/*.test.sql against it (RLS, grants and
// cross-business isolation). Needs PostgreSQL 15+ server binaries (pgcrypto
// ships with them). Nothing touches a real Supabase project.
//
//   npm run test:db            # auto-detects /usr/lib/postgresql/<ver>/bin
//   PG_BIN=/path/to/bin npm run test:db
//   npm run test:db -- --keep  # leave the cluster running for inspection
import { spawnSync } from 'node:child_process';
import { chownSync, existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const testsDir = path.join(root, 'tests', 'db');
const keep = process.argv.includes('--keep');

function findPgBin() {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  const base = '/usr/lib/postgresql';
  if (!existsSync(base)) return null;
  const versions = readdirSync(base).filter((v) => /^\d+$/.test(v)).sort((a, b) => Number(b) - Number(a));
  return versions.map((v) => path.join(base, v, 'bin')).find((dir) => existsSync(path.join(dir, 'initdb'))) ?? null;
}

const pgBin = findPgBin();
if (!pgBin) {
  console.error('PostgreSQL server binaries not found. Install PostgreSQL 15+ or set PG_BIN.');
  process.exit(2);
}

// initdb/postgres refuse to run as root; drop to the postgres OS user there.
const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;
const serverCmd = (bin, args) => (asRoot ? ['runuser', ['-u', 'postgres', '--', path.join(pgBin, bin), ...args]] : [path.join(pgBin, bin), args]);

const workDir = mkdtempSync(path.join(tmpdir(), 'callhand-pg-'));
const dataDir = path.join(workDir, 'data');
const port = String(54000 + Math.floor(Math.random() * 900));
if (asRoot) {
  const ids = spawnSync('id', ['-u', 'postgres'], { encoding: 'utf8' });
  const gids = spawnSync('id', ['-g', 'postgres'], { encoding: 'utf8' });
  chownSync(workDir, Number(ids.stdout.trim()), Number(gids.stdout.trim()));
}

function run(cmd, args, { quiet = false } = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    if (!quiet) process.stderr.write(`${result.stdout || ''}${result.stderr || ''}`);
    throw new Error(`${path.basename(args[2] ?? cmd)} exited with ${result.status}`);
  }
  return result;
}

const psqlBin = existsSync(path.join(pgBin, 'psql')) ? path.join(pgBin, 'psql') : 'psql';
function psqlFile(file, database = TEMPLATE_DB) {
  return spawnSync(psqlBin, ['-h', workDir, '-p', port, '-U', 'postgres', '-d', database, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', file], { encoding: 'utf8' });
}
function psqlCommand(command) {
  return spawnSync(psqlBin, ['-h', workDir, '-p', port, '-U', 'postgres', '-d', 'postgres', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c', command], { encoding: 'utf8' });
}
// Migrations are applied once to a template; each test file then gets its own
// fresh copy, so tests cannot depend on (or break) each other's data.
const TEMPLATE_DB = 'callhand_migrated';

let started = false;
let failed = false;
try {
  run(...serverCmd('initdb', ['-D', dataDir, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--no-sync']), { quiet: false });
  run(...serverCmd('pg_ctl', ['-D', dataDir, '-l', path.join(workDir, 'server.log'), '-w', '-o', `-k ${workDir} -p ${port} -c listen_addresses='' -c fsync=off`, 'start']));
  started = true;

  const created = psqlCommand(`create database ${TEMPLATE_DB}`);
  if (created.status !== 0) throw new Error(`could not create the template database:\n${created.stderr}`);
  const stub = psqlFile(path.join(testsDir, 'supabase-platform-stub.sql'));
  if (stub.status !== 0) throw new Error(`platform stub failed:\n${stub.stderr}`);

  const migrations = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of migrations) {
    const result = psqlFile(path.join(migrationsDir, file));
    if (result.status !== 0) throw new Error(`migration ${file} failed:\n${result.stderr}`);
  }
  console.log(`applied ${migrations.length} migrations`);

  const tests = readdirSync(testsDir).filter((f) => f.endsWith('.test.sql')).sort();
  for (const [index, file] of tests.entries()) {
    const database = `callhand_test_${index}`;
    const copy = psqlCommand(`create database ${database} template ${TEMPLATE_DB}`);
    if (copy.status !== 0) throw new Error(`could not create ${database}:\n${copy.stderr}`);
    const result = psqlFile(path.join(testsDir, file), database);
    // Probes report through NOTICEs ("psql:<file>:<line>: NOTICE:  PASS ...").
    const outcomes = `${result.stdout || ''}\n${result.stderr || ''}`.split('\n')
      .map((line) => line.match(/NOTICE:\s+((?:PASS|FAIL)\b.*)$/)?.[1])
      .filter((line) => line !== undefined);
    const failures = outcomes.filter((line) => line.startsWith('FAIL'));
    console.log(`\n${file}`);
    for (const line of outcomes) console.log(`  ${line}`);
    if (result.status !== 0) {
      failed = true;
      const errors = (result.stderr || '').split('\n').filter((line) => /ERROR|FATAL/.test(line)).join('\n');
      console.error(`  ERROR: the test file stopped early\n${errors}`);
    } else if (outcomes.length === 0) {
      failed = true;
      console.error('  ERROR: no PASS/FAIL results were reported');
    }
    if (failures.length) failed = true;
    console.log(`  ${outcomes.length - failures.length} passed, ${failures.length} failed`);
  }
} catch (error) {
  failed = true;
  console.error(String(error instanceof Error ? error.message : error));
} finally {
  if (keep && started) {
    console.log(`\ncluster left running: psql -h ${workDir} -p ${port} -U postgres -d ${TEMPLATE_DB}  (test copies: callhand_test_<n>)`);
    console.log(`stop with: ${asRoot ? 'runuser -u postgres -- ' : ''}${path.join(pgBin, 'pg_ctl')} -D ${dataDir} stop`);
    process.exit(failed ? 1 : 0);
  }
  if (started) spawnSync(...serverCmd('pg_ctl', ['-D', dataDir, '-m', 'immediate', '-w', 'stop']), { encoding: 'utf8' });
  rmSync(workDir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
