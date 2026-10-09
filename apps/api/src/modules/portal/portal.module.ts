import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  Module,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard } from '../iam/guards';
import { CurrentUser, RequirePermission } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';
import { AuthModule } from '../iam/auth.module';

@Controller('portal')
@UseGuards(JwtAuthGuard)
class PortalController {
  constructor(private readonly prisma: PrismaService) {}

  private async driverForUser(user: RequestUser) {
    const link = await this.prisma.employeeAccountLink.findUnique({
      where: { userId: user.userId },
      include: { employee: { include: { driver: true } } },
    });
    return link?.employee.driver || null;
  }

  @Get('me/today')
  async today(@CurrentUser() user: RequestUser) {
    const driver = await this.driverForUser(user);
    if (!driver) throw new ForbiddenException('Profil conducteur requis');

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const assignments = await this.prisma.assignment.findMany({
      where: {
        driverId: driver.id,
        published: true,
        startsAt: { lt: end },
        endsAt: { gt: start },
      },
      include: {
        mission: true,
        vehicle: true,
      },
      orderBy: { startsAt: 'asc' },
    });

    const rests = await this.prisma.plannedRest.findMany({
      where: {
        driverId: driver.id,
        published: true,
        startsAt: { lt: end },
        endsAt: { gt: start },
      },
    });

    return { driver, assignments, rests, next: assignments[0] || null };
  }

  @Get('me/planning')
  async planning(@CurrentUser() user: RequestUser) {
    const driver = await this.driverForUser(user);
    if (!driver) throw new ForbiddenException('Profil conducteur requis');

    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 14);

    const [assignments, rests, leaves] = await Promise.all([
      this.prisma.assignment.findMany({
        where: {
          driverId: driver.id,
          published: true,
          startsAt: { lt: to },
          endsAt: { gt: from },
        },
        include: { mission: true, vehicle: true },
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.plannedRest.findMany({
        where: {
          driverId: driver.id,
          published: true,
          startsAt: { lt: to },
          endsAt: { gt: from },
        },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId: driver.employeeId,
          status: { in: ['approved', 'submitted'] },
        },
      }),
    ]);

    // Explicit: unpublished assignments are never returned
    return { from, to, assignments, rests, leaves };
  }

  @Post('me/ack')
  async ack(
    @CurrentUser() user: RequestUser,
    @Body() body: { missionId?: string; kind?: string },
  ) {
    const driver = await this.driverForUser(user);
    if (!driver) throw new ForbiddenException('Profil conducteur requis');
    return this.prisma.portalReadReceipt.create({
      data: {
        userId: user.userId,
        driverId: driver.id,
        missionId: body.missionId,
        kind: body.kind || 'planning_seen',
      },
    });
  }

  @Post('me/service-event')
  async serviceEvent(
    @CurrentUser() user: RequestUser,
    @Body() body: { kind: string; missionId?: string; note?: string },
  ) {
    const driver = await this.driverForUser(user);
    if (!driver) throw new ForbiddenException('Profil conducteur requis');
    return this.prisma.driverServiceEvent.create({
      data: {
        userId: user.userId,
        driverId: driver.id,
        missionId: body.missionId,
        kind: body.kind,
        note: body.note,
      },
    });
  }

  @Post('me/leave')
  async leave(
    @CurrentUser() user: RequestUser,
    @Body()
    body: { type?: string; startsOn: string; endsOn: string; comment?: string },
  ) {
    const driver = await this.driverForUser(user);
    if (!driver) throw new ForbiddenException('Profil conducteur requis');
    return this.prisma.leaveRequest.create({
      data: {
        companyId: user.companyId,
        employeeId: driver.employeeId,
        requesterId: user.userId,
        type: body.type || 'conges',
        startsOn: new Date(body.startsOn),
        endsOn: new Date(body.endsOn),
        comment: body.comment,
        status: 'submitted',
      },
    });
  }

