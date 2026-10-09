import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { PermissionEngine } from './permission.engine';
import type { JwtPayload, RequestUser } from './auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionEngine,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => req?.cookies?.access_token || null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'dev-secret',
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    const session = await this.prisma.userSession.findUnique({
      where: { tokenJti: payload.jti },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session invalide ou révoquée');
    }
    const user = await this.prisma.userAccount.findUnique({
      where: { id: payload.sub },
    });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Compte inactif');
    }
    const ctx = await this.permissions.loadContext(user.id);
    if (!ctx) throw new UnauthorizedException('Contexte permissions indisponible');
    return { ...ctx, displayName: user.displayName };
  }
}
