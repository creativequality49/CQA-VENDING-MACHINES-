import { mkdtempSync, cpSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const revision = '11ca2b3bdd555649f278ee348c32a9302b24dcf1';
const root = fileURLToPath(new URL('../', import.meta.url));
const target = resolve(root, '.agents/skills/ui-ux-pro-max-upstream');
if (existsSync(target)) throw new Error('Upstream skill already exists; inspect and remove manually before reinstalling.');
const temp = mkdtempSync(join(tmpdir(), 'cqa-uiux-'));
const git = (...args) => execFileSync('git', args, { cwd: temp, encoding: 'utf8', stdio: ['ignore','pipe','inherit'] });
try {
  git('init');
  git('fetch','--depth=1','https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git',revision);
  if (git('rev-parse','FETCH_HEAD').trim() !== revision) throw new Error('Revision mismatch');
  git('checkout','--detach',revision);
  cpSync(join(temp,'.claude/skills/ui-ux-pro-max'),target,{recursive:true,errorOnExist:true,force:false});
  cpSync(join(temp,'LICENSE'),join(target,'LICENSE'));
  writeFileSync(join(target,'UPSTREAM_REVISION'),revision+'\\n');
  console.log('Pinned upstream payload copied. Review before executing Python.');
} finally { rmSync(temp,{recursive:true,force:true}); }
