import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
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

class CreateUserDto {
  @IsEmail()
  email!: string;
  @IsString()
  @MaxLength(120)
  displayName!: string;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  groupIds?: string[];
}

class SetMembershipsDto {
  @IsArray()
  @IsString({ each: true })
  groupIds!: string[];
  @IsOptional()
  @IsString()
  depotId?: string | null;
}

class CreateGroupDto {
  @IsString()
  @MaxLength(60)
  key!: string;
  @IsString()
  @MaxLength(120)
  name!: string;
  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;
}

class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
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

  @Post('users')
  @RequirePermission('users', 'account', 'manage')
  async createUser(
    @CurrentUser() user: RequestUser,
    @Body() body: CreateUserDto,
  ) {
    const email = body.email.toLowerCase().trim();
    const existing = await this.prisma.userAccount.findUnique({
      where: {
        companyId_email: { companyId: user.companyId, email },
      },
    });
    if (existing) throw new BadRequestException('Email déjà utilisé');

    const created = await this.prisma.userAccount.create({
      data: {
        companyId: user.companyId,
        email,
        displayName: body.displayName.trim(),
        status: 'invited',
      },
    });

    const groupIds = body.groupIds || [];
    for (const groupId of groupIds) {
      const group = await this.prisma.group.findFirst({
        where: { id: groupId, companyId: user.companyId, archivedAt: null },
      });
      if (!group) continue;
      await this.prisma.groupMembership.create({
        data: { groupId: group.id, userId: created.id },
      });
    }

    const invite = await this.auth.resendInvitation(
      created.id,
      user.userId,
      user.companyId,
    );

    await this.prisma.accessAuditEvent.create({
      data: {
        companyId: user.companyId,
        actorId: user.userId,
        action: 'user_created',
        targetType: 'UserAccount',
        targetId: created.id,
        detailJson: JSON.stringify({ email, groupIds }),
      },
    });

    return { user: created, invitationToken: invite.invitationToken };
  }

  @Patch('users/:userId/memberships')
  @RequirePermission('users', 'account', 'manage')
  async setMemberships(
    @CurrentUser() user: RequestUser,
    @Param('userId') userId: string,
    @Body() body: SetMembershipsDto,
  ) {
    const target = await this.prisma.userAccount.findFirst({
      where: { id: userId, companyId: user.companyId },
    });
    if (!target) throw new BadRequestException('Utilisateur introuvable');

    const validGroups = await this.prisma.group.findMany({
      where: {
        companyId: user.companyId,
        archivedAt: null,
        id: { in: body.groupIds },
      },
    });
    const validIds = new Set(validGroups.map((g) => g.id));

    await this.prisma.groupMembership.deleteMany({ where: { userId } });
    for (const groupId of body.groupIds) {
      if (!validIds.has(groupId)) continue;
      await this.prisma.groupMembership.create({
        data: {
          groupId,
          userId,
          depotId: body.depotId || null,
        },
      });
    }

    await this.prisma.accessAuditEvent.create({
      data: {
        companyId: user.companyId,
        actorId: user.userId,
        action: 'user_memberships_updated',
        targetType: 'UserAccount',
        targetId: userId,
        detailJson: JSON.stringify(body),
      },
    });

    return this.prisma.userAccount.findUnique({
      where: { id: userId },
      include: {
        memberships: { include: { group: true, depot: true } },
      },
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

  @Post('groups')
  @RequirePermission('groups', 'group', 'manage')
  async createGroup(
    @CurrentUser() user: RequestUser,
    @Body() body: CreateGroupDto,
  ) {
    const key = body.key
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_|_$/g, '');
    if (!key) throw new BadRequestException('Clé de groupe invalide');
    const existing = await this.prisma.group.findUnique({
      where: { companyId_key: { companyId: user.companyId, key } },
    });
    if (existing) throw new BadRequestException('Clé déjà utilisée');

    const group = await this.prisma.group.create({
      data: {
        companyId: user.companyId,
        key,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        isSystem: false,
      },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { memberships: true } },
      },
    });

    await this.prisma.accessAuditEvent.create({
      data: {
        companyId: user.companyId,
        actorId: user.userId,
        action: 'group_created',
        targetType: 'Group',
        targetId: group.id,
      },
    });
    return group;
  }

  @Patch('groups/:groupId')
  @RequirePermission('groups', 'group', 'manage')
  async updateGroup(
    @CurrentUser() user: RequestUser,
    @Param('groupId') groupId: string,
    @Body() body: UpdateGroupDto,
  ) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, companyId: user.companyId },
    });
    if (!group) throw new BadRequestException('Groupe introuvable');
    if (group.isSystem && body.archived) {
      throw new BadRequestException('Impossible d’archiver un groupe système');
    }

    const updated = await this.prisma.group.update({
      where: { id: groupId },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined
          ? { description: body.description?.trim() || null }
          : {}),
        ...(body.archived === true ? { archivedAt: new Date() } : {}),
        ...(body.archived === false ? { archivedAt: null } : {}),
      },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { memberships: true } },
      },
    });
    return updated;
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
