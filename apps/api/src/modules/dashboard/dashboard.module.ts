import { Controller, Get, UseGuards, Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard } from '../iam/guards';
import { CurrentUser, RequirePermission } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';
import { AuthModule } from '../iam/auth.module';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('dashboard', 'widget', 'list')
  async overview(@CurrentUser() user: RequestUser) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const [
      missionsToday,
      uncovered,
      quotesOpen,
      vehiclesImmobilized,
      leavesPending,
      incidentsOpen,
      ticketReturnsPending,
      alerts,
    ] = await Promise.all([
      this.prisma.mission.count({
        where: {
          companyId: user.companyId,
          startsAt: { lt: end },
          endsAt: { gt: start },
        },
      }),
      this.prisma.mission.count({
        where: {
          companyId: user.companyId,
          status: { in: ['to_plan', 'confirmed'] },
          assignments: { none: {} },
        },
      }),
      this.prisma.quote.count({
        where: { companyId: user.companyId, status: { in: ['draft', 'sent'] } },
      }),
      this.prisma.vehicle.count({
        where: { companyId: user.companyId, status: 'immobilized' },
      }),
      this.prisma.leaveRequest.count({
        where: { companyId: user.companyId, status: 'submitted' },
      }),
      this.prisma.qualityEvent.count({
        where: { companyId: user.companyId, status: 'open' },
      }),
      this.prisma.mission.count({
        where: {
          companyId: user.companyId,
          status: { in: ['published', 'in_progress', 'done'] },
          ticketReturnedAt: null,
          endsAt: { lt: new Date() },
        },
      }),
      this.prisma.opsAlert.findMany({
        where: { companyId: user.companyId, resolved: false },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      widgets: {
        missionsToday,
        uncovered,
        quotesOpen,
        vehiclesImmobilized,
        leavesPending,
        incidentsOpen,
        ticketReturnsPending,
      },
      alerts,
      dayOpen: {
        uncovered,
        vehiclesImmobilized,
        leavesPending,
        incidentsOpen,
      },
    };
  }
}

@Module({ imports: [AuthModule], controllers: [DashboardController] })
export class DashboardModule {}
