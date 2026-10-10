/**
 * Infomaniak-safe start:
 * - Public process listens ONLY on process.env.PORT (required by host)
 * - API + Next bind on 127.0.0.1 internal ports
 * - Parent reverse-proxies /api → API, everything else → Next
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
const HOSTING_START_VERSION = '2026-04-10-start-only';

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

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitHttp(url, tries = 40) {
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

async function main() {
  console.log(
    `[hosting] ${HOSTING_START_VERSION} | public :${publicPort} | api :${apiPort} | web :${webPort}`,
  );

  const apiMain = path.join(root, 'apps/api/dist/main.js');
  const webDir = path.join(root, 'apps/web');
  const nextBuildId = path.join(webDir, '.next/BUILD_ID');
  if (!fs.existsSync(apiMain) || !fs.existsSync(nextBuildId)) {
    throw new Error(
      'missing build artifacts — run Infomaniak Build once: npm run build:hosting (do NOT put build in Start)',
    );
  }

  run('api', [apiMain], {
    PORT: String(apiPort),
    API_PORT: String(apiPort),
    HOST: '127.0.0.1',
  });

  const nextBin = resolveNextBin();
  // cwd must be apps/web so Next finds .next there
  run(
    'web',
    [nextBin, 'start', '-p', String(webPort), '-H', '127.0.0.1'],
    {
      PORT: String(webPort),
      NEXT_PUBLIC_API_URL: '/api',
    },
    webDir,
  );

  // Nest health: any response means listen OK (401 on /api/auth/me is fine)
  await waitHttp(`http://127.0.0.1:${apiPort}/api/auth/me`).catch(() =>
    waitHttp(`http://127.0.0.1:${apiPort}/api`),
  );
  await waitHttp(`http://127.0.0.1:${webPort}/login`);

  const server = http.createServer((req, res) => {
    const url = req.url || '/';
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

  server.listen(publicPort, '0.0.0.0', () => {
    console.log(`[hosting] listening on 0.0.0.0:${publicPort}`);
  });
}

main().catch((err) => {
  console.error('[hosting] fatal', err);
  process.exit(1);
});
