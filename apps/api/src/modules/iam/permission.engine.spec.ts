import { PermissionEngine } from './permission.engine';
import type { AuthContext } from './permission.engine';

function ctx(partial: Partial<AuthContext>): AuthContext {
  return {
    userId: 'u1',
    companyId: 'c1',
    email: 't@test.fr',
    status: 'active',
    depotIds: ['dA'],
    isSuperAdmin: false,
    permissionKeys: new Set(),
    deniedKeys: new Set(),
    scopesByKey: new Map(),
    ...partial,
  };
}

describe('PermissionEngine', () => {
  const engine = new PermissionEngine({} as never);

  it('refuse par défaut si permission absente', () => {
    const r = engine.authorize(ctx({}), {
      module: 'planning',
      resource: 'assignment',
      action: 'list',
    });
    expect(r.allowed).toBe(false);
  });

  it('autorise si permission présente', () => {
    const r = engine.authorize(
      ctx({
        permissionKeys: new Set(['planning:assignment:list']),
        scopesByKey: new Map([['planning:assignment:list', 'company']]),
      }),
      { module: 'planning', resource: 'assignment', action: 'list' },
    );
    expect(r.allowed).toBe(true);
  });

  it('priorise l’interdiction explicite', () => {
    const r = engine.authorize(
      ctx({
        permissionKeys: new Set(['hr:sensitive:read']),
        deniedKeys: new Set(['hr:sensitive:read']),
      }),
      { module: 'hr', resource: 'sensitive', action: 'read' },
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/Interdiction/);
  });

  it('refuse un dépôt hors périmètre', () => {
    const r = engine.authorize(
      ctx({
        depotIds: ['dA'],
        permissionKeys: new Set(['planning:assignment:assign']),
        scopesByKey: new Map([['planning:assignment:assign', 'depot']]),
      }),
      {
        module: 'planning',
        resource: 'assignment',
        action: 'assign',
        depotId: 'dB',
      },
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/Dépôt/);
  });

  it('super_admin passe', () => {
    const r = engine.authorize(ctx({ isSuperAdmin: true }), {
      module: 'billing',
      resource: 'invoice',
      action: 'download',
    });
    expect(r.allowed).toBe(true);
  });

  it('refuse compte non actif', () => {
    const r = engine.authorize(ctx({ status: 'suspended', isSuperAdmin: true }), {
      module: 'dashboard',
      resource: 'widget',
      action: 'list',
    });
    expect(r.allowed).toBe(false);
  });
});
