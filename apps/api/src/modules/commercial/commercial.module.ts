import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Module,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard } from '../iam/guards';
import { CurrentUser, RequirePermission } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';
import { AuthModule } from '../iam/auth.module';

class QuoteLineDto {
  @IsOptional() @IsString() kind?: string;
  @IsString() label!: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() @Min(0) quantity?: number;
  @IsOptional() @IsNumber() unitPriceHt?: number;
}

class QuoteDto {
  @IsString() customerId!: string;
  @IsOptional() @IsString() contactId?: string | null;
  @IsOptional() @IsString() salespersonId?: string | null;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() caseType?: string;
  @IsOptional() @IsString() serviceType?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() origin?: string | null;
  @IsOptional() @IsString() originAddress?: string | null;
  @IsOptional() @IsString() destination?: string | null;
  @IsOptional() @IsString() destinationAddress?: string | null;
  @IsOptional() @IsNumber() distanceKm?: number | null;
  @IsOptional() @IsNumber() durationDays?: number | null;
  @IsOptional() @IsString() departureAt?: string | null;
  @IsOptional() @IsString() returnAt?: string | null;
  @IsOptional() @IsString() garageDepartureAt?: string | null;
  @IsOptional() @IsString() presentationAt?: string | null;
  @IsOptional() @IsString() onSiteAt?: string | null;
  @IsOptional() @IsString() returnDepartureAt?: string | null;
  @IsOptional() @IsString() returnGarageAt?: string | null;
  @IsOptional() @IsNumber() @Min(1) vehicleCount?: number;
  @IsOptional() @IsString() vehicleCategoryId?: string | null;
  @IsOptional() @IsNumber() @Min(0) passengers?: number;
  @IsOptional() @IsNumber() amountHt?: number;
  @IsOptional() @IsNumber() proposedPriceHt?: number;
  @IsOptional() @IsNumber() vatRate?: number;
  @IsOptional() @IsNumber() depositPercent?: number;
  @IsOptional() @IsNumber() depositAmountHt?: number;
  @IsOptional() @IsString() customerPoNumber?: string | null;
  @IsOptional() @IsString() billingEmail?: string | null;
  @IsOptional() @IsString() luggageNotes?: string | null;
  @IsOptional() @IsString() accessibilityNotes?: string | null;
  @IsOptional() @IsString() optionsNotes?: string | null;
  @IsOptional() @IsNumber() costTolls?: number;
  @IsOptional() @IsNumber() costParking?: number;
  @IsOptional() @IsNumber() costDriverMeals?: number;
  @IsOptional() @IsNumber() costHotel?: number;
  @IsOptional() @IsNumber() costMisc?: number;
  @IsOptional() @IsString() refusedReason?: string | null;
  @IsOptional() @IsString() requestReceivedAt?: string | null;
  @IsOptional() @IsString() requestChannel?: string | null;
  @IsOptional() @IsString() proposedAt?: string | null;
  @IsOptional() @IsString() validUntil?: string | null;
  @IsOptional() @IsString() acceptedAt?: string | null;
  @IsOptional() @IsString() announcedAt?: string | null;
  @IsOptional() @IsString() invoicedAt?: string | null;
  @IsOptional() @IsString() dayDetails?: string | null;
  @IsOptional() @IsString() internalNotes?: string | null;
  @IsOptional() @IsBoolean() publishedToPortal?: boolean;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteLineDto)
  lines?: QuoteLineDto[];
}

class OrderPatchDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() customerPoNumber?: string | null;
  @IsOptional() @IsString() clientNotes?: string | null;
  @IsOptional() @IsString() internalNotes?: string | null;
  @IsOptional() @IsNumber() depositPaidHt?: number;
  @IsOptional() @IsString() cancelReason?: string | null;
  @IsOptional() @IsString() salespersonId?: string | null;
}

