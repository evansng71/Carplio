import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards';
import { CurrentUser } from './decorators';
import type { RequestUser } from './auth.types';
import { PermissionEngine } from './permission.engine';
import { JwtService } from '@nestjs/jwt';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @IsString()
  mfaCode?: string;
}

class MfaCodeDto {
  @IsString()
  @MinLength(6)
  code!: string;
}

class ActivateDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(10)
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly permissions: PermissionEngine,
    private readonly jwt: JwtService,
  ) {}

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(
      dto.email,
      dto.password,
      { ip: req.ip, ua: req.headers['user-agent'] },
      dto.mfaCode,
    );
    if ('accessToken' in result && result.accessToken) {
      res.cookie('access_token', result.accessToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 8 * 60 * 60 * 1000,
      });
    }
    return result;
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  setupMfa(@CurrentUser() user: RequestUser) {
    return this.auth.setupMfa(user.userId);
  }

  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  enableMfa(@CurrentUser() user: RequestUser, @Body() dto: MfaCodeDto) {
    return this.auth.enableMfa(user.userId, dto.code);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  disableMfa(@CurrentUser() user: RequestUser) {
    return this.auth.disableMfa(user.userId);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: Request,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token =
      req.cookies?.access_token ||
      (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (token) {
      try {
        const payload = this.jwt.decode(token) as { jti?: string } | null;
        if (payload?.jti) await this.auth.logout(payload.jti, user.userId);
      } catch {
        /* ignore */
      }
    }
    res.clearCookie('access_token');
    return { ok: true };
  }

  @Post('activate')
  activate(@Body() dto: ActivateDto) {
    return this.auth.activateInvitation(dto.token, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: RequestUser) {
    const ctx = await this.permissions.loadContext(user.userId);
    return {
      id: user.userId,
      email: user.email,
      displayName: user.displayName,
      companyId: user.companyId,
      depotIds: user.depotIds,
      isSuperAdmin: user.isSuperAdmin,
      permissions: ctx ? [...ctx.permissionKeys] : [],
      denied: ctx ? [...ctx.deniedKeys] : [],
    };
  }
}
