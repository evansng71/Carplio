import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActionKey, ModuleKey, ScopeKey } from '@autocar/shared';

export type AuthContext = {
  userId: string;
  companyId: string;
  email: string;
  status: string;
  depotIds: string[];
  isSuperAdmin: boolean;
  permissionKeys: Set<string>;
  deniedKeys: Set<string>;
  scopesByKey: Map<string, ScopeKey>;
};

export type AuthorizeInput = {
  module: ModuleKey | string;
  resource: string;
  action: ActionKey | string;
  depotId?: string | null;
  companyId?: string;
  selfOnlyUserId?: string;
};

@Injectable()
export class PermissionEngine {
  constructor(private readonly prisma: PrismaService) {}

  async loadContext(userId: string): Promise<AuthContext | null> {
    const user = await this.prisma.userAccount.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            group: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });
    if (!user || user.status !== 'active') return null;

    const permissionKeys = new Set<string>();
    const deniedKeys = new Set<string>();
    const scopesByKey = new Map<string, ScopeKey>();
    const depotIds = new Set<string>();
    let isSuperAdmin = false;

    for (const m of user.memberships) {
      if (m.depotId) depotIds.add(m.depotId);
      if (m.group.key === 'super_admin') isSuperAdmin = true;
      for (const gp of m.group.permissions) {
        const key = gp.permission.key;
        if (gp.denied) {
          deniedKeys.add(key);
        } else {
          permissionKeys.add(key);
          const existing = scopesByKey.get(key);
          const scope = gp.scope as ScopeKey;
          if (!existing || this.scopeRank(scope) > this.scopeRank(existing)) {
            scopesByKey.set(key, scope);
          }
        }
      }
    }

    return {
      userId: user.id,
      companyId: user.companyId,
      email: user.email,
      status: user.status,
      depotIds: [...depotIds],
      isSuperAdmin,
      permissionKeys,
      deniedKeys,
      scopesByKey,
    };
  }

  private scopeRank(scope: ScopeKey): number {
    const order: ScopeKey[] = [
      'self',
      'depot',
      'authorized_depots',
      'company',
      'all_companies',
    ];
    return order.indexOf(scope);
  }

  authorize(ctx: AuthContext, input: AuthorizeInput): {
    allowed: boolean;
    reason: string;
  } {
    if (ctx.status !== 'active') {
      return { allowed: false, reason: 'Compte non actif' };
    }
    if (ctx.isSuperAdmin) {
      return { allowed: true, reason: 'super_admin' };
    }

    const key = `${input.module}:${input.resource}:${input.action}`;
    if (ctx.deniedKeys.has(key)) {
      return { allowed: false, reason: `Interdiction explicite: ${key}` };
    }
    if (!ctx.permissionKeys.has(key)) {
      return { allowed: false, reason: `Permission absente (refus par défaut): ${key}` };
    }

    if (input.companyId && input.companyId !== ctx.companyId) {
      const scope = ctx.scopesByKey.get(key) || 'company';
      if (scope !== 'all_companies') {
        return { allowed: false, reason: 'Société hors périmètre' };
      }
    }

    const scope = ctx.scopesByKey.get(key) || 'company';
    if (scope === 'self' && input.selfOnlyUserId && input.selfOnlyUserId !== ctx.userId) {
      return { allowed: false, reason: 'Périmètre soi uniquement' };
    }
    if (
      (scope === 'depot' || scope === 'authorized_depots') &&
      input.depotId &&
      !ctx.depotIds.includes(input.depotId)
    ) {
      return { allowed: false, reason: 'Dépôt non autorisé' };
    }

    return { allowed: true, reason: `Groupe permission ${key} scope=${scope}` };
  }
}