function parseDate(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(d: Date, days: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

const quoteInclude = {
  customer: true,
  contact: true,
  salesperson: {
    select: { id: true, email: true, displayName: true },
  },
  vehicleCategory: true,
  lines: { orderBy: { sortOrder: 'asc' as const } },
  order: { include: { missions: true } },
  invoices: { select: { id: true, number: true, status: true, kind: true } },
} as const;

const orderInclude = {
  customer: true,
  quote: { include: { lines: true, vehicleCategory: true } },
  salesperson: {
    select: { id: true, email: true, displayName: true },
  },
  missions: true,
  invoices: {
    select: {
      id: true,
      number: true,
      status: true,
      kind: true,
      amountTtc: true,
      balance: true,
    },
  },
} as const;

function mapQuoteLines(lines?: QuoteLineDto[]) {
  if (!lines?.length) return null;
  return lines.map((l, i) => {
    const quantity = l.quantity ?? 1;
    const unitPriceHt = l.unitPriceHt ?? 0;
    return {
      kind: l.kind || 'transport',
      label: l.label,
      unit: l.unit || 'forfait',
      quantity,
      unitPriceHt,
      amountHt: Math.round(quantity * unitPriceHt * 100) / 100,
      sortOrder: i,
    };
  });
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
class CommercialController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('quotes/meta')
  @RequirePermission('quotes', 'quote', 'list')
  async quotesMeta(@CurrentUser() user: RequestUser) {
    const [categories, salespeople, customers] = await Promise.all([
      this.prisma.vehicleCategory.findMany({
        where: { companyId: user.companyId, active: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.userAccount.findMany({
        where: {
          companyId: user.companyId,
          status: 'active',
          memberships: { some: { group: { key: 'sales' } } },
        },
        select: { id: true, email: true, displayName: true },
        orderBy: { displayName: 'asc' },
      }),
      this.prisma.customer.findMany({
        where: { companyId: user.companyId, archivedAt: null },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          contacts: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              isPrimary: true,
            },
            orderBy: [{ isPrimary: 'desc' }, { lastName: 'asc' }],
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { categories, salespeople, customers };
  }

  @Get('quotes')
  @RequirePermission('quotes', 'quote', 'list')
  quotes(@CurrentUser() user: RequestUser) {
    return this.prisma.quote.findMany({
      where: { companyId: user.companyId, status: { not: 'trashed' } },
      include: quoteInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('quotes/:id')
  @RequirePermission('quotes', 'quote', 'read')
  async quote(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const q = await this.prisma.quote.findFirst({
      where: { id, companyId: user.companyId },
      include: quoteInclude,
    });
    if (!q) throw new NotFoundException('Devis introuvable');
    return q;
  }

  private async resolvePassengers(
    companyId: string,
    vehicleCategoryId: string | null | undefined,
    vehicleCount: number,
    explicit?: number,
  ) {
    if (explicit != null && explicit > 0) return explicit;
    if (!vehicleCategoryId) return 0;
    const cat = await this.prisma.vehicleCategory.findFirst({
      where: { id: vehicleCategoryId, companyId },
    });
    return cat ? cat.defaultSeats * Math.max(vehicleCount, 1) : 0;
  }

  private async availabilityFor(companyId: string, departure: Date | null) {
    let availabilityNote = 'Aucune date — estimation non calculée';
    let availabilityConfidence = 'low';
    if (departure) {
      const dayStart = new Date(departure);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(departure);
      dayEnd.setHours(23, 59, 59, 999);
      const busy = await this.prisma.assignment.count({
        where: {
          companyId,
          startsAt: { lt: dayEnd },
          endsAt: { gt: dayStart },
        },
      });
      const vehicles = await this.prisma.vehicle.count({
        where: { companyId, status: 'available' },
      });
      const free = Math.max(vehicles - busy, 0);
      availabilityNote = `${free}/${vehicles} véhicules théoriquement disponibles le jour demandé (${busy} affectations).`;
      availabilityConfidence = free > 0 ? 'medium' : 'low';
    }
    return { availabilityNote, availabilityConfidence };
  }

  private async buildQuoteData(
    companyId: string,
    dto: QuoteDto,
    opts: { forCreate?: boolean; status?: string } = {},
  ) {
    const vehicleCount = dto.vehicleCount ?? 1;
    const passengers = await this.resolvePassengers(
      companyId,
      dto.vehicleCategoryId,
      vehicleCount,
      dto.passengers,
    );
    const mappedLines = mapQuoteLines(dto.lines);
    const linesSum = mappedLines
      ? mappedLines.reduce((s, l) => s + l.amountHt, 0)
      : null;
    const amountHt =
      dto.amountHt != null
        ? dto.amountHt
        : linesSum != null
          ? Math.round(linesSum * 100) / 100
          : 0;
    const proposedPriceHt =
      dto.proposedPriceHt != null ? dto.proposedPriceHt : amountHt;
    const vatRate = dto.vatRate ?? 10;
    const base = proposedPriceHt || amountHt;
    const amountTtc = Math.round(base * (1 + vatRate / 100) * 100) / 100;
    const depositPercent = dto.depositPercent ?? 0;
    const depositAmountHt =
      dto.depositAmountHt != null
        ? dto.depositAmountHt
        : Math.round(base * (depositPercent / 100) * 100) / 100;
    const costs =
      (dto.costTolls || 0) +
      (dto.costParking || 0) +
      (dto.costDriverMeals || 0) +
      (dto.costHotel || 0) +
      (dto.costMisc || 0);
    const departureAt = parseDate(dto.departureAt);
    const proposedAt =
      parseDate(dto.proposedAt) || (opts.forCreate ? new Date() : null);
    const validUntil =
      parseDate(dto.validUntil) ||
      (proposedAt ? addDays(proposedAt, 20) : null);
    const title =
      dto.title?.trim() ||
      [dto.origin, dto.destination].filter(Boolean).join(' → ') ||
      'Nouveau devis';

    const { availabilityNote, availabilityConfidence } =
      await this.availabilityFor(companyId, departureAt);

    return {
      customerId: dto.customerId,
      contactId: dto.contactId || null,
      salespersonId: dto.salespersonId || null,
      source: dto.source || 'email',
      title,
      description: dto.description ?? null,
      caseType: dto.caseType || 'simple',
      serviceType: dto.serviceType || 'aller_retour',
      ...(opts.status ? { status: opts.status } : {}),
      origin: dto.origin ?? null,
      originAddress: dto.originAddress ?? null,
      destination: dto.destination ?? null,
      destinationAddress: dto.destinationAddress ?? null,
      distanceKm: dto.distanceKm ?? null,
      durationDays: dto.durationDays ?? 1,
      departureAt,
      returnAt: parseDate(dto.returnAt),
      garageDepartureAt: parseDate(dto.garageDepartureAt),
      presentationAt: parseDate(dto.presentationAt),
      onSiteAt: parseDate(dto.onSiteAt),
      returnDepartureAt: parseDate(dto.returnDepartureAt),
      returnGarageAt: parseDate(dto.returnGarageAt),
      vehicleCount,
      vehicleCategoryId: dto.vehicleCategoryId || null,
      passengers,
      amountHt,
      proposedPriceHt,
      vatRate,
      amountTtc,
      depositPercent,
      depositAmountHt,
      customerPoNumber: dto.customerPoNumber ?? null,
      billingEmail: dto.billingEmail ?? null,
      luggageNotes: dto.luggageNotes ?? null,
      accessibilityNotes: dto.accessibilityNotes ?? null,
      optionsNotes: dto.optionsNotes ?? null,
      costTolls: dto.costTolls ?? 0,
      costParking: dto.costParking ?? 0,
      costDriverMeals: dto.costDriverMeals ?? 0,
      costHotel: dto.costHotel ?? 0,
      costMisc: dto.costMisc ?? 0,
      refusedReason: dto.refusedReason ?? null,
      marginEst: Math.round((base - costs) * 0.18 * 100) / 100,
      requestReceivedAt: parseDate(dto.requestReceivedAt),
      requestChannel: dto.requestChannel ?? dto.source ?? null,
      proposedAt,
      validUntil,
      acceptedAt: parseDate(dto.acceptedAt),
      announcedAt: parseDate(dto.announcedAt),
      invoicedAt: parseDate(dto.invoicedAt),
      dayDetails: dto.dayDetails ?? null,
      internalNotes: dto.internalNotes ?? null,
      ...(dto.publishedToPortal != null
        ? {
            publishedToPortal: dto.publishedToPortal,
            publishedAt: dto.publishedToPortal ? new Date() : null,
          }
        : {}),
      availabilityNote,
      availabilityConfidence,
      _lines: mappedLines,
    };
  }

  @Post('quotes')
  @RequirePermission('quotes', 'quote', 'create')
  async createQuote(@CurrentUser() user: RequestUser, @Body() dto: QuoteDto) {
    if (!dto.customerId) throw new BadRequestException('Client requis');
    const count = await this.prisma.quote.count({
      where: { companyId: user.companyId },
    });
    const status = dto.status === 'sent' ? 'sent' : 'draft';
    const built = await this.buildQuoteData(user.companyId, dto, {
      forCreate: true,
      status,
    });
    const { _lines, ...data } = built;
    return this.prisma.quote.create({
      data: {
        companyId: user.companyId,
        number: `D-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        ...data,
        ...(_lines ? { lines: { create: _lines } } : {}),
      },
      include: quoteInclude,
    });
  }

  @Patch('quotes/:id')
  @RequirePermission('quotes', 'quote', 'update')
  async updateQuote(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: QuoteDto,
  ) {
    const existing = await this.prisma.quote.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!existing) throw new NotFoundException('Devis introuvable');
    const built = await this.buildQuoteData(user.companyId, {
      ...dto,
      customerId: dto.customerId || existing.customerId,
      vehicleCount: dto.vehicleCount ?? existing.vehicleCount,
      vehicleCategoryId:
        dto.vehicleCategoryId !== undefined
          ? dto.vehicleCategoryId
          : existing.vehicleCategoryId,
      passengers:
        dto.passengers !== undefined ? dto.passengers : existing.passengers,
      amountHt: dto.amountHt ?? existing.amountHt,
      proposedPriceHt: dto.proposedPriceHt ?? existing.proposedPriceHt,
      vatRate: dto.vatRate ?? existing.vatRate,
    });
    const { _lines, ...data } = built;
    if (_lines) {
      await this.prisma.quoteLine.deleteMany({ where: { quoteId: id } });
      await this.prisma.quoteLine.createMany({
        data: _lines.map((l) => ({ ...l, quoteId: id })),
      });
    }
    return this.prisma.quote.update({
      where: { id },
      data: {
        ...data,
        ...(dto.status ? { status: dto.status } : {}),
        version: { increment: 1 },
      },
      include: quoteInclude,
    });
  }

  @Post('quotes/:id/validate')
  @RequirePermission('quotes', 'quote', 'update')
  async validate(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!quote) throw new NotFoundException('Devis introuvable');
    const proposedAt = quote.proposedAt || new Date();
    return this.prisma.quote.update({
      where: { id },
      data: {
        status: 'sent',
        proposedAt,
        validUntil: quote.validUntil || addDays(proposedAt, 20),
      },
      include: quoteInclude,
    });
  }

  @Post('quotes/:id/trash')
  @RequirePermission('quotes', 'quote', 'update')
  async trash(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!quote) throw new NotFoundException('Devis introuvable');
    return this.prisma.quote.update({
      where: { id },
      data: { status: 'trashed' },
      include: quoteInclude,
    });
  }

  @Post('quotes/:id/publish-portal')
  @RequirePermission('quotes', 'quote', 'update')
  async publishPortal(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!quote) throw new NotFoundException('Devis introuvable');
    return this.prisma.quote.update({
      where: { id },
      data: {
        publishedToPortal: true,
        publishedAt: new Date(),
        status: quote.status === 'draft' ? 'sent' : quote.status,
      },
      include: quoteInclude,
    });
  }

  private async ensureOrderAndMission(
    user: RequestUser,
    quote: {
      id: string;
      customerId: string;
      title: string;
      departureAt: Date | null;
      returnAt: Date | null;
      origin: string | null;
      destination: string | null;
      passengers: number;
      status: string;
      salespersonId?: string | null;
      customerPoNumber?: string | null;
      proposedPriceHt?: number;
      amountHt?: number;
      vatRate?: number;
      amountTtc?: number;
      depositAmountHt?: number;
      internalNotes?: string | null;
    },
    missionStatus: string,
  ) {
    let order = await this.prisma.order.findUnique({
      where: { quoteId: quote.id },
      include: { missions: true },
    });
    const amountHt = quote.proposedPriceHt || quote.amountHt || 0;
    const vatRate = quote.vatRate ?? 10;
    const amountTtc =
      quote.amountTtc ||
      Math.round(amountHt * (1 + vatRate / 100) * 100) / 100;
    if (!order) {
      const orderCount = await this.prisma.order.count({
        where: { companyId: user.companyId },
      });
      order = await this.prisma.order.create({
        data: {
          companyId: user.companyId,
          customerId: quote.customerId,
          quoteId: quote.id,
          salespersonId: quote.salespersonId || null,
          number: `C-${new Date().getFullYear()}-${String(orderCount + 1).padStart(4, '0')}`,
          title: quote.title,
          status: 'confirmed',
          origin: quote.origin,
          destination: quote.destination,
          departureAt: quote.departureAt,
          returnAt: quote.returnAt,
          passengers: quote.passengers,
          amountHt,
          vatRate,
          amountTtc,
          depositPaidHt: 0,
          customerPoNumber: quote.customerPoNumber || null,
          confirmedAt: new Date(),
          internalNotes: quote.internalNotes || null,
        },
        include: { missions: true },
      });
    }

    let mission = order.missions[0];
    if (!mission) {
      const missionCount = await this.prisma.mission.count({
        where: { companyId: user.companyId },
      });
      const startsAt = quote.departureAt || new Date();
      const endsAt =
        quote.returnAt ||
        new Date(startsAt.getTime() + 4 * 60 * 60 * 1000);
      const q = quote as typeof quote & {
        originAddress?: string | null;
        destinationAddress?: string | null;
        garageDepartureAt?: Date | null;
        presentationAt?: Date | null;
        returnGarageAt?: Date | null;
        distanceKm?: number | null;
        accessibilityNotes?: string | null;
      };
      mission = await this.prisma.mission.create({
        data: {
          companyId: user.companyId,
          orderId: order.id,
          number: `M-${new Date().getFullYear()}-${String(missionCount + 1).padStart(4, '0')}`,
          title: quote.title,
          startsAt,
          endsAt,
          origin: quote.origin,
          destination: quote.destination,
          originAddress: q.originAddress || null,
          destinationAddress: q.destinationAddress || null,
          garageDepartureAt: q.garageDepartureAt || null,
          presentationAt: q.presentationAt || null,
          returnGarageAt: q.returnGarageAt || null,
          passengers: quote.passengers,
          minSeats: quote.passengers,
          estimatedKm: q.distanceKm ?? null,
          requiresPmr: /pmr|fauteuil|accessib/i.test(
            q.accessibilityNotes || '',
          ),
          clientBrief: q.accessibilityNotes || null,
          status: missionStatus,
        },
      });
    } else if (mission.status !== missionStatus) {
      mission = await this.prisma.mission.update({
        where: { id: mission.id },
        data: { status: missionStatus },
      });
    }

    return { order, mission };
  }

  @Post('quotes/:id/accept')
  @RequirePermission('quotes', 'quote', 'approve')
  async accept(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!quote) throw new BadRequestException('Devis introuvable');

    await this.prisma.quote.update({
      where: { id },
      data: {
        status: 'accepted',
        acceptedAt: quote.acceptedAt || new Date(),
      },
    });

    const result = await this.ensureOrderAndMission(user, quote, 'to_plan');
    return {
      ...(await this.prisma.quote.findUnique({
        where: { id },
        include: quoteInclude,
      })),
      ...result,
    };
  }

  @Post('quotes/:id/to-planning')
  @RequirePermission('quotes', 'quote', 'approve')
  async toPlanning(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!quote) throw new NotFoundException('Devis introuvable');

    await this.prisma.quote.update({
      where: { id },
      data: {
        status: 'planning',
        acceptedAt: quote.acceptedAt || new Date(),
        announcedAt: quote.announcedAt || new Date(),
      },
    });

    const result = await this.ensureOrderAndMission(user, quote, 'to_plan');
    return {
      ...(await this.prisma.quote.findUnique({
        where: { id },
        include: quoteInclude,
      })),
      ...result,
    };
  }

  @Post('quotes/:id/to-billing')
  @RequirePermission('quotes', 'quote', 'approve')
  async toBilling(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!quote) throw new NotFoundException('Devis introuvable');

    const { order, mission } = await this.ensureOrderAndMission(
      user,
      quote,
      'done',
    );

    const existingInv = await this.prisma.invoice.findFirst({
      where: {
        companyId: user.companyId,
        customerId: quote.customerId,
        missionId: mission.id,
      },
    });
    if (existingInv) {
      await this.prisma.quote.update({
        where: { id },
        data: {
          status: 'invoicing',
          invoicedAt: quote.invoicedAt || new Date(),
        },
      });
      return {
        ...(await this.prisma.quote.findUnique({
          where: { id },
          include: quoteInclude,
        })),
        order,
        mission,
        invoice: existingInv,
      };
    }

    const amountHt = quote.proposedPriceHt || quote.amountHt;
    const vatRate = quote.vatRate;
    const amountTtc = Math.round(amountHt * (1 + vatRate / 100) * 100) / 100;
    const count = await this.prisma.invoice.count({
      where: { companyId: user.companyId },
    });
    const quoteLines = await this.prisma.quoteLine.findMany({
      where: { quoteId: quote.id },
      orderBy: { sortOrder: 'asc' },
    });
    const customer = await this.prisma.customer.findUnique({
      where: { id: quote.customerId },
    });
    const invoice = await this.prisma.invoice.create({
      data: {
        companyId: user.companyId,
        customerId: quote.customerId,
        missionId: mission.id,
        quoteId: quote.id,
        orderId: order.id,
        number: `F-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        status: 'draft',
        kind: 'standard',
        amountHt,
        vatRate,
        amountTtc,
        balance: amountTtc,
        customerPoNumber: quote.customerPoNumber || null,
        paymentTermsDays: customer?.paymentTermsDays ?? 30,
        paymentMethod: customer?.paymentMethod || 'transfer',
        serviceFrom: quote.departureAt,
        serviceTo: quote.returnAt,
        dueAt: addDays(new Date(), customer?.paymentTermsDays || 30),
        legalMentions: [
          customer?.latePenaltyRate
            ? `Pénalités de retard : ${customer.latePenaltyRate} % / an`
            : null,
          customer?.earlyDiscountRate
            ? `Escompte pour paiement anticipé : ${customer.earlyDiscountRate} %`
            : null,
          'TVA applicable selon le régime en vigueur.',
        ]
          .filter(Boolean)
          .join('\n'),
        notes: `Issu du devis ${quote.number}`,
        lines: {
          create:
            quoteLines.length > 0
              ? quoteLines.map((l) => ({
                  kind: l.kind,
                  label: l.label,
                  unit: l.unit,
                  quantity: l.quantity,
                  unitPriceHt: l.unitPriceHt,
                  amountHt: l.amountHt,
                  sortOrder: l.sortOrder,
                }))
              : [
                  {
                    kind: 'transport',
                    label: quote.title,
                    unit: 'forfait',
                    quantity: 1,
                    unitPriceHt: amountHt,
                    amountHt,
                  },
                ],
        },
      },
      include: { lines: true },
    });

    await this.prisma.quote.update({
      where: { id },
      data: {
        status: 'invoicing',
        invoicedAt: new Date(),
      },
    });

    return {
      ...(await this.prisma.quote.findUnique({
        where: { id },
        include: quoteInclude,
      })),
      order,
      mission,
      invoice,
    };
  }

  @Post('quotes/:id/refuse')
  @RequirePermission('quotes', 'quote', 'update')
  async refuse(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!quote) throw new NotFoundException('Devis introuvable');
    return this.prisma.quote.update({
      where: { id },
      data: {
        status: 'refused',
        refusedReason: body.reason || quote.refusedReason,
      },
      include: quoteInclude,
    });
  }

  @Post('quotes/:id/duplicate')
  @RequirePermission('quotes', 'quote', 'create')
  async duplicate(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId: user.companyId },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!quote) throw new NotFoundException('Devis introuvable');
    const count = await this.prisma.quote.count({
      where: { companyId: user.companyId },
    });
    return this.prisma.quote.create({
      data: {
        companyId: user.companyId,
        customerId: quote.customerId,
        contactId: quote.contactId,
        salespersonId: quote.salespersonId,
        source: quote.source,
        number: `D-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        caseType: quote.caseType,
        serviceType: quote.serviceType,
        status: 'draft',
        title: `${quote.title} (copie)`,
        description: quote.description,
        departureAt: quote.departureAt,
        returnAt: quote.returnAt,
        garageDepartureAt: quote.garageDepartureAt,
        presentationAt: quote.presentationAt,
        onSiteAt: quote.onSiteAt,
        returnDepartureAt: quote.returnDepartureAt,
        returnGarageAt: quote.returnGarageAt,
        origin: quote.origin,
        originAddress: quote.originAddress,
        destination: quote.destination,
        destinationAddress: quote.destinationAddress,
        distanceKm: quote.distanceKm,
        durationDays: quote.durationDays,
        vehicleCount: quote.vehicleCount,
        vehicleCategoryId: quote.vehicleCategoryId,
        passengers: quote.passengers,
        amountHt: quote.amountHt,
        proposedPriceHt: quote.proposedPriceHt,
        vatRate: quote.vatRate,
        amountTtc: quote.amountTtc,
        marginEst: quote.marginEst,
        depositPercent: quote.depositPercent,
        depositAmountHt: quote.depositAmountHt,
        customerPoNumber: null,
        billingEmail: quote.billingEmail,
        luggageNotes: quote.luggageNotes,
        accessibilityNotes: quote.accessibilityNotes,
        optionsNotes: quote.optionsNotes,
        costTolls: quote.costTolls,
        costParking: quote.costParking,
        costDriverMeals: quote.costDriverMeals,
        costHotel: quote.costHotel,
        costMisc: quote.costMisc,
        dayDetails: quote.dayDetails,
        internalNotes: quote.internalNotes,
        requestChannel: quote.requestChannel,
        requestReceivedAt: new Date(),
        proposedAt: new Date(),
        validUntil: addDays(new Date(), 20),
        version: 1,
        lines: {
          create: quote.lines.map((l) => ({
            kind: l.kind,
            label: l.label,
            unit: l.unit,
            quantity: l.quantity,
            unitPriceHt: l.unitPriceHt,
            amountHt: l.amountHt,
            sortOrder: l.sortOrder,
          })),
        },
      },
      include: quoteInclude,
    });
  }

  @Get('orders')
  @RequirePermission('orders', 'order', 'list')
  orders(@CurrentUser() user: RequestUser) {
    return this.prisma.order.findMany({
      where: { companyId: user.companyId },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('orders/:id')
  @RequirePermission('orders', 'order', 'list')
  async order(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, companyId: user.companyId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Commande introuvable');
    return order;
  }

  @Patch('orders/:id')
  @RequirePermission('orders', 'order', 'list')
  async patchOrder(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: OrderPatchDto,
  ) {
    const existing = await this.prisma.order.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!existing) throw new NotFoundException('Commande introuvable');
    const status = dto.status ?? existing.status;
    return this.prisma.order.update({
      where: { id },
      data: {
        ...(dto.title != null ? { title: dto.title } : {}),
        ...(dto.customerPoNumber !== undefined
          ? { customerPoNumber: dto.customerPoNumber }
          : {}),
        ...(dto.clientNotes !== undefined
          ? { clientNotes: dto.clientNotes }
          : {}),
        ...(dto.internalNotes !== undefined
          ? { internalNotes: dto.internalNotes }
          : {}),
        ...(dto.depositPaidHt !== undefined
          ? { depositPaidHt: dto.depositPaidHt }
          : {}),
        ...(dto.salespersonId !== undefined
          ? { salespersonId: dto.salespersonId }
          : {}),
        status,
        ...(status === 'cancelled'
          ? {
              cancelledAt: existing.cancelledAt || new Date(),
              cancelReason: dto.cancelReason || existing.cancelReason,
            }
          : {}),
        ...(status === 'confirmed' && !existing.confirmedAt
          ? { confirmedAt: new Date() }
          : {}),
      },
      include: orderInclude,
    });
  }

  @Get('missions')
  @RequirePermission('missions', 'mission', 'list')
  missions(@CurrentUser() user: RequestUser) {
    return this.prisma.mission.findMany({
      where: { companyId: user.companyId },
      include: {
        order: { include: { customer: true } },
        assignments: {
          include: { driver: { include: { employee: true } }, vehicle: true },
        },
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
        assignments: {
          include: { driver: { include: { employee: true } }, vehicle: true },
        },
        documents: true,
      },
    });
  }

  @Patch('missions/:id')
  @RequirePermission('missions', 'mission', 'update')
  async patchMission(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body()
    body: {
      status?: string;
      title?: string;
      origin?: string | null;
      destination?: string | null;
      originAddress?: string | null;
      destinationAddress?: string | null;
      passengers?: number;
      minSeats?: number | null;
      requiresPmr?: boolean;
      estimatedKm?: number | null;
      hlpKm?: number | null;
      opsNotes?: string | null;
      clientBrief?: string | null;
      roadSheetNotes?: string | null;
      stopsJson?: string | null;
      startsAt?: string;
      endsAt?: string;
      garageDepartureAt?: string | null;
      presentationAt?: string | null;
      returnGarageAt?: string | null;
    },
  ) {
    const existing = await this.prisma.mission.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!existing) throw new NotFoundException('Mission introuvable');
    const parse = (v?: string | null) => {
      if (v === undefined) return undefined;
      if (!v) return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    return this.prisma.mission.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.title != null ? { title: body.title } : {}),
        ...(body.origin !== undefined ? { origin: body.origin } : {}),
        ...(body.destination !== undefined
          ? { destination: body.destination }
          : {}),
        ...(body.originAddress !== undefined
          ? { originAddress: body.originAddress }
          : {}),
        ...(body.destinationAddress !== undefined
          ? { destinationAddress: body.destinationAddress }
          : {}),
        ...(body.passengers !== undefined
          ? { passengers: body.passengers }
          : {}),
        ...(body.minSeats !== undefined ? { minSeats: body.minSeats } : {}),
        ...(body.requiresPmr !== undefined
          ? { requiresPmr: body.requiresPmr }
          : {}),
        ...(body.estimatedKm !== undefined
          ? { estimatedKm: body.estimatedKm }
          : {}),
        ...(body.hlpKm !== undefined ? { hlpKm: body.hlpKm } : {}),
        ...(body.opsNotes !== undefined ? { opsNotes: body.opsNotes } : {}),
        ...(body.clientBrief !== undefined
          ? { clientBrief: body.clientBrief }
          : {}),
        ...(body.roadSheetNotes !== undefined
          ? { roadSheetNotes: body.roadSheetNotes }
          : {}),
        ...(body.stopsJson !== undefined ? { stopsJson: body.stopsJson } : {}),
        ...(body.startsAt ? { startsAt: new Date(body.startsAt) } : {}),
        ...(body.endsAt ? { endsAt: new Date(body.endsAt) } : {}),
        ...(body.garageDepartureAt !== undefined
          ? { garageDepartureAt: parse(body.garageDepartureAt) }
          : {}),
        ...(body.presentationAt !== undefined
          ? { presentationAt: parse(body.presentationAt) }
          : {}),
        ...(body.returnGarageAt !== undefined
          ? { returnGarageAt: parse(body.returnGarageAt) }
          : {}),
      },
      include: {
        order: { include: { customer: true, quote: true } },
        assignments: {
          include: {
            driver: { include: { employee: true } },
            vehicle: true,
          },
        },
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

@Controller('vehicle-categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
class VehicleCategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('fleet', 'vehicle', 'list')
  list(@CurrentUser() user: RequestUser) {
    return this.prisma.vehicleCategory.findMany({
      where: { companyId: user.companyId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { vehicles: true } } },
    });
  }

  @Post()
  @RequirePermission('fleet', 'vehicle', 'create')
  create(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      code: string;
      name: string;
      defaultSeats?: number;
      description?: string;
    },
  ) {
    return this.prisma.vehicleCategory.create({
      data: {
        companyId: user.companyId,
        code: body.code,
        name: body.name,
        defaultSeats: body.defaultSeats ?? 53,
        description: body.description,
      },
    });
  }
}

@Module({
  imports: [AuthModule],
  controllers: [CommercialController, VehicleCategoriesController],
})
export class CommercialModule {}
