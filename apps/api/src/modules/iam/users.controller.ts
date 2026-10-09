import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import { PermissionEngine } from './permission.engine';
import { JwtAuthGuard, PermissionsGuard } from './guards';
import { CurrentUser, RequirePermission } from './decorators';
import type { RequestUser } from './auth.types';

class TestPermissionDto {
  @IsString()
  userId!: string;
  @IsString()
  module!: string;
  @IsString()
  resource!: string;
  @IsString()
  action!: string;
  @IsOptional()
  @IsString()
  depotId?: string;
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly engine: PermissionEngine,
  ) {}

  @Get('users')
  @RequirePermission('users', 'account', 'list')
  listUsers(@CurrentUser() user: RequestUser) {
    return this.prisma.userAccount.findMany({
      where: { companyId: user.companyId },
      include: {
        memberships: { include: { group: true, depot: true } },
        employeeLink: { include: { employee: true } },
        sessions: {
          where: { revokedAt: null, expiresAt: { gt: new Date() } },
          select: { id: true, createdAt: true, userAgent: true, ip: true },
        },
      },
      orderBy: { displayName: 'asc' },
    });
  }

  @Get('groups')
  @RequirePermission('groups', 'group', 'list')
  listGroups(@CurrentUser() user: RequestUser) {
    return this.prisma.group.findMany({
      where: { companyId: user.companyId, archivedAt: null },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { memberships: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  @Get('permissions')
  @RequirePermission('groups', 'group', 'list')
  listPermissions(@CurrentUser() user: RequestUser) {
    return this.prisma.permission.findMany({
      where: { OR: [{ companyId: null }, { companyId: user.companyId }] },
      orderBy: [{ module: 'asc' }, { resource: 'asc' }, { action: 'asc' }],
    });
  }

  @Post('groups/:groupId/permissions')
  @RequirePermission('groups', 'group', 'manage')
  async setGroupPermission(
    @CurrentUser() user: RequestUser,
    @Param('groupId') groupId: string,
    @Body()
    body: { permissionKey: string; scope?: string; denied?: boolean; enabled?: boolean },
  ) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, companyId: user.companyId },
    });
    if (!group) return { error: 'Groupe introuvable' };
    const permission = await this.prisma.permission.findFirst({
      where: {
        key: body.permissionKey,
        OR: [{ companyId: null }, { companyId: user.companyId }],
      },
    });
    if (!permission) return { error: 'Permission introuvable' };

    if (body.enabled === false) {
      await this.prisma.groupPermission.deleteMany({
        where: { groupId, permissionId: permission.id },
      });
    } else {
      await this.prisma.groupPermission.upsert({
        where: {
          groupId_permissionId: { groupId, permissionId: permission.id },
        },
        create: {
          groupId,
          permissionId: permission.id,
          scope: body.scope || 'company',
          denied: !!body.denied,
        },
        update: {
          scope: body.scope || 'company',
          denied: !!body.denied,
        },
      });
    }

    await this.prisma.accessAuditEvent.create({
      data: {
        companyId: user.companyId,
        actorId: user.userId,
        action: 'group_permission_changed',
        targetType: 'Group',
        targetId: groupId,
        detailJson: JSON.stringify(body),
      },
    });
    return { ok: true };
  }

  @Post('users/:userId/suspend')
  @RequirePermission('users', 'account', 'manage')
  suspend(@CurrentUser() user: RequestUser, @Param('userId') userId: string) {
    return this.auth.suspendUser(userId, user.userId, user.companyId);
  }

  @Post('users/:userId/reactivate')
  @RequirePermission('users', 'account', 'manage')
  reactivate(@CurrentUser() user: RequestUser, @Param('userId') userId: string) {
    return this.auth.reactivateUser(userId, user.userId, user.companyId);
  }

  @Post('users/:userId/revoke-sessions')
  @RequirePermission('users', 'account', 'manage')
  revoke(@CurrentUser() user: RequestUser, @Param('userId') userId: string) {
    return this.auth.revokeSessions(userId, user.userId, user.companyId);
  }

  @Post('users/:userId/resend-invitation')
  @RequirePermission('users', 'account', 'manage')
  resend(@CurrentUser() user: RequestUser, @Param('userId') userId: string) {
    return this.auth.resendInvitation(userId, user.userId, user.companyId);
  }

  @Get('audits')
  @RequirePermission('audits', 'event', 'list')
  audits(@CurrentUser() user: RequestUser, @Query('limit') limit?: string) {
    return this.prisma.accessAuditEvent.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: 'desc' },
      take: Number(limit) || 100,
      include: { actor: { select: { email: true, displayName: true } } },
    });
  }

  @Post('permissions/test')
  @RequirePermission('groups', 'group', 'manage')
  async testPermission(@Body() dto: TestPermissionDto) {
    const ctx = await this.engine.loadContext(dto.userId);
    if (!ctx) return { allowed: false, reason: 'Utilisateur introuvable ou inactif' };
    return this.engine.authorize(ctx, {
      module: dto.module,
      resource: dto.resource,
      action: dto.action,
      depotId: dto.depotId,
    });
  }

  @Post('employees/:employeeId/access')
  @RequirePermission('portal', 'access', 'manage')
  createAccess(
    @CurrentUser() user: RequestUser,
    @Param('employeeId') employeeId: string,
    @Body() body: { groupKeys?: string[]; portalRole?: string },
  ) {
    return this.auth.createAccessForEmployee({
      companyId: user.companyId,
      employeeId,
      actorId: user.userId,
      groupKeys: body.groupKeys,
      portalRole: body.portalRole,
    });
  }

  @Get('employees/:employeeId/access')
  @RequirePermission('portal', 'access', 'manage')
  async getAccess(
    @CurrentUser() user: RequestUser,
    @Param('employeeId') employeeId: string,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId: user.companyId },
      include: {
        accountLink: {
          include: {
            user: {
              include: {
                memberships: { include: { group: true, depot: true } },
                invitations: { orderBy: { createdAt: 'desc' }, take: 5 },
                sessions: {
                  where: { revokedAt: null, expiresAt: { gt: new Date() } },
                },
              },
            },
          },
        },
      },
    });
    return employee?.accountLink || { status: 'not_created' };
  }
}
