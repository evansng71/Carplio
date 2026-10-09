import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { PermissionEngine } from './permission.engine';
import { PERMISSION_KEY, RequiredPermission } from './decorators';
import type { RequestUser } from './auth.types';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly engine: PermissionEngine,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as RequestUser | undefined;
    if (!user) throw new UnauthorizedException();

    const depotId =
      req.params?.depotId ||
      req.query?.depotId ||
      req.body?.depotId ||
      undefined;

    const result = this.engine.authorize(user, {
      module: required.module,
      resource: required.resource,
      action: required.action,
      depotId,
      companyId: req.params?.companyId || req.body?.companyId,
    });

    if (!result.allowed) {
      throw new ForbiddenException({
        message: 'Accès refusé',
        reason: result.reason,
        permission: `${required.module}:${required.resource}:${required.action}`,
      });
    }
    return true;
  }
}
