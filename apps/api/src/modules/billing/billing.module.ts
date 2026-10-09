import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard } from '../iam/guards';
import { CurrentUser, RequirePermission } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';
import { AuthModule } from '../iam/auth.module';

/**
 * Phase 4 foundation — factures / avoirs / règlements multi-factures / trop-perçus
 * Tables stockées en JSON dans OpsAlert n'est PAS correct — on utilise des modèles légers via Prisma raw?
 * Pour SQLite sans migration lourde supplémentaire ici: on ajoute via schema déjà... 
 * On utilise des tables Invoice* — need schema. If not in schema yet, use GeneratedDocument-like storage.
 *
 * Minimal: store invoices as records using a simple approach with existing Mission linkage via GeneratedDocument kind,
 * OR add Invoice models to schema. Adding now requires db push — do invoice models in a companion schema update.
 */

@Controller('billing')
@UseGuards(JwtAuthGuard, PermissionsGuard)
class BillingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('invoices')
  @RequirePermission('billing', 'invoice', 'list')
  list(@CurrentUser() user: RequestUser) {
    return this.prisma.invoice.findMany({
      where: { companyId: user.companyId },
      include: {
        customer: true,
        lines: true,
        allocations: { include: { payment: true } },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  @Post('invoices/from-mission/:missionId')
  @RequirePermission('billing', 'invoice', 'list')
  async fromMission(
    @CurrentUser() user: RequestUser,
    @Param('missionId') missionId: string,
    @Body() body: { kind?: string; amountHt?: number },
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
      mission.order.quote?.amountHt ??
      mission.passengers * 8;
    const vatRate = 10;
    const amountTtc = Math.round(amountHt * (1 + vatRate / 100) * 100) / 100;
    const kind = body.kind || 'standard';
    const invoice = await this.prisma.invoice.create({
      data: {
        companyId: user.companyId,
        customerId: mission.order.customerId,
        missionId: mission.id,
        number: `F-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        kind,
        status: 'issued',
        amountHt,
        vatRate,
        amountTtc,
        balance: amountTtc,
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
    const credit = await this.prisma.invoice.create({
      data: {
        companyId: user.companyId,
        customerId: inv.customerId,
        missionId: inv.missionId,
        number: `A-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        kind: 'credit_note',
        status: 'issued',
        amountHt: -Math.abs(amountTtc / 1.1),
        vatRate: inv.vatRate,
        amountTtc: -Math.abs(amountTtc),
        balance: -Math.abs(amountTtc),
        relatedInvoiceId: inv.id,
        notes: body.reason || 'Avoir',
        lines: {
          create: [
            {
              label: `Avoir sur ${inv.number}`,
              quantity: 1,
              unitPriceHt: -Math.abs(amountTtc / 1.1),
              amountHt: -Math.abs(amountTtc / 1.1),
            },
          ],
        },
      },
      include: { lines: true },
    });
    return credit;
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
        allocations: {
          create: body.allocations.map((a) => ({
            invoiceId: a.invoiceId,
            amount: a.amount,
          })),
        },
      },
      include: { allocations: true },
    });
    for (const a of body.allocations) {
      const inv = await this.prisma.invoice.findUnique({ where: { id: a.invoiceId } });
      if (!inv) continue;
      const balance = Math.round((inv.balance - a.amount) * 100) / 100;
      await this.prisma.invoice.update({
        where: { id: a.invoiceId },
        data: {
          balance,
          status: balance <= 0.001 ? 'paid' : 'partial',
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
    });
  }
}

@Module({ imports: [AuthModule], controllers: [BillingController] })
export class BillingModule {}
