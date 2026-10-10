import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  const webOrigins = new Set(
    (
      process.env.WEB_ORIGIN ||
      'http://localhost:3100,http://127.0.0.1:3100'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  // Always accept local web hosts in development
  webOrigins.add('http://localhost:3100');
  webOrigins.add('http://127.0.0.1:3100');
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin || webOrigins.has(origin)) return cb(null, true);
      // never throw — throwing becomes HTTP 500 for the browser
      return cb(null, false);
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.setGlobalPrefix('api');
  // Infomaniak / PaaS: prefer PORT; local default API_PORT=4000
  const port = Number(process.env.PORT || process.env.API_PORT || 4000);
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);
  // eslint-disable-next-line no-console
  console.log(`AUTOCAR OS API listening on http://${host}:${port}/api`);
}

bootstrap();
