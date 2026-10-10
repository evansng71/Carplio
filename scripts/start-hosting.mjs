/**
 * Infomaniak: parent process must stay alive; public PORT = Next.js.
 * API listens on internal API_PORT (default 4000); Next rewrites /api → API.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webPort = String(process.env.PORT || 3000);
const apiPort = String(process.env.API_PORT || 4000);

function resolveNextBin() {
  const candidates = [
    path.join(root, 'apps/web/node_modules/next/dist/bin/next'),
    path.join(root, 'node_modules/next/dist/bin/next'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('next binary not found — run build:hosting first');
}

function run(label, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
    shell: false,
  });
  child.on('error', (err) => {
    console.error(`[${label}] spawn error`, err);
    process.exit(1);
  });
  child.on('exit', (code, signal) => {
    console.error(`[${label}] stopped code=${code} signal=${signal}`);
    process.exit(code ?? 1);
  });
  return child;
}

console.log(`[hosting] cwd=${root}`);
console.log(`[hosting] API internal :${apiPort} | Web public :${webPort}`);

if (!fs.existsSync(path.join(root, 'apps/api/dist/main.js'))) {
  console.error('[hosting] missing apps/api/dist/main.js — rebuild first');
  process.exit(1);
}

run('api', process.execPath, ['apps/api/dist/main.js'], {
  PORT: apiPort,
  API_PORT: apiPort,
});

setTimeout(() => {
  const nextBin = resolveNextBin();
  console.log(`[hosting] next bin=${nextBin}`);
  run('web', process.execPath, [nextBin, 'start', '-p', webPort, '-H', '0.0.0.0'], {
    PORT: webPort,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api',
    API_PROXY_TARGET:
      process.env.API_PROXY_TARGET || `http://127.0.0.1:${apiPort}`,
  });
}, 2000);

// Keep parent event-loop alive (Infomaniak tracks this process)
setInterval(() => {}, 60_000);
