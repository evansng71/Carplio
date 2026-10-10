import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiEnv = path.join(root, 'apps/api/.env');
const webEnv = path.join(root, 'apps/web/.env.local');

const siteUrl =
  process.env.WEB_ORIGIN ||
  process.env.SITE_URL ||
  'https://carplio.evansng.fr';

if (!fs.existsSync(apiEnv)) {
  const secret = `carplio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  fs.writeFileSync(
    apiEnv,
    [
      'DATABASE_URL="file:./dev.db"',
      `JWT_SECRET="${secret}"`,
      `WEB_ORIGIN="${siteUrl}"`,
      'API_PORT=4000',
      '',
    ].join('\n'),
  );
  console.log('[hosting] created apps/api/.env');
} else {
  // Ensure WEB_ORIGIN includes the public site (CORS)
  let txt = fs.readFileSync(apiEnv, 'utf8');
  if (!txt.includes('WEB_ORIGIN=')) {
    txt += `\nWEB_ORIGIN="${siteUrl}"\n`;
    fs.writeFileSync(apiEnv, txt);
  }
}

if (!fs.existsSync(webEnv)) {
  fs.writeFileSync(
    webEnv,
    ['NEXT_PUBLIC_API_URL=/api', 'API_PROXY_TARGET=http://127.0.0.1:4000', ''].join(
      '\n',
    ),
  );
  console.log('[hosting] created apps/web/.env.local');
}
