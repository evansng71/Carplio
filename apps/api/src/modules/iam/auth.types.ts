import type { AuthContext } from './permission.engine';

export type JwtPayload = {
  sub: string;
  email: string;
  companyId: string;
  jti: string;
};

export type RequestUser = AuthContext & {
  displayName: string;
};
