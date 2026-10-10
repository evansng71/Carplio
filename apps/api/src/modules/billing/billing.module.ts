import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
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

class LineDto {
  @IsString() label!: string;
  @IsOptional() @IsString() kind?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() @Min(0) quantity?: number;
  @IsOptional() @IsNumber() unitPriceHt?: number;
}

class ManualInvoiceDto {
  @IsString() customerId!: string;
  @IsOptional() @IsString() missionId?: string;
  @IsOptional() @IsString() quoteId?: string;
  @IsOptional() @IsString() orderId?: string;
  @IsOptional() @IsString() kind?: string;
  @IsOptional() @IsNumber() vatRate?: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() dueAt?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() customerPoNumber?: string | null;
  @IsOptional() @IsNumber() paymentTermsDays?: number;
  @IsOptional() @IsString() paymentMethod?: string | null;
  @IsOptional() @IsString() serviceFrom?: string | null;
  @IsOptional() @IsString() serviceTo?: string | null;
  @IsOptional() @IsString() legalMentions?: string | null;
  @IsOptional() @IsString() reference?: string | null;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineDto)
  lines!: LineDto[];
}

class PatchInvoiceDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsString() dueAt?: string | null;
  @IsOptional() @IsNumber() vatRate?: number;
  @IsOptional() @IsString() kind?: string;
  @IsOptional() @IsString() customerPoNumber?: string | null;
  @IsOptional() @IsNumber() paymentTermsDays?: number | null;
  @IsOptional() @IsString() paymentMethod?: string | null;
  @IsOptional() @IsString() serviceFrom?: string | null;
  @IsOptional() @IsString() serviceTo?: string | null;
  @IsOptional() @IsString() legalMentions?: string | null;
  @IsOptional() @IsString() reference?: string | null;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineDto)
  lines?: LineDto[];
}

