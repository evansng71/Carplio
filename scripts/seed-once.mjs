import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const marker = path.join(root, 'apps/api/prisma/.seeded');

if (fs.existsSync(marker)) {
  console.log('[hosting] seed already done — skip');
  process.exit(0);
}

console.log('[hosting] seeding DEMO data once…');
const r = spawnSync(
  'npx',
  ['--yes', 'pnpm@9.15.0', '--filter', '@autocar/api', 'db:seed'],
  { cwd: root, stdio: 'inherit', shell: false },
);
if (r.status !== 0) process.exit(r.status ?? 1);
fs.writeFileSync(marker, new Date().toISOString());
console.log('[hosting] seed OK');
