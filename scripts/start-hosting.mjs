/**
 * Infomaniak-safe start:
 * - Bind PORT immediately
 * - Do NOT compile here (Infomaniak restarts Start ~45s and kills process groups)
 * - Wait for artifacts produced by Infomaniak Build command, then start API+Next
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
const HOSTING_START_VERSION = '2026-04-10-wait-for-build';

const apiMain = path.join(root, 'apps/api/dist/main.js');
const webDir = path.join(root, 'apps/web');
const nextBuildId = path.join(webDir, '.next/BUILD_ID');

/** @type {'waiting-build' | 'starting' | 'ready' | 'failed'} */
let phase = 'starting';
let statusDetail =
  'En attente du Build Infomaniak (npm run build:hosting). Ne pas redémarrer en boucle.';
let childrenStarted = false;

function resolveNextBin() {
  const candidates = [
    path.join(root, 'apps/web/node_modules/next/dist/bin/next'),
    path.join(root, 'node_modules/next/dist/bin/next'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('next binary not found');
}

function artifactsReady() {
  return fs.existsSync(apiMain) && fs.existsSync(nextBuildId);
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

function htmlPage() {
  return `<!doctype html><meta charset="utf-8"><title>Carplio</title>
<meta http-equiv="refresh" content="15">
<body style="font-family:system-ui;padding:2rem;max-width:42rem;line-height:1.5">
<h1>Déploiement Carplio</h1>
<p><strong>${statusDetail}</strong></p>
<ol>
<li>Dans Infomaniak : <b>Arrêter</b> ce site</li>
<li>Activer la commande de build : <code>npm run build:hosting</code></li>
<li>Lancer le <b>Build</b> et attendre la fin (plusieurs minutes)</li>
<li>Remettre Start : <code>npm run start:hosting</code> puis Démarrer</li>
</ol>
<p style="color:#666">status: ${phase} · ${HOSTING_START_VERSION}</p>
</body>`;
}

async function waitForArtifacts() {
  phase = 'waiting-build';
  console.log(
    '[hosting] missing .next — waiting for Infomaniak Build (npm run build:hosting). Start will NOT compile.',
  );
  while (!artifactsReady()) {
    await wait(10_000);
    console.log('[hosting] still waiting for Build artifacts…');
  }
  console.log('[hosting] artifacts found');
}

async function startBackends() {
  if (childrenStarted) return;
  childrenStarted = true;
  phase = 'starting';
  statusDetail = 'Démarrage API + Next…';

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
  statusDetail = 'ok';
  console.log('[hosting] backends ready');
}

async function main() {
  console.log(
    `[hosting] ${HOSTING_START_VERSION} | public :${publicPort} | api :${apiPort} | web :${webPort}`,
  );

  const server = http.createServer((req, res) => {
    const url = req.url || '/';
    if (phase !== 'ready') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlPage());
      return;
    }
    if (url === '/__hosting_health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
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
      await waitForArtifacts();
    }
    await startBackends();
  } catch (err) {
    phase = 'failed';
    statusDetail = err instanceof Error ? err.message : String(err);
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
