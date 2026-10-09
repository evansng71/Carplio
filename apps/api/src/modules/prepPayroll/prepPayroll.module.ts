import {
  BadRequestException,
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

@Controller('prep-payroll')
@UseGuards(JwtAuthGuard, PermissionsGuard)
class PrepPayrollController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('rules')
  @RequirePermission('hr', 'prepPayroll', 'list')
  rules(@CurrentUser() user: RequestUser) {
    return this.prisma.prePayrollRule.findMany({
      where: { companyId: user.companyId },
      orderBy: { priority: 'asc' },
    });
  }

  @Post('rules')
  @RequirePermission('hr', 'prepPayroll', 'manage')
  createRule(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      code: string;
      label: string;
      period?: string;
      formula: string;
      priority?: number;
    },
  ) {
    return this.prisma.prePayrollRule.create({
      data: {
        companyId: user.companyId,
        code: body.code,
        label: body.label,
        period: body.period || 'daily',
        formula: body.formula,
        priority: body.priority ?? 100,
      },
    });
  }

  /** Calcul jour → semaine → mois depuis planning + habillage */
  @Post('compute')
  @RequirePermission('hr', 'prepPayroll', 'manage')
  async compute(
    @CurrentUser() user: RequestUser,
    @Body() body: { from: string; to: string; employeeId?: string },
  ) {
    const from = new Date(body.from);
    const to = new Date(body.to);
    const employees = await this.prisma.employee.findMany({
      where: {
        companyId: user.companyId,
        ...(body.employeeId ? { id: body.employeeId } : {}),
        driver: { isNot: null },
      },
      include: { driver: true },
    });
    const rules = await this.prisma.prePayrollRule.findMany({
      where: { companyId: user.companyId, active: true },
    });
    if (!rules.length) {
      throw new BadRequestException('Aucune règle de prépaye active');
    }

    await this.prisma.prePayrollDailyLine.deleteMany({
      where: {
        companyId: user.companyId,
        workDate: { gte: from, lt: to },
        ...(body.employeeId ? { employeeId: body.employeeId } : {}),
      },
    });

    let dailyCount = 0;
    for (const emp of employees) {
      if (!emp.driver) continue;
      const assignments = await this.prisma.assignment.findMany({
        where: {
          companyId: user.companyId,
          driverId: emp.driver.id,
          startsAt: { gte: from, lt: to },
        },
        include: { mission: true },
      });
      const byDay = new Map<string, typeof assignments>();
      for (const a of assignments) {
        const key = a.startsAt.toISOString().slice(0, 10);
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key)!.push(a);
      }
      for (const [day, list] of byDay) {
        const workDate = new Date(day);
        let hours = 0;
        for (const a of list) {
          hours += (a.endsAt.getTime() - a.startsAt.getTime()) / 3600000;
        }
        // Enrich with dressing if any
        const run = await this.prisma.serviceDressingRun.findFirst({
          where: {
            companyId: user.companyId,
            driverId: emp.driver.id,
            workDate: {
              gte: workDate,
              lt: new Date(workDate.getTime() + 86400000),
            },
          },
        });
        if (run) hours = run.totalMin / 60;

        for (const rule of rules.filter((r) => r.period === 'daily')) {
          let qty = hours;
          let amount = hours * 15;
          if (rule.formula.includes('overtime') && hours > 8) {
            qty = hours - 8;
            amount = qty * 18;
          } else if (rule.formula.includes('night')) {
            qty = 0;
            amount = 0;
          } else if (rule.formula.includes('presence')) {
            qty = hours;
            amount = hours * 14.5;
          }
          await this.prisma.prePayrollDailyLine.create({
            data: {
              companyId: user.companyId,
              employeeId: emp.id,
              workDate,
              ruleCode: rule.code,
              label: rule.label,
              quantity: Math.round(qty * 100) / 100,
              amount: Math.round(amount * 100) / 100,
              source: run ? 'dressing' : 'planning',
              detailJson: JSON.stringify({ hours, assignments: list.length }),
            },
          });
          dailyCount++;
        }
      }
    }

    // Weekly aggregation
    await this.prisma.prePayrollWeeklyLine.deleteMany({
      where: {
        companyId: user.companyId,
        weekStart: { gte: from, lt: to },
      },
    });
    const dailies = await this.prisma.prePayrollDailyLine.findMany({
      where: { companyId: user.companyId, workDate: { gte: from, lt: to } },
    });
    const weekMap = new Map<string, { qty: number; amount: number; emp: string; code: string; label: string }>();
    for (const d of dailies) {
      const ws = startOfWeek(d.workDate);
      const key = `${d.employeeId}|${ws.toISOString()}|${d.ruleCode}`;
      const cur = weekMap.get(key) || {
        qty: 0,
        amount: 0,
        emp: d.employeeId,
        code: d.ruleCode,
        label: d.label + ' (hebdo)',
      };
      cur.qty += d.quantity;
      cur.amount += d.amount;
      weekMap.set(key, cur);
    }
    for (const [key, v] of weekMap) {
      const weekStart = new Date(key.split('|')[1]);
      await this.prisma.prePayrollWeeklyLine.create({
        data: {
          companyId: user.companyId,
          employeeId: v.emp,
          weekStart,
          ruleCode: `W_${v.code}`,
          label: v.label,
          quantity: Math.round(v.qty * 100) / 100,
          amount: Math.round(v.amount * 100) / 100,
        },
      });
    }

    // Monthly
    const ym = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`;
    await this.prisma.prePayrollMonthlyLine.deleteMany({
      where: { companyId: user.companyId, yearMonth: ym },
    });
    const monthMap = new Map<string, { qty: number; amount: number; emp: string; code: string; label: string }>();
    for (const d of dailies) {
      const key = `${d.employeeId}|${d.ruleCode}`;
      const cur = monthMap.get(key) || {
        qty: 0,
        amount: 0,
        emp: d.employeeId,
        code: d.ruleCode,
        label: d.label + ' (mensuel)',
      };
      cur.qty += d.quantity;
      cur.amount += d.amount;
      monthMap.set(key, cur);
    }
    for (const v of monthMap.values()) {
      await this.prisma.prePayrollMonthlyLine.create({
        data: {
          companyId: user.companyId,
          employeeId: v.emp,
          yearMonth: ym,
          ruleCode: `M_${v.code}`,
          label: v.label,
          quantity: Math.round(v.qty * 100) / 100,
          amount: Math.round(v.amount * 100) / 100,
        },
      });
      await this.prisma.payrollCounter.upsert({
        where: {
          companyId_employeeId_code: {
            companyId: user.companyId,
            employeeId: v.emp,
            code: 'HEURES_MOIS',
          },
        },
        create: {
          companyId: user.companyId,
          employeeId: v.emp,
          code: 'HEURES_MOIS',
          label: 'Heures du mois',
          balance: v.qty,
        },
        update: { balance: v.qty },
      });
    }

    return {
      dailyLines: dailyCount,
      weeklyLines: weekMap.size,
      monthlyLines: monthMap.size,
      yearMonth: ym,
    };
  }

  @Get('daily')
  @RequirePermission('hr', 'prepPayroll', 'list')
  daily(
    @CurrentUser() user: RequestUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.prisma.prePayrollDailyLine.findMany({
      where: {
        companyId: user.companyId,
        ...(from && to
          ? { workDate: { gte: new Date(from), lt: new Date(to) } }
          : {}),
      },
      orderBy: [{ workDate: 'asc' }, { employeeId: 'asc' }],
    });
  }

  @Get('weekly')
  @RequirePermission('hr', 'prepPayroll', 'list')
  weekly(@CurrentUser() user: RequestUser) {
    return this.prisma.prePayrollWeeklyLine.findMany({
      where: { companyId: user.companyId },
      orderBy: { weekStart: 'desc' },
      take: 100,
    });
  }

  @Get('monthly')
  @RequirePermission('hr', 'prepPayroll', 'list')
  monthly(@CurrentUser() user: RequestUser, @Query('yearMonth') yearMonth?: string) {
    return this.prisma.prePayrollMonthlyLine.findMany({
      where: {
        companyId: user.companyId,
        ...(yearMonth ? { yearMonth } : {}),
      },
      orderBy: { yearMonth: 'desc' },
    });
  }

  @Get('counters')
  @RequirePermission('hr', 'prepPayroll', 'list')
  counters(@CurrentUser() user: RequestUser) {
    return this.prisma.payrollCounter.findMany({
      where: { companyId: user.companyId },
    });
  }

  @Post('daily/:id/check')
  @RequirePermission('hr', 'prepPayroll', 'manage')
  check(@Param('id') id: string) {
    return this.prisma.prePayrollDailyLine.update({
      where: { id },
      data: { checked: true },
    });
  }

  @Post('export')
  @RequirePermission('hr', 'prepPayroll', 'manage')
  async export(
    @CurrentUser() user: RequestUser,
    @Body() body: { yearMonth: string },
  ) {
    const existing = await this.prisma.payrollExportBatch.findFirst({
      where: {
        companyId: user.companyId,
        yearMonth: body.yearMonth,
        status: 'exported',
      },
    });
    if (existing) {
      throw new BadRequestException('Mois déjà exporté — double envoi interdit');
    }
    const lines = await this.prisma.prePayrollMonthlyLine.findMany({
      where: {
        companyId: user.companyId,
        yearMonth: body.yearMonth,
        exported: false,
      },
    });
    const batch = await this.prisma.payrollExportBatch.create({
      data: {
        companyId: user.companyId,
        yearMonth: body.yearMonth,
        status: 'exported',
        lineCount: lines.length,
        payloadJson: JSON.stringify(lines),
        exportedAt: new Date(),
      },
    });
    await this.prisma.prePayrollMonthlyLine.updateMany({
      where: {
        companyId: user.companyId,
        yearMonth: body.yearMonth,
      },
      data: { exported: true },
    });
    return batch;
  }

  @Get('exports')
  @RequirePermission('hr', 'prepPayroll', 'list')
  exports(@CurrentUser() user: RequestUser) {
    return this.prisma.payrollExportBatch.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay() || 7;
  x.setDate(x.getDate() - day + 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

@Module({ imports: [AuthModule], controllers: [PrepPayrollController] })
export class PrepPayrollModule {}
