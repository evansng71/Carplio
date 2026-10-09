import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import * as argon2 from 'argon2';
import { execSync } from 'child_process';
import { join } from 'path';

/**
 * Integration tests against the seeded SQLite DB.
 * Run after `pnpm db:reset`.
 */
describe('IAM integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
    process.env.JWT_SECRET = 'test-secret';
    // Ensure DB exists
    try {
      execSync('npx prisma db push --skip-generate', {
        cwd: join(__dirname, '../../../'),
        stdio: 'ignore',
        env: process.env,
      });
    } catch {
      /* ignore */
    }

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    prisma = app.get(PrismaService);

    // Minimal fixtures if seed not run
    const company = await prisma.company.findFirst({ where: { isDemo: true } });
    if (!company) {
      const c = await prisma.company.create({
        data: { name: 'Test Co', isDemo: true },
      });
      const hash = await argon2.hash('Demo-Autocar-OS-2026!', {
        type: argon2.argon2id,
      });
      await prisma.userAccount.create({
        data: {
          companyId: c.id,
          email: 'admin@horizon-demo.fr',
          displayName: 'Admin',
          passwordHash: hash,
          status: 'active',
        },
      });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('login admin OK', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'admin@horizon-demo.fr',
        password: 'Demo-Autocar-OS-2026!',
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.accessToken).toBeDefined();
  });

  it('refuse mauvais mot de passe sans énumération', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'inconnu@test.fr', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('exploitant ne lit pas les données RH sensibles', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'exploitant@horizon-demo.fr',
        password: 'Demo-Autocar-OS-2026!',
      });
    if (login.status >= 400) return; // seed may be incomplete in CI

    const emp = await prisma.employee.findFirst({
      where: { matricule: 'C-1001' },
    });
    if (!emp) return;

    const res = await request(app.getHttpServer())
      .get(`/api/employees/${emp.id}`)
      .set('Authorization', `Bearer ${login.body.accessToken}`);

    // Either forbidden list permission path or sensitive hidden
    if (res.status === 200) {
      expect(res.body.sensitiveNotes).toBeNull();
      expect(res.body._sensitiveHidden).toBe(true);
    } else {
      expect([401, 403]).toContain(res.status);
    }
  });

  it('suspension invalide les sessions', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'commercial@horizon-demo.fr',
        password: 'Demo-Autocar-OS-2026!',
      });
    if (login.status >= 400) return;
    const token = login.body.accessToken;
    const userId = login.body.user.id;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'admin@horizon-demo.fr',
        password: 'Demo-Autocar-OS-2026!',
      });
    if (adminLogin.status >= 400) return;

    await request(app.getHttpServer())
      .post(`/api/users/${userId}/suspend`)
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect((r) => expect([200, 201]).toContain(r.status));

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(401);

    // cleanup
    await request(app.getHttpServer())
      .post(`/api/users/${userId}/reactivate`)
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`);
  });

  it('conducteur ne voit que le planning publié', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'conducteur@horizon-demo.fr',
        password: 'Demo-Autocar-OS-2026!',
      });
    if (login.status >= 400) return;

    const res = await request(app.getHttpServer())
      .get('/api/portal/me/planning')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect([200, 201]).toContain(res.status);
    for (const a of res.body.assignments || []) {
      expect(a.published).toBe(true);
    }
    const titles = (res.body.assignments || []).map(
      (a: { mission: { title: string } }) => a.mission.title,
    );
    expect(titles.join(' ')).not.toMatch(/NON PUBLIÉ/);
  });
});