  @Get('me/messages')
  async myMessages(@CurrentUser() user: RequestUser) {
    return this.prisma.messageThread.findMany({
      where: { companyId: user.companyId, driverUserId: user.userId },
      include: {
        messages: {
          include: { author: { select: { displayName: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Post('me/messages')
  async sendMessage(
    @CurrentUser() user: RequestUser,
    @Body() body: { subject?: string; body: string; missionId?: string; threadId?: string },
  ) {
    if (body.threadId) {
      const thread = await this.prisma.messageThread.findFirst({
        where: {
          id: body.threadId,
          companyId: user.companyId,
          driverUserId: user.userId,
        },
      });
      if (!thread) throw new ForbiddenException('Conversation interdite');
      const msg = await this.prisma.message.create({
        data: {
          threadId: thread.id,
          authorId: user.userId,
          body: body.body,
        },
      });
      await this.prisma.messageThread.update({
        where: { id: thread.id },
        data: { updatedAt: new Date(), status: 'new' },
      });
      return msg;
    }
    return this.prisma.messageThread.create({
      data: {
        companyId: user.companyId,
        subject: body.subject || 'Message conducteur',
        driverUserId: user.userId,
        missionId: body.missionId,
        messages: {
          create: { authorId: user.userId, body: body.body },
        },
      },
      include: { messages: true },
    });
  }

  @Post('me/incidents')
  async incident(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      category: string;
      description: string;
      missionId?: string;
      severity?: string;
    },
  ) {
    return this.prisma.qualityEvent.create({
      data: {
        companyId: user.companyId,
        reportedById: user.userId,
        source: 'driver',
        category: body.category,
        description: body.description,
        missionId: body.missionId,
        severity: body.severity || 'medium',
        nature: body.category,
      },
    });
  }

  @Post('me/ticket-return')
  async ticketReturn(
    @CurrentUser() user: RequestUser,
    @Body()
    body: { missionId: string; actualPassengers?: number; ticketNotes?: string },
  ) {
    const driver = await this.driverForUser(user);
    if (!driver) throw new ForbiddenException('Profil conducteur requis');
    const assignment = await this.prisma.assignment.findFirst({
      where: {
        missionId: body.missionId,
        driverId: driver.id,
        published: true,
      },
    });
    if (!assignment) {
      throw new ForbiddenException('Mission non publiée pour ce conducteur');
    }
    return this.prisma.mission.update({
      where: { id: body.missionId },
      data: {
        ticketReturnedAt: new Date(),
        actualPassengers: body.actualPassengers,
        ticketNotes: body.ticketNotes,
        status: 'ops_return_review',
      },
    });
  }

  @Get('me/documents')
  async documents(@CurrentUser() user: RequestUser) {
    const driver = await this.driverForUser(user);
    if (!driver) throw new ForbiddenException('Profil conducteur requis');
    const publishedMissionIds = (
      await this.prisma.assignment.findMany({
        where: { driverId: driver.id, published: true },
        select: { missionId: true },
      })
    ).map((a) => a.missionId);

    return this.prisma.generatedDocument.findMany({
      where: {
        companyId: user.companyId,
        missionId: { in: publishedMissionIds },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  /** Centre exploitant */
  @Get('ops/overview')
  @UseGuards(PermissionsGuard)
  @RequirePermission('portal', 'publication', 'publish')
  async opsOverview(@CurrentUser() user: RequestUser) {
    const drivers = await this.prisma.driver.findMany({
      where: { companyId: user.companyId },
      include: {
        employee: {
          include: { accountLink: { include: { user: true } } },
        },
      },
    });
    const receipts = await this.prisma.portalReadReceipt.findMany({
      where: { user: { companyId: user.companyId } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const threads = await this.prisma.messageThread.findMany({
      where: { companyId: user.companyId },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
    });
    const leaves = await this.prisma.leaveRequest.findMany({
      where: { companyId: user.companyId, status: 'submitted' },
      include: { employee: true },
    });
    const incidents = await this.prisma.qualityEvent.findMany({
      where: { companyId: user.companyId, status: 'open' },
      orderBy: { createdAt: 'desc' },
    });
    return { drivers, receipts, threads, leaves, incidents };
  }

  @Get('ops/as-driver/:driverId')
  @UseGuards(PermissionsGuard)
  @RequirePermission('portal', 'publication', 'publish')
  async asDriver(
    @CurrentUser() user: RequestUser,
    @Param('driverId') driverId: string,
  ) {
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, companyId: user.companyId },
      include: { employee: { include: { accountLink: true } } },
    });
    if (!driver?.employee.accountLink) {
      throw new BadRequestException('Conducteur sans compte');
    }
    await this.prisma.accessAuditEvent.create({
      data: {
        companyId: user.companyId,
        actorId: user.userId,
        action: 'view_as_driver',
        targetType: 'Driver',
        targetId: driverId,
      },
    });
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 14);
    const assignments = await this.prisma.assignment.findMany({
      where: {
        driverId: driver.id,
        published: true,
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
      include: { mission: true, vehicle: true },
    });
    const rests = await this.prisma.plannedRest.findMany({
      where: { driverId: driver.id, published: true },
    });
    return {
      mode: 'read_only_preview',
      driver,
      assignments,
      rests,
      note: 'Prévisualisation stricte du planning publié — pas d’accès RH sensible',
    };
  }

  @Post('ops/messages/:threadId/reply')
  @UseGuards(PermissionsGuard)
  @RequirePermission('messaging', 'thread', 'create')
  async reply(
    @CurrentUser() user: RequestUser,
    @Param('threadId') threadId: string,
    @Body() body: { body: string },
  ) {
    const thread = await this.prisma.messageThread.findFirst({
      where: { id: threadId, companyId: user.companyId },
    });
    if (!thread) throw new BadRequestException('Thread introuvable');
    const msg = await this.prisma.message.create({
      data: {
        threadId,
        authorId: user.userId,
        body: body.body,
      },
    });
    await this.prisma.messageThread.update({
      where: { id: threadId },
      data: { status: 'handled', updatedAt: new Date() },
    });
    return msg;
  }
}

@Module({ imports: [AuthModule], controllers: [PortalController] })
export class PortalModule {}
