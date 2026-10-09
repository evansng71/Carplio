import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard } from '../iam/guards';
import { CurrentUser, RequirePermission } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';
import { AuthModule } from '../iam/auth.module';

class PublicRequestDto {
  @IsString()
  contactName!: string;
  @IsEmail()
  email!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() origin?: string;
  @IsOptional() @IsString() destination?: string;
  @IsOptional() @IsString() departureAt?: string;
  @IsOptional() @IsInt() @Min(1) passengers?: number;
  @IsOptional() @IsString() message?: string;
  @IsOptional() @IsString() companySlug?: string;
}

@Controller()
class ClientPortalController {
  constructor(private readonly prisma: PrismaService) {}

  /** Demande publique (sans auth) — portail client */
  @Post('public/quote-requests')
  async publicRequest(@Body() dto: PublicRequestDto) {
    const company = await this.prisma.company.findFirst({
      where: { isDemo: true },
    });
    if (!company) return { error: 'Société introuvable' };
    const req = await this.prisma.clientQuoteRequest.create({
      data: {
        companyId: company.id,
        contactName: dto.contactName,
        email: dto.email,
        phone: dto.phone,
        origin: dto.origin,
        destination: dto.destination,
        departureAt: dto.departureAt ? new Date(dto.departureAt) : null,
        passengers: dto.passengers || 0,
        message: dto.message,
        status: 'new',
      },
    });
    await this.prisma.opsAlert.create({
      data: {
        companyId: company.id,
        severity: 'info',
        title: 'Nouvelle demande portail client',
        body: `${dto.contactName} — ${dto.origin} → ${dto.destination}`,
        href: '/app/client-requests',
      },
    });
    return { ok: true, id: req.id };
  }

  @Get('client-requests')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('quotes', 'quote', 'list')
  list(@CurrentUser() user: RequestUser) {
    return this.prisma.clientQuoteRequest.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('client-requests/:id/convert')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('quotes', 'quote', 'create')
  async convert(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    const req = await this.prisma.clientQuoteRequest.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!req) return { error: 'Demande introuvable' };
    let customer = await this.prisma.customer.findFirst({
      where: { companyId: user.companyId, email: req.email },
    });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          companyId: user.companyId,
          name: req.contactName,
          email: req.email,
          phone: req.phone,
          type: 'particular',
        },
      });
    }
    const count = await this.prisma.quote.count({
      where: { companyId: user.companyId },
    });
    const quote = await this.prisma.quote.create({
      data: {
        companyId: user.companyId,
        customerId: customer.id,
        number: `D-${new Date().getFullYear()}-P${String(count + 1).padStart(3, '0')}`,
        title: `Demande portail ${req.origin} → ${req.destination}`,
        status: 'sent',
        origin: req.origin,
        destination: req.destination,
        departureAt: req.departureAt,
        passengers: req.passengers,
        amountHt: Math.max(req.passengers * 12, 180),
        amountTtc: Math.max(req.passengers * 12, 180) * 1.1,
        availabilityNote: 'Issu du portail client',
        availabilityConfidence: 'low',
      },
    });
    await this.prisma.clientQuoteRequest.update({
      where: { id },
      data: { status: 'converted', customerId: customer.id },
    });
    return { quote, customer };
  }
}

@Module({ imports: [AuthModule], controllers: [ClientPortalController] })
export class ClientPortalModule {}
