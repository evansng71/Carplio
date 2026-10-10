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
      messagesUnanswered,
      messagesOpen,
      serviceEventsToday,
      driversActive,
      alerts,
      recentThreads,
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
          status: { in: ['published', 'in_progress', 'done', 'ops_return_review'] },
          OR: [
            { ticketReturnedAt: null, endsAt: { lt: new Date() } },
            { status: 'ops_return_review' },
          ],
        },
      }),
      this.prisma.messageThread.count({
        where: {
          companyId: user.companyId,
          status: 'new',
          threadType: 'driver',
        },
      }),
      this.prisma.messageThread.count({
        where: {
          companyId: user.companyId,
          status: { in: ['new', 'open'] },
        },
      }),
      this.prisma.driverServiceEvent.count({
        where: {
          driver: { companyId: user.companyId },
          createdAt: { gte: start, lte: end },
        },
      }),
      this.prisma.driver.count({
        where: { companyId: user.companyId, status: 'active' },
      }),
      this.prisma.opsAlert.findMany({
        where: { companyId: user.companyId, resolved: false },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      this.prisma.messageThread.findMany({
        where: {
          companyId: user.companyId,
          OR: [
            { status: 'new' },
            { lastMessageAt: { not: null } },
          ],
        },
        include: {
          driverUser: {
            select: {
              id: true,
              displayName: true,
              employeeLink: {
                include: {
                  employee: {
                    select: { firstName: true, lastName: true },
                  },
                },
              },
            },
          },
          participants: {
            include: {
              user: { select: { id: true, displayName: true } },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              author: { select: { id: true, displayName: true } },
            },
          },
        },
        orderBy: [
          { status: 'asc' },
          { lastMessageAt: 'desc' },
          { updatedAt: 'desc' },
        ],
        take: 8,
      }),
    ]);

    const messages = recentThreads.map((t) => {
      const last = t.messages[0] || null;
      const emp = t.driverUser?.employeeLink?.employee;
      const counterpart =
        t.threadType === 'driver'
          ? emp
            ? `${emp.lastName} ${emp.firstName}`
            : t.driverUser?.displayName || 'Conducteur'
          : t.participants
              .map((p) => p.user.displayName)
              .filter((n) => n)
              .slice(0, 3)
              .join(', ') || 'Équipe';
      return {
        id: t.id,
        subject: t.subject,
        status: t.status,
        threadType: t.threadType,
        counterpart,
        preview: last?.body || '',
        authorName: last?.author?.displayName || null,
        at: (t.lastMessageAt || t.updatedAt).toISOString(),
        unanswered: t.status === 'new',
      };
    });

    return {
      widgets: {
        missionsToday,
        uncovered,
        quotesOpen,
        vehiclesImmobilized,
        leavesPending,
        incidentsOpen,
        ticketReturnsPending,
        messagesUnanswered,
        messagesOpen,
        serviceEventsToday,
        driversActive,
      },
      messages,
      alerts,
      dayOpen: {
        uncovered,
        vehiclesImmobilized,
        leavesPending,
        incidentsOpen,
        messagesUnanswered,
      },
    };
  }
}

@Module({ imports: [AuthModule], controllers: [DashboardController] })
export class DashboardModule {}
