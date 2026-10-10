import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, createHmac, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from './auth.types';

function totpCode(secret: string, window = 0) {
  const step = Math.floor(Date.now() / 30000) + window;
  const h = createHmac('sha1', secret).update(String(step)).digest('hex');
  return String(parseInt(h.slice(-8), 16) % 1_000_000).padStart(6, '0');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueSession(
    user: {
      id: string;
      email: string;
      companyId: string;
      displayName: string;
      status: string;
      mustChangePassword?: boolean;
    },
    meta?: { ip?: string; ua?: string },
  ) {
    const jti = randomBytes(16).toString('hex');
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN') || '8h';
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      companyId: user.companyId,
      jti,
    };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn });
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        tokenJti: jti,
        expiresAt,
        ip: meta?.ip,
        userAgent: meta?.ua,
      },
    });
    await this.prisma.userAccount.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.prisma.accessAuditEvent.create({
      data: {
        companyId: user.companyId,
        actorId: user.id,
        action: 'login',
        targetType: 'UserAccount',
        targetId: user.id,
      },
    });
    return {
      accessToken,
      mustChangePassword: !!user.mustChangePassword,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        companyId: user.companyId,
        status: user.status,
        mustChangePassword: !!user.mustChangePassword,
      },
    };
  }

  async getAccountFlags(userId: string) {
    return this.prisma.userAccount.findUnique({
      where: { id: userId },
      select: { mustChangePassword: true, status: true },
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    if (newPassword.length < 10) {
      throw new BadRequestException('Mot de passe trop court (min 10)');
    }
    const user = await this.prisma.userAccount.findUnique({
      where: { id: userId },
    });
    if (!user?.passwordHash) {
      throw new BadRequestException('Compte sans mot de passe');
    }
    const ok = await argon2.verify(user.passwordHash, currentPassword);
    if (!ok) throw new UnauthorizedException('Mot de passe actuel incorrect');
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
    });
    await this.prisma.userAccount.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        tempPasswordSetAt: null,
      },
    });
    await this.prisma.accessAuditEvent.create({
      data: {
        companyId: user.companyId,
        actorId: userId,
        action: 'password_changed',
        targetType: 'UserAccount',
        targetId: userId,
      },
    });
    return { ok: true };
  }

  async login(
    email: string,
    password: string,
    meta?: { ip?: string; ua?: string },
    mfaCode?: string,
  ) {
    const user = await this.prisma.userAccount.findFirst({
      where: { email: email.toLowerCase() },
    });
    // Anti-enumeration: same message
    if (!user || !user.passwordHash || user.status !== 'active') {
      throw new UnauthorizedException('Identifiants invalides');
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Identifiants invalides');

    if (user.mfaEnabled && user.mfaSecret) {
      if (!mfaCode) {
        return {
          mfaRequired: true,
          email: user.email,
          message: 'Code MFA requis',
        };
      }
      const valid =
        mfaCode === totpCode(user.mfaSecret, 0) ||
        mfaCode === totpCode(user.mfaSecret, -1) ||
        mfaCode === totpCode(user.mfaSecret, 1);
      if (!valid) throw new UnauthorizedException('Code MFA invalide');
    }

    return this.issueSession(user, meta);
  }

  async setupMfa(userId: string) {
    const secret = randomBytes(20).toString('hex');
    await this.prisma.userAccount.update({
      where: { id: userId },
      data: { mfaSecret: secret, mfaEnabled: false },
    });
    return {
      secret,
      otpauth: `otpauth://totp/AUTOCAR-OS:${userId}?secret=${secret}&issuer=AUTOCAR-OS`,
      demoCode: totpCode(secret),
      note: 'Scannez le secret dans une app TOTP, ou utilisez demoCode en démo',
    };
  }

  async enableMfa(userId: string, code: string) {
    const user = await this.prisma.userAccount.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) throw new BadRequestException('MFA non initialisé');
    const valid =
      code === totpCode(user.mfaSecret, 0) ||
      code === totpCode(user.mfaSecret, -1);
    if (!valid) throw new BadRequestException('Code invalide');
    await this.prisma.userAccount.update({
      where: { id: userId },
      data: { mfaEnabled: true, mfaRequired: true },
    });
    await this.prisma.accessAuditEvent.create({
      data: {
        companyId: user.companyId,
        actorId: userId,
        action: 'mfa_enabled',
        targetType: 'UserAccount',
        targetId: userId,
      },
    });
    return { ok: true };
  }

  async disableMfa(userId: string) {
    const user = await this.prisma.userAccount.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Utilisateur introuvable');
    await this.prisma.userAccount.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaRequired: false, mfaSecret: null },
    });
    return { ok: true };
  }

  async logout(jti: string, userId: string) {
    await this.prisma.userSession.updateMany({
      where: { tokenJti: jti, userId },
      data: { revokedAt: new Date() },
    });
  }

  async activateInvitation(token: string, password: string) {
    if (password.length < 10) {
      throw new BadRequestException('Mot de passe trop court (min 10)');
    }
    const tokenHash = this.hashToken(token);
    const invitation = await this.prisma.accountInvitation.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!invitation || invitation.acceptedAt) {
      throw new BadRequestException('Invitation invalide');
    }
    if (invitation.expiresAt < new Date()) {
      await this.prisma.userAccount.update({
        where: { id: invitation.userId },
        data: { status: 'invitation_expired' },
      });
      throw new BadRequestException('Invitation expirée');
    }
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.userAccount.update({
        where: { id: invitation.userId },
        data: {
          passwordHash,
          status: 'active',
          mustChangePassword: false,
          tempPasswordSetAt: null,
        },
      }),
      this.prisma.accountInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
      this.prisma.accessAuditEvent.create({
        data: {
          companyId: invitation.companyId,
          actorId: invitation.userId,
          action: 'invitation_accepted',
          targetType: 'UserAccount',
          targetId: invitation.userId,
        },
      }),
    ]);
    return { ok: true, email: invitation.user.email };
  }

  /** Mot de passe temporaire lisible (affiché une seule fois à la RH). */
  generateTemporaryPassword() {
    const a = randomBytes(2).toString('hex').toUpperCase();
    const b = randomBytes(2).toString('hex').toUpperCase();
    return `Carp-${a}-${b}`;
  }

  async createAccessForEmployee(params: {
    companyId: string;
    employeeId: string;
    actorId: string;
    groupKeys?: string[];
    portalRole?: string;
    /** invitation = lien d’activation ; temporary_password = MDP temporaire visible une fois */
    mode?: 'invitation' | 'temporary_password';
    email?: string;
  }) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: params.employeeId, companyId: params.companyId },
      include: { accountLink: true, driver: true },
    });
    if (!employee) throw new BadRequestException('Salarié introuvable');
    if (employee.accountLink) {
      throw new BadRequestException('Un compte est déjà lié à cette fiche');
    }
    const email = (params.email || employee.email || '').toLowerCase().trim();
    if (!email) {
      throw new BadRequestException('Email requis sur la fiche pour créer un accès');
    }

    const existing = await this.prisma.userAccount.findUnique({
      where: {
        companyId_email: {
          companyId: params.companyId,
          email,
        },
      },
    });
    if (existing) throw new BadRequestException('Email déjà utilisé pour un compte');

    const mode = params.mode || 'temporary_password';
    let temporaryPassword: string | undefined;
    let passwordHash: string | undefined;
    if (mode === 'temporary_password') {
      temporaryPassword = this.generateTemporaryPassword();
      passwordHash = await argon2.hash(temporaryPassword, { type: argon2.argon2id });
    }

    const user = await this.prisma.userAccount.create({
      data: {
        companyId: params.companyId,
        email,
        displayName: `${employee.firstName} ${employee.lastName}`,
        status: mode === 'temporary_password' ? 'active' : 'invited',
        passwordHash,
        mustChangePassword: mode === 'temporary_password',
        tempPasswordSetAt:
          mode === 'temporary_password' ? new Date() : undefined,
      },
    });

    if (!employee.email || employee.email.toLowerCase() !== email) {
      await this.prisma.employee.update({
        where: { id: employee.id },
        data: { email },
      });
    }

    await this.prisma.employeeAccountLink.create({
      data: {
        employeeId: employee.id,
        userId: user.id,
        portalRole: params.portalRole || (employee.driver ? 'driver' : 'employee'),
      },
    });

    const groupKeys = params.groupKeys || (employee.driver ? ['driver'] : []);
    for (const key of groupKeys) {
      const group = await this.prisma.group.findUnique({
        where: { companyId_key: { companyId: params.companyId, key } },
      });
      if (group) {
        await this.prisma.groupMembership.create({
          data: {
            groupId: group.id,
            userId: user.id,
            depotId: employee.depotId,
          },
        });
      }
    }

    let invitationToken: string | undefined;
    let expiresAt: Date | undefined;
    if (mode === 'invitation') {
      const rawToken = randomBytes(32).toString('hex');
      const hours = Number(this.config.get('INVITATION_TTL_HOURS') || 72);
      const invitation = await this.prisma.accountInvitation.create({
        data: {
          companyId: params.companyId,
          userId: user.id,
          tokenHash: this.hashToken(rawToken),
          expiresAt: new Date(Date.now() + hours * 3600 * 1000),
          createdById: params.actorId,
        },
      });
      invitationToken = rawToken;
      expiresAt = invitation.expiresAt;
    }

    await this.prisma.accessAuditEvent.create({
      data: {
        companyId: params.companyId,
        actorId: params.actorId,
        action: 'access_created',
        targetType: 'UserAccount',
        targetId: user.id,
        detailJson: JSON.stringify({
          employeeId: employee.id,
          mode,
        }),
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        mustChangePassword: user.mustChangePassword,
      },
      mode,
      invitationToken,
      expiresAt,
      /** Affiché une seule fois — jamais stocké en clair */
      temporaryPassword,
    };
  }

  /**
   * Régénère un mot de passe temporaire (retourné en clair une seule fois).
   */
  async setTemporaryPassword(
    userId: string,
    actorId: string,
    companyId: string,
  ) {
    const user = await this.prisma.userAccount.findFirst({
      where: { id: userId, companyId },
    });
    if (!user) throw new BadRequestException('Utilisateur introuvable');
    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await argon2.hash(temporaryPassword, {
      type: argon2.argon2id,
    });
    await this.prisma.userAccount.update({
      where: { id: userId },
      data: {
        passwordHash,
        status: 'active',
        mustChangePassword: true,
        tempPasswordSetAt: new Date(),
      },
    });
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.accessAuditEvent.create({
      data: {
        companyId,
        actorId,
        action: 'temporary_password_issued',
        targetType: 'UserAccount',
        targetId: userId,
      },
    });
    return {
      userId,
      email: user.email,
      temporaryPassword,
      mustChangePassword: true,
      message:
        'Mot de passe temporaire généré — communiquez-le au salarié, il ne sera plus réaffichable.',
    };
  }

  async suspendUser(userId: string, actorId: string, companyId: string) {
    await this.ensureNotLastSuperAdmin(userId, companyId);
    await this.prisma.userAccount.update({
      where: { id: userId },
      data: { status: 'suspended' },
    });
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.accessAuditEvent.create({
      data: {
        companyId,
        actorId,
        action: 'user_suspended',
        targetType: 'UserAccount',
        targetId: userId,
      },
    });
  }

  async reactivateUser(userId: string, actorId: string, companyId: string) {
    await this.prisma.userAccount.update({
      where: { id: userId },
      data: { status: 'active' },
    });
    await this.prisma.accessAuditEvent.create({
      data: {
        companyId,
        actorId,
        action: 'user_reactivated',
        targetType: 'UserAccount',
        targetId: userId,
      },
    });
  }

  async revokeSessions(userId: string, actorId: string, companyId: string) {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.accessAuditEvent.create({
      data: {
        companyId,
        actorId,
        action: 'sessions_revoked',
        targetType: 'UserAccount',
        targetId: userId,
      },
    });
  }

  async ensureNotLastSuperAdmin(userId: string, companyId: string) {
    const membership = await this.prisma.groupMembership.findFirst({
      where: {
        userId,
        group: { companyId, key: 'super_admin' },
      },
    });
    if (!membership) return;

    const activeSuperAdmins = await this.prisma.groupMembership.count({
      where: {
        group: { companyId, key: 'super_admin' },
        user: { status: 'active', id: { not: userId } },
      },
    });
    if (activeSuperAdmins === 0) {
      throw new ForbiddenException(
        'Impossible de désactiver le dernier super-administrateur actif',
      );
    }
  }

  async resendInvitation(userId: string, actorId: string, companyId: string) {
    const user = await this.prisma.userAccount.findFirst({
      where: { id: userId, companyId },
    });
    if (!user) throw new BadRequestException('Utilisateur introuvable');
    const rawToken = randomBytes(32).toString('hex');
    const hours = Number(this.config.get('INVITATION_TTL_HOURS') || 72);
    await this.prisma.accountInvitation.create({
      data: {
        companyId,
        userId,
        tokenHash: this.hashToken(rawToken),
        expiresAt: new Date(Date.now() + hours * 3600 * 1000),
        createdById: actorId,
      },
    });
    await this.prisma.userAccount.update({
      where: { id: userId },
      data: { status: 'invited' },
    });
    return { invitationToken: rawToken };
  }
}
