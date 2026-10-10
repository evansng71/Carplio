/**
 * Infomaniak often runs Start without a successful Build step.
 * If API/Next artifacts are missing, run build:hosting once before start.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiMain = path.join(root, 'apps/api/dist/main.js');
const nextBuildId = path.join(root, 'apps/web/.next/BUILD_ID');

if (fs.existsSync(apiMain) && fs.existsSync(nextBuildId)) {
  console.log('[hosting] build artifacts present');
  process.exit(0);
}

console.log(
  '[hosting] missing build artifacts — running npm run build:hosting…',
);
const r = spawnSync('npm', ['run', 'build:hosting'], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
  shell: false,
});

if (r.status !== 0) {
  console.error('[hosting] build:hosting failed');
  process.exit(r.status ?? 1);
}

if (!fs.existsSync(apiMain) || !fs.existsSync(nextBuildId)) {
  console.error(
    '[hosting] build finished but artifacts still missing (api dist / .next)',
  );
  process.exit(1);
}

console.log('[hosting] build artifacts ready');
