import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiEnv = path.join(root, 'apps/api/.env');
const webEnv = path.join(root, 'apps/web/.env.local');

if (!fs.existsSync(apiEnv)) {
  const secret = `carplio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  fs.writeFileSync(
    apiEnv,
    [
      'DATABASE_URL="file:./dev.db"',
      `JWT_SECRET="${secret}"`,
      'WEB_ORIGIN="https://carplio.evansng.fr"',
      'API_PORT=4000',
      '',
    ].join('\n'),
  );
  console.log('[hosting] created apps/api/.env');
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
