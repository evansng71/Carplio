import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard } from '../iam/guards';
import { CurrentUser, RequirePermission } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';
import { AuthModule } from '../iam/auth.module';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
class AnalyticsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('quality/classifications')
  @RequirePermission('quality', 'incident', 'list')
  classes(@CurrentUser() user: RequestUser) {
    return this.prisma.qualityClassification.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
    });
  }

  @Post('quality/classifications')
  @RequirePermission('quality', 'incident', 'create')
  createClass(
    @CurrentUser() user: RequestUser,
    @Body()
    body: { level: string; code: string; label: string; parentId?: string },
  ) {
    return this.prisma.qualityClassification.create({
      data: { companyId: user.companyId, ...body },
    });
  }

  @Get('quality/events')
  @RequirePermission('quality', 'incident', 'list')
  events(@CurrentUser() user: RequestUser) {
    return this.prisma.qualityEvent.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('quality/events')
  @RequirePermission('quality', 'incident', 'create')
  async createEvent(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      category: string;
      source?: string;
      nature?: string;
      precision?: string;
      overPrecision?: string;
      severity?: string;
      description: string;
      missionId?: string;
      openRepair?: boolean;
      vehicleId?: string;
    },
  ) {
    const event = await this.prisma.qualityEvent.create({
      data: {
        companyId: user.companyId,
        reportedById: user.userId,
        category: body.category,
        source: body.source || 'ops',
        nature: body.nature,
        precision: body.precision,
        overPrecision: body.overPrecision,
        severity: body.severity || 'medium',
        description: body.description,
        missionId: body.missionId,
      },
    });
    let repair = null;
    if (body.openRepair) {
      repair = await this.prisma.repairRequest.create({
        data: {
          companyId: user.companyId,
          vehicleId: body.vehicleId,
          source: 'quality',
          title: `Suite incident: ${body.category}`,
          description: body.description,
          priority: body.severity || 'medium',
        },
      });
    }
    return { event, repair };
  }

  @Get('quality/stats')
  @RequirePermission('quality', 'incident', 'list')
  async stats(@CurrentUser() user: RequestUser) {
    const events = await this.prisma.qualityEvent.findMany({
      where: { companyId: user.companyId },
    });
    const bySource: Record<string, number> = {};
    const byNature: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    for (const e of events) {
      bySource[e.source] = (bySource[e.source] || 0) + 1;
      byNature[e.nature || e.category] = (byNature[e.nature || e.category] || 0) + 1;
      bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
    }
    return { total: events.length, bySource, byNature, bySeverity };
  }

  @Get('analytics/overview')
  @RequirePermission('dashboard', 'analytics', 'list')
  async overview(@CurrentUser() user: RequestUser) {
    const [missions, assignments, invoices, workOrders, prepMonthly, fuel] =
      await Promise.all([
        this.prisma.mission.count({ where: { companyId: user.companyId } }),
        this.prisma.assignment.findMany({
          where: { companyId: user.companyId },
          select: { startsAt: true, endsAt: true, driverId: true, vehicleId: true },
        }),
        this.prisma.invoice.findMany({
          where: { companyId: user.companyId, kind: { not: 'credit_note' } },
        }),
        this.prisma.workOrder.findMany({ where: { companyId: user.companyId } }),
        this.prisma.prePayrollMonthlyLine.findMany({
          where: { companyId: user.companyId },
        }),
        this.prisma.fuelTransaction.findMany({
          where: { companyId: user.companyId, status: 'validated' },
        }),
      ]);

    const hours = assignments.reduce(
      (a, x) => a + (x.endsAt.getTime() - x.startsAt.getTime()) / 3600000,
      0,
    );
    const revenue = invoices.reduce((a, i) => a + i.amountTtc, 0);
    const workshopCost = workOrders.reduce(
      (a, w) => a + w.partsCost + w.laborHours * 45,
      0,
    );
    const payroll = prepMonthly.reduce((a, p) => a + p.amount, 0);
    const fuelCost = fuel.reduce((a, f) => a + f.amount, 0);

    const byDriver: Record<string, number> = {};
    for (const a of assignments) {
      if (!a.driverId) continue;
      byDriver[a.driverId] =
        (byDriver[a.driverId] || 0) +
        (a.endsAt.getTime() - a.startsAt.getTime()) / 3600000;
    }

    return {
      missions,
      hours: Math.round(hours * 10) / 10,
      revenue: Math.round(revenue * 100) / 100,
      workshopCost: Math.round(workshopCost * 100) / 100,
      payroll: Math.round(payroll * 100) / 100,
      fuelCost: Math.round(fuelCost * 100) / 100,
      marginEst: Math.round((revenue - workshopCost - payroll - fuelCost) * 100) / 100,
      byDriver,
    };
  }

  @Get('budgets')
  @RequirePermission('dashboard', 'analytics', 'list')
  budgets(@CurrentUser() user: RequestUser) {
    return this.prisma.budget.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('budgets')
  @RequirePermission('dashboard', 'analytics', 'list')
  async createBudget(
    @CurrentUser() user: RequestUser,
    @Body()
    body: { name: string; year: number; source?: string; fromPlanning?: boolean },
  ) {
    let lines: Array<{ label: string; planned: number; actual: number }> = [];
    if (body.fromPlanning || body.source === 'planning') {
      const assignments = await this.prisma.assignment.count({
        where: { companyId: user.companyId },
      });
      const prep = await this.prisma.prePayrollMonthlyLine.aggregate({
        where: { companyId: user.companyId },
        _sum: { amount: true },
      });
      lines = [
        { label: 'Courses / missions', planned: assignments * 220, actual: 0 },
        {
          label: 'Coût conducteurs (prépaye)',
          planned: (prep._sum.amount || 0) * 1.1,
          actual: prep._sum.amount || 0,
        },
        { label: 'Énergie', planned: 5000, actual: 0 },
      ];
    } else {
      lines = [
        { label: 'Recettes transport', planned: 100000, actual: 0 },
        { label: 'Charges exploitation', planned: 70000, actual: 0 },
      ];
    }
    return this.prisma.budget.create({
      data: {
        companyId: user.companyId,
        name: body.name,
        year: body.year,
        source: body.source || (body.fromPlanning ? 'planning' : 'manual'),
        linesJson: JSON.stringify(lines),
      },
    });
  }

  @Get('budgets/:id/compare')
  @RequirePermission('dashboard', 'analytics', 'list')
  async compare(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!budget) return null;
    const overview = await this.overview(user);
    const lines = JSON.parse(budget.linesJson) as Array<{
      label: string;
      planned: number;
      actual: number;
    }>;
    const enriched = lines.map((l) => {
      let actual = l.actual;
      if (l.label.toLowerCase().includes('prépaye') || l.label.toLowerCase().includes('conducteur')) {
        actual = overview.payroll;
      } else if (l.label.toLowerCase().includes('énergie')) {
        actual = overview.fuelCost;
      } else if (l.label.toLowerCase().includes('recette')) {
        actual = overview.revenue;
      } else if (l.label.toLowerCase().includes('course')) {
        actual = overview.missions * 200;
      }
      return {
        ...l,
        actual,
        variance: Math.round((actual - l.planned) * 100) / 100,
      };
    });
    return { budget, lines: enriched, overview };
  }

  @Get('simulations')
  @RequirePermission('dashboard', 'analytics', 'list')
  simulations(@CurrentUser() user: RequestUser) {
    return this.prisma.simulation.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('simulations')
  @RequirePermission('dashboard', 'analytics', 'list')
  async simulate(
    @CurrentUser() user: RequestUser,
    @Body()
    body: { name: string; kmFactor?: number; costFactor?: number },
  ) {
    const overview = await this.overview(user);
    const kmFactor = body.kmFactor ?? 1.1;
    const costFactor = body.costFactor ?? 1.05;
    const result = {
      revenue: Math.round(overview.revenue * kmFactor * 100) / 100,
      payroll: Math.round(overview.payroll * costFactor * 100) / 100,
      note: 'Simulation isolée — ne modifie pas le planning publié',
    };
    return this.prisma.simulation.create({
      data: {
        companyId: user.companyId,
        name: body.name,
        status: 'done',
        payloadJson: JSON.stringify({ kmFactor, costFactor }),
        resultJson: JSON.stringify(result),
      },
    });
  }
}

@Module({ imports: [AuthModule], controllers: [AnalyticsController] })
export class AnalyticsModule {}
