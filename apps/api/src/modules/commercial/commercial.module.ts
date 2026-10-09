import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  Module,
  BadRequestException,
} from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard } from '../iam/guards';
import { CurrentUser, RequirePermission } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';
import { AuthModule } from '../iam/auth.module';

class QuoteDto {
  @IsString() customerId!: string;
  @IsString() title!: string;
  @IsOptional() @IsString() caseType?: string;
  @IsOptional() @IsString() origin?: string;
  @IsOptional() @IsString() destination?: string;
  @IsOptional() departureAt?: string;
  @IsOptional() returnAt?: string;
  @IsOptional() @IsNumber() @Min(0) passengers?: number;
  @IsOptional() @IsNumber() amountHt?: number;
  @IsOptional() @IsNumber() vatRate?: number;
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
class CommercialController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('quotes')
  @RequirePermission('quotes', 'quote', 'list')
  quotes(@CurrentUser() user: RequestUser) {
    return this.prisma.quote.findMany({
      where: { companyId: user.companyId },
      include: { customer: true, order: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('quotes')
  @RequirePermission('quotes', 'quote', 'create')
  async createQuote(@CurrentUser() user: RequestUser, @Body() dto: QuoteDto) {
    const count = await this.prisma.quote.count({
      where: { companyId: user.companyId },
    });
    const amountHt = dto.amountHt ?? 0;
    const vatRate = dto.vatRate ?? 10;
    const amountTtc = Math.round(amountHt * (1 + vatRate / 100) * 100) / 100;

    // Estimation disponibilité (théorique, non réservation)
    const departure = dto.departureAt ? new Date(dto.departureAt) : null;
    let availabilityNote = 'Aucune date — estimation non calculée';
    let availabilityConfidence = 'low';
    if (departure) {
      const dayStart = new Date(departure);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(departure);
      dayEnd.setHours(23, 59, 59, 999);
      const busy = await this.prisma.assignment.count({
        where: {
          companyId: user.companyId,
          startsAt: { lt: dayEnd },
          endsAt: { gt: dayStart },
        },
      });
      const vehicles = await this.prisma.vehicle.count({
        where: { companyId: user.companyId, status: 'available' },
      });
      const free = Math.max(vehicles - busy, 0);
      availabilityNote = `${free}/${vehicles} véhicules théoriquement disponibles le jour demandé (${busy} affectations).`;
      availabilityConfidence = free > 0 ? 'medium' : 'low';
    }

    return this.prisma.quote.create({
      data: {
        companyId: user.companyId,
        customerId: dto.customerId,
        number: `D-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        title: dto.title,
        caseType: dto.caseType || 'simple',
        origin: dto.origin,
        destination: dto.destination,
        departureAt: dto.departureAt ? new Date(dto.departureAt) : null,
        returnAt: dto.returnAt ? new Date(dto.returnAt) : null,
        passengers: dto.passengers || 0,
        amountHt,
        vatRate,
        amountTtc,
        marginEst: Math.round(amountHt * 0.18 * 100) / 100,
        availabilityNote,
        availabilityConfidence,
        status: 'sent',
      },
      include: { customer: true },
    });
  }

  @Post('quotes/:id/accept')
  @RequirePermission('quotes', 'quote', 'approve')
  async accept(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!quote) throw new BadRequestException('Devis introuvable');
    if (quote.status === 'accepted' && quote) {
      const existing = await this.prisma.order.findUnique({ where: { quoteId: id } });
      if (existing) return existing;
    }

    await this.prisma.quote.update({
      where: { id },
      data: { status: 'accepted' },
    });

    const orderCount = await this.prisma.order.count({
      where: { companyId: user.companyId },
    });
    const order = await this.prisma.order.create({
      data: {
        companyId: user.companyId,
        customerId: quote.customerId,
        quoteId: quote.id,
        number: `C-${new Date().getFullYear()}-${String(orderCount + 1).padStart(4, '0')}`,
        title: quote.title,
        status: 'confirmed',
      },
    });

    const missionCount = await this.prisma.mission.count({
      where: { companyId: user.companyId },
    });
    const startsAt = quote.departureAt || new Date();
    const endsAt =
      quote.returnAt ||
      new Date(startsAt.getTime() + 4 * 60 * 60 * 1000);

    const mission = await this.prisma.mission.create({
      data: {
        companyId: user.companyId,
        orderId: order.id,
        number: `M-${new Date().getFullYear()}-${String(missionCount + 1).padStart(4, '0')}`,
        title: quote.title,
        startsAt,
        endsAt,
        origin: quote.origin,
        destination: quote.destination,
        passengers: quote.passengers,
        status: 'to_plan',
      },
    });

    return { order, mission };
  }

  @Get('orders')
  @RequirePermission('orders', 'order', 'list')
  orders(@CurrentUser() user: RequestUser) {
    return this.prisma.order.findMany({
      where: { companyId: user.companyId },
      include: { customer: true, missions: true, quote: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('missions')
  @RequirePermission('missions', 'mission', 'list')
  missions(@CurrentUser() user: RequestUser) {
    return this.prisma.mission.findMany({
      where: { companyId: user.companyId },
      include: {
        order: { include: { customer: true } },
        assignments: { include: { driver: { include: { employee: true } }, vehicle: true } },
        documents: true,
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  @Get('missions/:id')
  @RequirePermission('missions', 'mission', 'read')
  mission(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.prisma.mission.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        order: { include: { customer: true } },
        assignments: { include: { driver: { include: { employee: true } }, vehicle: true } },
        documents: true,
      },
    });
  }

  @Post('missions/:id/ticket-return')
  @RequirePermission('missions', 'mission', 'update')
  ticketReturn(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { actualPassengers?: number; ticketNotes?: string },
  ) {
    return this.prisma.mission.update({
      where: { id },
      data: {
        ticketReturnedAt: new Date(),
        actualPassengers: body.actualPassengers,
        ticketNotes: body.ticketNotes,
        status: 'ops_return_review',
      },
    });
  }
}

@Module({ imports: [AuthModule], controllers: [CommercialController] })
export class CommercialModule {}
