import {
  SetMetadata,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import type { RequestUser } from './auth.types';

export const PERMISSION_KEY = 'permission';
export type RequiredPermission = {
  module: string;
  resource: string;
  action: string;
};

export const RequirePermission = (
  module: string,
  resource: string,
  action: string,
) => SetMetadata(PERMISSION_KEY, { module, resource, action } satisfies RequiredPermission);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);
