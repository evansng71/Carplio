/**
 * Infomaniak / PaaS: one public PORT for Next.js, API on internal 4000.
 * Next rewrites /api → http://127.0.0.1:4000
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
    shell: process.platform === 'win32',
  });
  child.on('exit', (code, signal) => {
    console.error(`[${label}] stopped code=${code} signal=${signal}`);
    process.exit(code ?? 1);
  });
  return child;
}

console.log(`[hosting] API :${apiPort} | Web :${webPort}`);

run('api', 'node', ['apps/api/dist/main.js'], {
  PORT: apiPort,
  API_PORT: apiPort,
});

// Small delay so API binds before first proxied requests
setTimeout(() => {
  run('web', 'node', [resolveNextBin(), 'start', '-p', webPort, '-H', '0.0.0.0'], {
    PORT: webPort,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api',
    API_PROXY_TARGET:
      process.env.API_PROXY_TARGET || `http://127.0.0.1:${apiPort}`,
  });
}, 1500);
