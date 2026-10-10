import {
  Body,
  Controller,
  Get,
  Module,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard } from '../iam/guards';
import { CurrentUser, RequirePermission } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';
import { AuthModule } from '../iam/auth.module';

const DEFAULT_BRANDING = {
  brandName: 'AUTOCAR OS',
  brandTagline: 'TRANSPORT VOYAGEURS',
  loginHeadline: 'Pilotez vos exploitations en toute sérénité',
  loginSubheadline:
    'Une solution complète pour planifier, exploiter et optimiser votre activité de transport de voyageurs.',
  loginFooterText: 'Gestion d’exploitation transport voyageurs',
  logoUrl: null as string | null,
  loginHeroImageUrl: '/branding/login-hero-default.svg',
};

export type BrandingDto = {
  brandName: string;
  brandTagline: string;
  loginHeadline: string;
  loginSubheadline: string;
  loginFooterText: string;
  logoUrl: string | null;
  loginHeroImageUrl: string;
  companyName: string;
  tradeName: string | null;
  siret: string | null;
  vatNumber: string | null;
  isDemo: boolean;
};

function mapBranding(company: {
  name: string;
  tradeName: string | null;
  siret: string | null;
  vatNumber: string | null;
  isDemo: boolean;
  brandName: string | null;
  brandTagline: string | null;
  loginHeadline: string | null;
  loginSubheadline: string | null;
  loginFooterText: string | null;
  logoUrl: string | null;
  loginHeroImageUrl: string | null;
}): BrandingDto {
  return {
    brandName: company.brandName || DEFAULT_BRANDING.brandName,
    brandTagline: company.brandTagline || DEFAULT_BRANDING.brandTagline,
    loginHeadline: company.loginHeadline || DEFAULT_BRANDING.loginHeadline,
    loginSubheadline:
      company.loginSubheadline || DEFAULT_BRANDING.loginSubheadline,
    loginFooterText:
      company.loginFooterText || DEFAULT_BRANDING.loginFooterText,
    logoUrl: company.logoUrl,
    loginHeroImageUrl:
      company.loginHeroImageUrl || DEFAULT_BRANDING.loginHeroImageUrl,
    companyName: company.name,
    tradeName: company.tradeName,
    siret: company.siret,
    vatNumber: company.vatNumber,
    isDemo: company.isDemo,
  };
}

class UpdateBrandingDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  companyName?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(120)
  tradeName?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(32)
  siret?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(32)
  vatNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brandName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brandTagline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  loginHeadline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  loginSubheadline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  loginFooterText?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(2_000_000)
  logoUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(2_000_000)
  loginHeroImageUrl?: string | null;
}

@Controller('org')
class OrgController {
  constructor(private readonly prisma: PrismaService) {}

  /** Public — page de connexion */
  @Get('branding')
  async brandingPublic(): Promise<BrandingDto> {
    const company = await this.prisma.company.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (!company) {
      return {
        ...DEFAULT_BRANDING,
        companyName: 'AUTOCAR OS',
        tradeName: null,
        siret: null,
        vatNumber: null,
        isDemo: true,
      };
    }
    return mapBranding(company);
  }

  @Get('company')
  @UseGuards(JwtAuthGuard)
  company(@CurrentUser() user: RequestUser) {
    return this.prisma.company.findUnique({ where: { id: user.companyId } });
  }

  @Get('depots')
  @UseGuards(JwtAuthGuard)
  depots(@CurrentUser() user: RequestUser) {
    return this.prisma.depot.findMany({
      where: { companyId: user.companyId },
      orderBy: { name: 'asc' },
    });
  }

  @Patch('branding')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('settings', 'company', 'manage')
  async updateBranding(
    @CurrentUser() user: RequestUser,
    @Body() body: UpdateBrandingDto,
  ): Promise<BrandingDto> {
    const company = await this.prisma.company.update({
      where: { id: user.companyId },
      data: {
        ...(body.companyName !== undefined ? { name: body.companyName } : {}),
        ...(body.tradeName !== undefined ? { tradeName: body.tradeName } : {}),
        ...(body.siret !== undefined ? { siret: body.siret } : {}),
        ...(body.vatNumber !== undefined ? { vatNumber: body.vatNumber } : {}),
        ...(body.brandName !== undefined ? { brandName: body.brandName } : {}),
        ...(body.brandTagline !== undefined
          ? { brandTagline: body.brandTagline }
          : {}),
        ...(body.loginHeadline !== undefined
          ? { loginHeadline: body.loginHeadline }
          : {}),
        ...(body.loginSubheadline !== undefined
          ? { loginSubheadline: body.loginSubheadline }
          : {}),
        ...(body.loginFooterText !== undefined
          ? { loginFooterText: body.loginFooterText }
          : {}),
        ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
        ...(body.loginHeroImageUrl !== undefined
          ? { loginHeroImageUrl: body.loginHeroImageUrl }
          : {}),
      },
    });
    return mapBranding(company);
  }
}

@Module({ imports: [AuthModule], controllers: [OrgController] })
export class OrgModule {}