function mapLines(lines: LineDto[]) {
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

function defaultLegalMentions(customer: {
  latePenaltyRate?: number | null;
  earlyDiscountRate?: number | null;
  paymentTermsDays?: number;
}) {
  return [
    `Conditions de règlement : ${customer.paymentTermsDays || 30} jours`,
    customer.latePenaltyRate
      ? `Pénalités de retard : ${customer.latePenaltyRate} % / an`
      : 'Pénalités de retard : taux légal en vigueur',
    customer.earlyDiscountRate
      ? `Escompte pour paiement anticipé : ${customer.earlyDiscountRate} %`
      : 'Pas d’escompte pour paiement anticipé',
    'En cas de retard de paiement, une indemnité forfaitaire de 40 € pour frais de recouvrement sera due.',
  ].join('\n');
}

function calcTotals(
  lines: Array<{ quantity: number; unitPriceHt: number }>,
  vatRate: number,
) {
  const amountHt =
    Math.round(
      lines.reduce((s, l) => s + l.quantity * l.unitPriceHt, 0) * 100,
    ) / 100;
  const amountTtc = Math.round(amountHt * (1 + vatRate / 100) * 100) / 100;
  return { amountHt, amountTtc };
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

@Controller('billing')
@UseGuards(JwtAuthGuard, PermissionsGuard)
class BillingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('overview')
  @RequirePermission('billing', 'invoice', 'list')
  async overview(@CurrentUser() user: RequestUser) {
    const invoices = await this.prisma.invoice.findMany({
      where: { companyId: user.companyId, kind: { not: 'credit_note' } },
      select: {
        status: true,
        amountTtc: true,
        balance: true,
        dueAt: true,
        kind: true,
      },
    });
    const now = new Date();
    let issued = 0;
    let paid = 0;
    let outstanding = 0;
    let overdue = 0;
    let draft = 0;
    for (const i of invoices) {
      if (i.status === 'draft') draft += 1;
      if (i.status === 'paid') paid += i.amountTtc;
      else issued += i.amountTtc;
      if (i.balance > 0.001) {
        outstanding += i.balance;
        if (i.dueAt && i.dueAt < now) overdue += i.balance;
      }
    }
    const credits = await this.prisma.customerCredit.aggregate({
      where: { companyId: user.companyId, remaining: { gt: 0 } },
      _sum: { remaining: true },
    });
    return {
      count: invoices.length,
      draft,
      issuedTtc: Math.round(issued * 100) / 100,
      paidTtc: Math.round(paid * 100) / 100,
      outstanding: Math.round(outstanding * 100) / 100,
      overdue: Math.round(overdue * 100) / 100,
      creditsRemaining: credits._sum.remaining || 0,
    };
  }

  @Get('invoices')
  @RequirePermission('billing', 'invoice', 'list')
  list(@CurrentUser() user: RequestUser) {
    return this.prisma.invoice.findMany({
      where: { companyId: user.companyId },
      include: {
        customer: true,
        quote: { select: { id: true, number: true } },
        order: { select: { id: true, number: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
        allocations: { include: { payment: true } },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  @Get('invoices/:id')
  @RequirePermission('billing', 'invoice', 'list')
  async get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        customer: true,
        quote: { select: { id: true, number: true, title: true } },
        order: { select: { id: true, number: true, title: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
        allocations: { include: { payment: true } },
      },
    });
    if (!inv) throw new NotFoundException('Facture introuvable');
    return inv;
  }

  @Post('invoices')
  @RequirePermission('billing', 'invoice', 'list')
  async createManual(
    @CurrentUser() user: RequestUser,
    @Body() dto: ManualInvoiceDto,
  ) {
    if (!dto.lines?.length) {
      throw new BadRequestException('Au moins une ligne est requise');
    }
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, companyId: user.companyId },
    });
    if (!customer) throw new BadRequestException('Client introuvable');
    if (customer.requirePurchaseOrder && !dto.customerPoNumber) {
      throw new BadRequestException(
        'Bon de commande client obligatoire pour ce compte',
      );
    }

    const vatRate = dto.vatRate ?? 10;
    const lines = mapLines(dto.lines);
    const { amountHt, amountTtc } = calcTotals(lines, vatRate);
    const count = await this.prisma.invoice.count({
      where: { companyId: user.companyId },
    });
    const status = dto.status === 'issued' ? 'issued' : 'draft';
    const terms = dto.paymentTermsDays ?? customer.paymentTermsDays ?? 30;
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : addDays(new Date(), terms);
    const prefix =
      dto.kind === 'credit_note'
        ? 'A'
        : dto.kind === 'deposit'
          ? 'FA'
          : 'F';

    return this.prisma.invoice.create({
      data: {
        companyId: user.companyId,
        customerId: dto.customerId,
        missionId: dto.missionId || null,
        quoteId: dto.quoteId || null,
        orderId: dto.orderId || null,
        number: `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        kind: dto.kind || 'standard',
        status,
        amountHt,
        vatRate,
        amountTtc,
        balance: amountTtc,
        notes: dto.notes,
        dueAt,
        customerPoNumber: dto.customerPoNumber || null,
        paymentTermsDays: terms,
        paymentMethod: dto.paymentMethod || customer.paymentMethod || 'transfer',
        serviceFrom: dto.serviceFrom ? new Date(dto.serviceFrom) : null,
        serviceTo: dto.serviceTo ? new Date(dto.serviceTo) : null,
        legalMentions: dto.legalMentions || defaultLegalMentions(customer),
        reference: dto.reference || null,
        lines: { create: lines },
      },
      include: { lines: true, customer: true },
    });
  }

  @Patch('invoices/:id')
  @RequirePermission('billing', 'invoice', 'list')
  async patch(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: PatchInvoiceDto,
  ) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id, companyId: user.companyId },
      include: { allocations: true },
    });
    if (!inv) throw new NotFoundException('Facture introuvable');
    if (inv.status !== 'draft' && dto.lines) {
      throw new BadRequestException(
        'Les lignes ne sont modifiables qu’en brouillon',
      );
    }

    const vatRate = dto.vatRate ?? inv.vatRate;
    let amountHt = inv.amountHt;
    let amountTtc = inv.amountTtc;

    if (dto.lines) {
      const lines = mapLines(dto.lines);
      const totals = calcTotals(lines, vatRate);
      amountHt = totals.amountHt;
      amountTtc = totals.amountTtc;
      await this.prisma.invoiceLine.deleteMany({ where: { invoiceId: id } });
      await this.prisma.invoiceLine.createMany({
        data: lines.map((l) => ({ ...l, invoiceId: id })),
      });
    }

    const paid = inv.allocations.reduce((s, a) => s + a.amount, 0);
    const balance = Math.round((amountTtc - paid) * 100) / 100;
    let status = dto.status ?? inv.status;
    let paidAt = inv.paidAt;
    if (status === 'paid' || balance <= 0.001) {
      status = 'paid';
      paidAt = inv.paidAt || new Date();
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        status,
        kind: dto.kind ?? inv.kind,
        notes: dto.notes !== undefined ? dto.notes : inv.notes,
        dueAt:
          dto.dueAt === undefined
            ? inv.dueAt
            : dto.dueAt
              ? new Date(dto.dueAt)
              : null,
        vatRate,
        amountHt,
        amountTtc,
        balance: status === 'paid' ? 0 : Math.max(balance, 0),
        paidAt,
        customerPoNumber:
          dto.customerPoNumber !== undefined
            ? dto.customerPoNumber
            : inv.customerPoNumber,
        paymentTermsDays:
          dto.paymentTermsDays !== undefined
            ? dto.paymentTermsDays
            : inv.paymentTermsDays,
        paymentMethod:
          dto.paymentMethod !== undefined
            ? dto.paymentMethod
            : inv.paymentMethod,
        serviceFrom:
          dto.serviceFrom === undefined
            ? inv.serviceFrom
            : dto.serviceFrom
              ? new Date(dto.serviceFrom)
              : null,
        serviceTo:
          dto.serviceTo === undefined
            ? inv.serviceTo
            : dto.serviceTo
              ? new Date(dto.serviceTo)
              : null,
        legalMentions:
          dto.legalMentions !== undefined
            ? dto.legalMentions
            : inv.legalMentions,
        reference:
          dto.reference !== undefined ? dto.reference : inv.reference,
      },
      include: {
        customer: true,
        quote: { select: { id: true, number: true, title: true } },
        order: { select: { id: true, number: true, title: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
        allocations: { include: { payment: true } },
      },
    });
  }

  @Post('invoices/:id/issue')
  @RequirePermission('billing', 'invoice', 'list')
  async issue(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!inv) throw new NotFoundException('Facture introuvable');
    return this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'issued',
        issuedAt: new Date(),
        dueAt: inv.dueAt || addDays(new Date(), 30),
      },
      include: { customer: true, lines: true },
    });
  }

  @Post('invoices/:id/cancel')
  @RequirePermission('billing', 'invoice', 'list')
  async cancel(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!inv) throw new NotFoundException('Facture introuvable');
    if (inv.status === 'paid') {
      throw new BadRequestException('Impossible d’annuler une facture payée');
    }
    return this.prisma.invoice.update({
      where: { id },
      data: { status: 'cancelled', balance: 0 },
      include: { customer: true, lines: true },
    });
  }

  @Post('invoices/from-mission/:missionId')
  @RequirePermission('billing', 'invoice', 'list')
  async fromMission(
    @CurrentUser() user: RequestUser,
    @Param('missionId') missionId: string,
    @Body() body: { kind?: string; amountHt?: number; status?: string },
  ) {
    const mission = await this.prisma.mission.findFirst({
      where: { id: missionId, companyId: user.companyId },
      include: { order: { include: { customer: true, quote: true } } },
    });
    if (!mission) throw new BadRequestException('Mission introuvable');
    const count = await this.prisma.invoice.count({
      where: { companyId: user.companyId },
    });
    const amountHt =
      body.amountHt ??
      mission.order.quote?.proposedPriceHt ??
      mission.order.quote?.amountHt ??
      mission.passengers * 8;
    const vatRate = mission.order.quote?.vatRate ?? 10;
    const amountTtc = Math.round(amountHt * (1 + vatRate / 100) * 100) / 100;
    const kind = body.kind || 'standard';
    const status = body.status === 'draft' ? 'draft' : 'issued';
    const terms = mission.order.customer.paymentTermsDays || 30;
    const invoice = await this.prisma.invoice.create({
      data: {
        companyId: user.companyId,
        customerId: mission.order.customerId,
        missionId: mission.id,
        number: `F-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        kind,
        status,
        amountHt,
        vatRate,
        amountTtc,
        balance: amountTtc,
        dueAt: addDays(new Date(), terms),
        lines: {
          create: [
            {
              label: `${mission.number} — ${mission.title}`,
              quantity: 1,
              unitPriceHt: amountHt,
              amountHt,
            },
          ],
        },
      },
      include: { lines: true, customer: true },
    });
    await this.prisma.mission.update({
      where: { id: mission.id },
      data: { status: 'to_invoice' },
    });
    return invoice;
  }

  @Post('invoices/from-quote/:quoteId')
  @RequirePermission('billing', 'invoice', 'list')
  async fromQuote(
    @CurrentUser() user: RequestUser,
    @Param('quoteId') quoteId: string,
    @Body() body: { kind?: string; status?: string },
  ) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, companyId: user.companyId },
      include: {
        customer: true,
        lines: { orderBy: { sortOrder: 'asc' } },
        order: true,
      },
    });
    if (!quote) throw new BadRequestException('Devis introuvable');
    if (
      quote.customer.requirePurchaseOrder &&
      !quote.customerPoNumber
    ) {
      throw new BadRequestException(
        'Bon de commande client manquant sur le devis',
      );
    }
    const kind = body.kind || 'standard';
    const amountHt =
      kind === 'deposit'
        ? quote.depositAmountHt ||
          Math.round(quote.proposedPriceHt * (quote.depositPercent / 100) * 100) /
            100
        : quote.proposedPriceHt || quote.amountHt;
    const vatRate = quote.vatRate;
    const amountTtc = Math.round(amountHt * (1 + vatRate / 100) * 100) / 100;
    const count = await this.prisma.invoice.count({
      where: { companyId: user.companyId },
    });
    const status = body.status === 'issued' ? 'issued' : 'draft';
    const terms = quote.customer.paymentTermsDays || 30;
    const prefix = kind === 'deposit' ? 'FA' : 'F';
    const lines =
      kind === 'deposit'
        ? [
            {
              kind: 'transport',
              label: `Acompte ${quote.depositPercent || ''}% — ${quote.title}`,
              unit: 'forfait',
              quantity: 1,
              unitPriceHt: amountHt,
              amountHt,
              sortOrder: 0,
            },
          ]
        : quote.lines.length > 0
          ? quote.lines.map((l) => ({
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
                sortOrder: 0,
              },
            ];

    return this.prisma.invoice.create({
      data: {
        companyId: user.companyId,
        customerId: quote.customerId,
        quoteId: quote.id,
        orderId: quote.order?.id || null,
        number: `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        kind,
        status,
        amountHt,
        vatRate,
        amountTtc,
        balance: amountTtc,
        customerPoNumber: quote.customerPoNumber,
        paymentTermsDays: terms,
        paymentMethod: quote.customer.paymentMethod || 'transfer',
        serviceFrom: quote.departureAt,
        serviceTo: quote.returnAt,
        dueAt: addDays(new Date(), terms),
        legalMentions: defaultLegalMentions(quote.customer),
        notes: `Issu du devis ${quote.number}`,
        lines: { create: lines },
      },
      include: { lines: true, customer: true },
    });
  }

  @Post('invoices/:id/remind')
  @RequirePermission('billing', 'invoice', 'list')
  async remind(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!inv) throw new NotFoundException('Facture introuvable');
    if (inv.status === 'paid' || inv.status === 'cancelled' || inv.status === 'draft') {
      throw new BadRequestException('Relance impossible pour ce statut');
    }
    return this.prisma.invoice.update({
      where: { id },
      data: {
        reminderCount: { increment: 1 },
        lastReminderAt: new Date(),
      },
      include: {
        customer: true,
        lines: true,
        allocations: { include: { payment: true } },
      },
    });
  }

  @Post('invoices/:id/credit-note')
  @RequirePermission('billing', 'invoice', 'list')
  async credit(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { amountTtc?: number; reason?: string },
  ) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!inv) throw new BadRequestException('Facture introuvable');
    const amountTtc = body.amountTtc ?? inv.amountTtc;
    const count = await this.prisma.invoice.count({
      where: { companyId: user.companyId },
    });
    const ht = Math.round((Math.abs(amountTtc) / (1 + inv.vatRate / 100)) * 100) / 100;
    const credit = await this.prisma.invoice.create({
      data: {
        companyId: user.companyId,
        customerId: inv.customerId,
        missionId: inv.missionId,
        number: `A-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        kind: 'credit_note',
        status: 'issued',
        amountHt: -ht,
        vatRate: inv.vatRate,
        amountTtc: -Math.abs(amountTtc),
        balance: 0,
        relatedInvoiceId: inv.id,
        notes: body.reason || 'Avoir',
        lines: {
          create: [
            {
              label: `Avoir sur ${inv.number}`,
              quantity: 1,
              unitPriceHt: -ht,
              amountHt: -ht,
            },
          ],
        },
      },
      include: { lines: true, customer: true },
    });
    return credit;
  }

  @Get('payments')
  @RequirePermission('billing', 'invoice', 'list')
  payments(@CurrentUser() user: RequestUser) {
    return this.prisma.payment.findMany({
      where: { companyId: user.companyId },
      include: {
        customer: true,
        allocations: { include: { invoice: true } },
      },
      orderBy: { paidAt: 'desc' },
    });
  }

  @Post('payments')
  @RequirePermission('billing', 'invoice', 'list')
  async pay(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      customerId: string;
      amount: number;
      method?: string;
      notes?: string;
      allocations: Array<{ invoiceId: string; amount: number }>;
    },
  ) {
    const sum = body.allocations.reduce((a, x) => a + x.amount, 0);
    if (sum > body.amount + 0.001) {
      throw new BadRequestException('Ventilation supérieure au paiement');
    }
    const overpay = Math.round((body.amount - sum) * 100) / 100;
    const payment = await this.prisma.payment.create({
      data: {
        companyId: user.companyId,
        customerId: body.customerId,
        amount: body.amount,
        method: body.method || 'transfer',
        notes: body.notes,
        allocations: {
          create: body.allocations.map((a) => ({
            invoiceId: a.invoiceId,
            amount: a.amount,
          })),
        },
      },
      include: { allocations: true, customer: true },
    });
    for (const a of body.allocations) {
      const inv = await this.prisma.invoice.findUnique({
        where: { id: a.invoiceId },
      });
      if (!inv) continue;
      const balance = Math.round((inv.balance - a.amount) * 100) / 100;
      await this.prisma.invoice.update({
        where: { id: a.invoiceId },
        data: {
          balance: Math.max(balance, 0),
          status: balance <= 0.001 ? 'paid' : 'partial',
          paidAt: balance <= 0.001 ? new Date() : inv.paidAt,
        },
      });
    }
    let credit = null;
    if (overpay > 0) {
      credit = await this.prisma.customerCredit.create({
        data: {
          companyId: user.companyId,
          customerId: body.customerId,
          amount: overpay,
          remaining: overpay,
          sourcePaymentId: payment.id,
          notes: 'Trop-perçu',
        },
      });
    }
    return { payment, overpay, credit };
  }

  @Get('credits')
  @RequirePermission('billing', 'invoice', 'list')
  credits(@CurrentUser() user: RequestUser) {
    return this.prisma.customerCredit.findMany({
      where: { companyId: user.companyId, remaining: { gt: 0 } },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('missions-to-invoice')
  @RequirePermission('billing', 'invoice', 'list')
  missionsToInvoice(@CurrentUser() user: RequestUser) {
    return this.prisma.mission.findMany({
      where: {
        companyId: user.companyId,
        status: { in: ['done', 'to_invoice', 'ops_return_review', 'published'] },
      },
      include: {
        order: { include: { customer: true, quote: true } },
      },
      orderBy: { startsAt: 'desc' },
      take: 50,
    });
  }
}

@Module({ imports: [AuthModule], controllers: [BillingController] })
export class BillingModule {}
