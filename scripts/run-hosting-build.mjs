/**
 * Single-flight Infomaniak build (prevents overlapping next build / git pull).
 * Clears dead locks (previous Start/Build killed mid-way).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lockPath = path.join(root, '.hosting-build.lock');
const maxWaitMs = 25 * 60 * 1000;
const staleMs = 3 * 60 * 1000;

function sleep(ms) {
  spawnSync(process.execPath, ['-e', `setTimeout(() => {}, ${ms})`], {
    stdio: 'ignore',
  });
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function clearLock(reason) {
  console.warn(`[hosting] removing build lock (${reason})`);
  try {
    fs.unlinkSync(lockPath);
  } catch {
    /* ignore */
  }
}

function isLockedByLiveProcess() {
  if (!fs.existsSync(lockPath)) return false;
  const age = Date.now() - fs.statSync(lockPath).mtimeMs;
  if (age > staleMs) {
    clearLock(`stale ${Math.round(age / 1000)}s`);
    return false;
  }
  try {
    const raw = fs.readFileSync(lockPath, 'utf8').trim();
    const pid = Number(String(raw).split(/\s+/)[0]);
    if (!Number.isFinite(pid) || pid <= 0) {
      clearLock('invalid pid');
      return false;
    }
    if (pid === process.pid) return false;
    if (!pidAlive(pid)) {
      clearLock(`dead pid ${pid}`);
      return false;
    }
    return true;
  } catch {
    clearLock('unreadable');
    return false;
  }
}

if (process.env.HOSTING_FORCE_BUILD === '1') {
  clearLock('HOSTING_FORCE_BUILD=1');
}

const started = Date.now();
while (isLockedByLiveProcess()) {
  if (Date.now() - started > maxWaitMs) {
    console.error('[hosting] timed out waiting for another build');
    process.exit(1);
  }
  console.log('[hosting] another build in progress — waiting 15s…');
  sleep(15_000);
}

fs.writeFileSync(lockPath, `${process.pid} ${new Date().toISOString()}\n`);

const steps = [
  ['node', ['scripts/pull-hosting.mjs']],
  ['node', ['scripts/ensure-hosting-env.mjs']],
  ['npx', ['--yes', 'pnpm@9.15.0', 'install']],
  ['npx', ['--yes', 'pnpm@9.15.0', '--filter', '@autocar/shared', 'build']],
  [
    'npx',
    [
      '--yes',
      'pnpm@9.15.0',
      '--filter',
      '@autocar/api',
      'exec',
      'prisma',
      'generate',
    ],
  ],
  [
    'npx',
    [
      '--yes',
      'pnpm@9.15.0',
      '--filter',
      '@autocar/api',
      'exec',
      'prisma',
      'db',
      'push',
    ],
  ],
  ['node', ['scripts/seed-once.mjs']],
  ['npx', ['--yes', 'pnpm@9.15.0', '--filter', '@autocar/api', 'build']],
  [
    'npx',
    ['--yes', 'pnpm@9.15.0', '--filter', '@autocar/web', 'build'],
  ],
];

const env = {
  ...process.env,
  NEXT_PUBLIC_API_URL: '/api',
  API_PROXY_TARGET: 'http://127.0.0.1:4000',
  NEXT_TELEMETRY_DISABLED: '1',
  NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=1536',
};

let failed = 0;
try {
  for (const [cmd, args] of steps) {
    console.log(`[hosting-build] ${cmd} ${args.join(' ')}`);
    const r = spawnSync(cmd, args, {
      cwd: root,
      env,
      stdio: 'inherit',
      shell: false,
    });
    if (r.status !== 0) {
      failed = r.status ?? 1;
      break;
    }
  }
} finally {
  try {
    fs.unlinkSync(lockPath);
  } catch {
    /* ignore */
  }
}

process.exit(failed);
