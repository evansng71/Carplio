/**
 * Infomaniak-safe start:
 * - Bind process.env.PORT immediately (host kills slow starts)
 * - Build detached so Infomaniak restarts do not kill next build
 * - Serve HTTP 200 "building" pages (503 triggers host restart loops)
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicPort = Number(process.env.PORT || 3000);
const apiPort = Number(process.env.API_INTERNAL_PORT || 4010);
const webPort = Number(process.env.WEB_INTERNAL_PORT || 4011);
const HOSTING_START_VERSION = '2026-04-10-detached-build';

const apiMain = path.join(root, 'apps/api/dist/main.js');
const webDir = path.join(root, 'apps/web');
const nextBuildId = path.join(webDir, '.next/BUILD_ID');
const lockPath = path.join(root, '.hosting-build.lock');
const buildLog = path.join(root, '.hosting-build.log');

/** @type {'building' | 'starting' | 'ready' | 'failed'} */
let phase = 'starting';
let buildError = '';
let childrenStarted = false;

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

function artifactsReady() {
  return fs.existsSync(apiMain) && fs.existsSync(nextBuildId);
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function lockPidAlive() {
  if (!fs.existsSync(lockPath)) return false;
  try {
    const raw = fs.readFileSync(lockPath, 'utf8').trim();
    const pid = Number(String(raw).split(/\s+/)[0]);
    if (!Number.isFinite(pid) || pid <= 0) return fs.existsSync(lockPath);
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function run(label, args, extraEnv = {}, cwd = root) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  child.on('error', (err) => {
    console.error(`[${label}] spawn error`, err);
    process.exit(1);
  });
  child.on('exit', (code, signal) => {
    console.error(`[${label}] exited code=${code} signal=${signal}`);
    process.exit(code ?? 1);
  });
  return child;
}

async function waitHttp(url, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.status > 0) return;
    } catch {
      /* retry */
    }
    await wait(500);
  }
  throw new Error(`timeout waiting for ${url}`);
}

function proxy(req, res, targetHost, targetPort) {
  const headers = { ...req.headers, host: `${targetHost}:${targetPort}` };
  const opts = {
    hostname: targetHost,
    port: targetPort,
    path: req.url,
    method: req.method,
    headers,
  };
  const p = http.request(opts, (up) => {
    res.writeHead(up.statusCode || 502, up.headers);
    up.pipe(res);
  });
  p.on('error', (err) => {
    console.error('[proxy]', err.message);
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad gateway');
  });
  req.pipe(p);
}

function ensureDetachedBuild() {
  if (artifactsReady()) return;
  if (lockPidAlive()) {
    console.log('[hosting] build already running (detached) — waiting for artifacts…');
    return;
  }
  try {
    if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
  } catch {
    /* ignore */
  }
  console.log('[hosting] starting detached build →', buildLog);
  phase = 'building';
  const out = fs.openSync(buildLog, 'a');
  const child = spawn(process.execPath, ['scripts/run-hosting-build.mjs'], {
    cwd: root,
    env: process.env,
    detached: true,
    stdio: ['ignore', out, out],
  });
  child.unref();
}

async function waitForArtifacts(maxMs = 25 * 60 * 1000) {
  const started = Date.now();
  let sawLock = lockPidAlive();
  while (!artifactsReady()) {
    if (lockPidAlive()) sawLock = true;
    if (Date.now() - started > maxMs) {
      throw new Error('timeout waiting for build artifacts (.next / api dist)');
    }
    const alive = lockPidAlive();
    // Allow ~90s for detached builder to create the lock after spawn
    if (!alive && !artifactsReady() && (sawLock || Date.now() - started > 90_000)) {
      let tail = '';
      try {
        tail = fs.readFileSync(buildLog, 'utf8').slice(-1500);
      } catch {
        /* ignore */
      }
      throw new Error(
        `build process ended without artifacts${tail ? `\n--- build log ---\n${tail}` : ''}`,
      );
    }
    phase = 'building';
    await wait(5000);
    console.log('[hosting] still building…');
  }
}

async function startBackends() {
  if (childrenStarted) return;
  childrenStarted = true;
  phase = 'starting';

  run('api', [apiMain], {
    PORT: String(apiPort),
    API_PORT: String(apiPort),
    HOST: '127.0.0.1',
  });

  const nextBin = resolveNextBin();
  run(
    'web',
    [nextBin, 'start', '-p', String(webPort), '-H', '127.0.0.1'],
    {
      PORT: String(webPort),
      NEXT_PUBLIC_API_URL: '/api',
    },
    webDir,
  );

  await waitHttp(`http://127.0.0.1:${apiPort}/api/auth/me`).catch(() =>
    waitHttp(`http://127.0.0.1:${apiPort}/api`),
  );
  await waitHttp(`http://127.0.0.1:${webPort}/login`);
  phase = 'ready';
  console.log('[hosting] backends ready');
}

async function main() {
  console.log(
    `[hosting] ${HOSTING_START_VERSION} | public :${publicPort} | api :${apiPort} | web :${webPort}`,
  );

  const server = http.createServer((req, res) => {
    const url = req.url || '/';
    if (url === '/__hosting_health' || url === '/') {
      // Always 200 on health + home during boot (Infomaniak restarts on 5xx/503)
      if (phase === 'ready' && url === '/') {
        proxy(req, res, '127.0.0.1', webPort);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      if (phase === 'ready') {
        res.end('ok');
        return;
      }
      res.end(
        `<!doctype html><meta charset="utf-8"><title>Carplio</title>
         <meta http-equiv="refresh" content="20">
         <body style="font-family:system-ui;padding:2rem;max-width:40rem">
         <h1>${phase === 'failed' ? 'Build échoué' : 'Déploiement en cours…'}</h1>
         <p>${
           phase === 'failed'
             ? buildError
             : 'Compilation en arrière-plan (5–15 min). Cette page se rafraîchit automatiquement.'
         }</p>
         <p style="color:#666">status: ${phase}</p>
         </body>`,
      );
      return;
    }
    if (phase !== 'ready') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Retry-After': '30',
      });
      res.end(
        `<!doctype html><meta charset="utf-8"><title>Carplio</title>
         <meta http-equiv="refresh" content="20">
         <body style="font-family:system-ui;padding:2rem">
         <h1>Déploiement en cours…</h1>
         <p>Merci de patienter.</p>
         </body>`,
      );
      return;
    }
    if (url.startsWith('/api/') || url === '/api') {
      proxy(req, res, '127.0.0.1', apiPort);
      return;
    }
    proxy(req, res, '127.0.0.1', webPort);
  });

  await new Promise((resolve, reject) => {
    server.listen(publicPort, '0.0.0.0', () => {
      console.log(`[hosting] listening on 0.0.0.0:${publicPort}`);
      resolve();
    });
    server.on('error', reject);
  });

  try {
    if (!artifactsReady()) {
      ensureDetachedBuild();
      await waitForArtifacts();
    }
    await startBackends();
  } catch (err) {
    phase = 'failed';
    buildError = err instanceof Error ? err.message : String(err);
    console.error('[hosting] fatal', err);
    await wait(300_000);
    process.exit(1);
  }
}

main().catch(async (err) => {
  console.error('[hosting] fatal', err);
  await wait(60_000);
  process.exit(1);
});
