/**
 * On Infomaniak, restart does NOT update source. Pull latest main before build.
 * No-op locally / outside Infomaniak hosting paths.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const onInfomaniak =
  root.includes('/srv/customer/sites/') ||
  process.env.INFOMANIAK_HOSTING === '1';

if (!onInfomaniak) {
  process.exit(0);
}

if (!fs.existsSync(path.join(root, '.git'))) {
  console.warn('[hosting] no .git — skip pull (deploy via Git or ZIP first)');
  process.exit(0);
}

console.log('[hosting] git pull --ff-only (Infomaniak)…');
const r = spawnSync('git', ['pull', '--ff-only', 'origin', 'main'], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});

if (r.status !== 0) {
  // Retry without specifying remote/branch (uses tracking branch)
  const r2 = spawnSync('git', ['pull', '--ff-only'], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  if (r2.status !== 0) {
    console.error('[hosting] git pull failed — fix Git remote on Infomaniak');
    process.exit(r2.status ?? 1);
  }
}

console.log('[hosting] source updated');
