import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
  Module,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { existsSync, readFileSync } from 'fs';
import { IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard } from '../iam/guards';
import { CurrentUser, RequirePermission } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';
import { AuthModule } from '../iam/auth.module';

function dayBounds(ymd?: string) {
  const d = ymd ? new Date(`${ymd}T12:00:00`) : new Date();
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Date invalide');
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start, end, date: start.toISOString().slice(0, 10) };
}

function leaveCode(type: string) {
  const map: Record<string, string> = {
    conges: 'CP',
    rtt: 'RTT',
    recuperation: 'REC',
    maladie: 'MAL',
    sans_solde: 'SS',
  };
  return map[type] || type.slice(0, 3).toUpperCase();
}

function restCode(kind: string) {
  if (kind === 'weekly_rest' || kind === 'rh') return 'RH';
  if (kind === 'daily_rest' || kind === 'r') return 'R';
  return 'R';
}

@Controller('portal')
@UseGuards(JwtAuthGuard)
class PortalController {
  constructor(private readonly prisma: PrismaService) {}

  private async driverForUser(user: RequestUser) {
    const link = await this.prisma.employeeAccountLink.findUnique({
      where: { userId: user.userId },
      include: {
        employee: {
          include: { driver: true, depot: true },
        },
      },
    });
    if (!link?.employee.driver) return null;
    return {
      ...link.employee.driver,
      employee: link.employee,
      portalRole: link.portalRole,
    };
  }

  private async alertOps(params: {
    companyId: string;
    severity?: string;
    title: string;
    body?: string;
    href?: string;
  }) {
    return this.prisma.opsAlert.create({
      data: {
        companyId: params.companyId,
        severity: params.severity || 'info',
        title: params.title,
        body: params.body,
        href: params.href,
      },
    });
  }

  @Get('me/today')
  async today(
    @CurrentUser() user: RequestUser,
    @Query('date') date?: string,
  ) {
    const driver = await this.driverForUser(user);
    if (!driver) throw new ForbiddenException('Profil conducteur requis');

    const { start, end, date: ymd } = dayBounds(date);

    const assignments = await this.prisma.assignment.findMany({
      where: {
        driverId: driver.id,
        published: true,
        startsAt: { lt: end },
        endsAt: { gt: start },
      },
      include: {
        mission: {
          include: {
            order: { include: { customer: { select: { name: true } } } },
          },
        },
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

    const leave = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId: driver.employeeId,
        status: { in: ['approved', 'submitted'] },
        startsOn: { lte: end },
        endsOn: { gte: start },
      },
    });

    // Messages non lus = derniers messages d’un autre auteur après lastReadAt
    const driverThreads = await this.prisma.messageThread.findMany({
      where: {
        companyId: user.companyId,
        driverUserId: user.userId,
        threadType: 'driver',
      },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        participants: { where: { userId: user.userId } },
      },
    });
    const unread = driverThreads.filter((t) => {
      const last = t.messages[0];
      if (!last || last.authorId === user.userId) return false;
      const lastRead = t.participants[0]?.lastReadAt;
      return !lastRead || last.createdAt > lastRead;
    }).length;

    // Pending admin tasks (compliance reminders)
    const tasks: Array<{ id: string; label: string; days: number; kind: string }> =
      [];
    const now = Date.now();
    if (driver.fcoExpiresAt) {
      const days = Math.ceil(
        (driver.fcoExpiresAt.getTime() - now) / 86400000,
      );
      tasks.push({
        id: 'fco',
        label: 'Renouvellement FCO',
        days,
        kind: 'fco',
      });
    }
    if (driver.medicalExpiresAt) {
      const days = Math.ceil(
        (driver.medicalExpiresAt.getTime() - now) / 86400000,
      );
      tasks.push({
        id: 'medical',
        label: 'Visite médicale',
        days,
        kind: 'medical',
      });
    }
    if (driver.licenseExpiresAt) {
      const days = Math.ceil(
        (driver.licenseExpiresAt.getTime() - now) / 86400000,
      );
      tasks.push({
        id: 'license',
        label: 'Permis à renouveler',
        days,
        kind: 'license',
      });
    }

    return {
      date: ymd,
      driver: {
        id: driver.id,
        firstName: driver.employee.firstName,
        lastName: driver.employee.lastName,
        depot: driver.employee.depot?.name,
      },
      assignments,
      rests,
      leave,
      next: assignments[0] || null,
      unreadMessages: unread,
      tasks: tasks.sort((a, b) => a.days - b.days).slice(0, 6),
    };
  }

  @Get('me/planning')
  async planning(
    @CurrentUser() user: RequestUser,
    @Query('from') fromQ?: string,
    @Query('to') toQ?: string,
  ) {
    const driver = await this.driverForUser(user);
    if (!driver) throw new ForbiddenException('Profil conducteur requis');

    const from = fromQ
      ? new Date(`${fromQ}T00:00:00`)
      : (() => {
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          return d;
        })();
    const to = toQ
      ? new Date(`${toQ}T23:59:59`)
      : (() => {
          const d = new Date(from);
          d.setDate(d.getDate() + 42);
          return d;
        })();

    const [assignments, rests, leaves, unavail] = await Promise.all([
      this.prisma.assignment.findMany({
        where: {
          driverId: driver.id,
          published: true,
          startsAt: { lt: to },
          endsAt: { gt: from },
        },
        include: {
          mission: {
            include: {
              order: { include: { customer: { select: { name: true } } } },
            },
          },
          vehicle: true,
        },
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
          startsOn: { lte: to },
          endsOn: { gte: from },
        },
      }),
      this.prisma.driverUnavailability.findMany({
        where: {
          driverId: driver.id,
          startsAt: { lt: to },
          endsAt: { gt: from },
        },
      }),
    ]);

    // Day markers for calendar / week strip
    const days: Record<
      string,
      {
        date: string;
        assignmentCount: number;
        provisional: boolean;
        code: string | null;
        codes: string[];
      }
    > = {};
    const cursor = new Date(from);
    cursor.setHours(12, 0, 0, 0);
    const endCursor = new Date(to);
    while (cursor <= endCursor) {
      const key = cursor.toISOString().slice(0, 10);
      days[key] = {
        date: key,
        assignmentCount: 0,
        provisional: false,
        code: null,
        codes: [],
      };
      cursor.setDate(cursor.getDate() + 1);
    }

    for (const a of assignments) {
      const key = a.startsAt.toISOString().slice(0, 10);
      if (!days[key]) continue;
      days[key].assignmentCount += 1;
      if (a.status === 'draft' || a.version === 0) days[key].provisional = true;
    }
    for (const r of rests) {
      const start = new Date(r.startsAt);
      start.setHours(12, 0, 0, 0);
      const end = new Date(r.endsAt);
      end.setHours(12, 0, 0, 0);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        if (!days[key]) continue;
        const code = restCode(r.kind);
        if (!days[key].codes.includes(code)) days[key].codes.push(code);
        days[key].code = code;
      }
    }
    for (const l of leaves) {
      const start = new Date(l.startsOn);
      start.setHours(12, 0, 0, 0);
      const end = new Date(l.endsOn);
      end.setHours(12, 0, 0, 0);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        if (!days[key]) continue;
        const code = leaveCode(l.type);
        if (!days[key].codes.includes(code)) days[key].codes.push(code);
        days[key].code = code;
      }
    }

    return {
      from,
      to,
      assignments,
      rests,
      leaves,
      unavailabilities: unavail,
      days: Object.values(days),
    };
  }

  @Get('me/profile')
  async profile(@CurrentUser() user: RequestUser) {
    const driver = await this.driverForUser(user);
    if (!driver) throw new ForbiddenException('Profil conducteur requis');
    const emp = driver.employee;
    return {
      user: {
        email: user.email,
        displayName: user.displayName,
      },
      employee: {
        id: emp.id,
        matricule: emp.matricule,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        phone: emp.phone,
        jobTitle: emp.jobTitle,
        contractType: emp.contractType,
        hiredAt: emp.hiredAt,
        city: emp.city,
        addressLine1: emp.addressLine1,
        postalCode: emp.postalCode,
        depot: emp.depot,
        emergencyContact: emp.emergencyContact,
        emergencyPhone: emp.emergencyPhone,
      },
      driver: {
        id: driver.id,
        licenseNumber: driver.licenseNumber,
        licenseCategories: driver.licenseCategories,
        licenseExpiresAt: driver.licenseExpiresAt,
        fcoExpiresAt: driver.fcoExpiresAt,
        medicalExpiresAt: driver.medicalExpiresAt,
        cardExpiresAt: driver.cardExpiresAt,
        qualifications: driver.qualifications,
      },
    };
  }

  @Get('me/counters')
  async counters(@CurrentUser() user: RequestUser) {
    const driver = await this.driverForUser(user);
    if (!driver) throw new ForbiddenException('Profil conducteur requis');

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const weekAssignments = await this.prisma.assignment.findMany({
      where: {
        driverId: driver.id,
        published: true,
        startsAt: { gte: weekStart },
      },
    });
    const monthAssignments = await this.prisma.assignment.findMany({
      where: {
        driverId: driver.id,
        published: true,
        startsAt: { gte: monthStart },
      },
    });

    const hoursOf = (rows: typeof weekAssignments) =>
      rows.reduce(
        (s, a) =>
          s + Math.max(0, (a.endsAt.getTime() - a.startsAt.getTime()) / 3600000),
        0,
      );

    const year = now.getFullYear();
    const balances = await this.prisma.leaveBalance.findMany({
      where: {
        companyId: user.companyId,
        employeeId: driver.employeeId,
        year,
      },
    });

    const events = await this.prisma.driverServiceEvent.findMany({
      where: { driverId: driver.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      weekHours: Math.round(hoursOf(weekAssignments) * 10) / 10,
      monthHours: Math.round(hoursOf(monthAssignments) * 10) / 10,
      weekServices: weekAssignments.length,
      monthServices: monthAssignments.length,
      balances,
      recentEvents: events,
    };
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
    const event = await this.prisma.driverServiceEvent.create({
      data: {
        userId: user.userId,
        driverId: driver.id,
        missionId: body.missionId,
        kind: body.kind,
        note: body.note,
      },
    });
    const labels: Record<string, string> = {
      service_start: 'Prise de service',
      service_end: 'Fin de service',
    };
    await this.alertOps({
      companyId: user.companyId,
      severity: 'info',
      title: `${labels[body.kind] || body.kind} — ${driver.employee.lastName} ${driver.employee.firstName}`,
      body: body.note || undefined,
      href: body.missionId
        ? `/app/missions/${body.missionId}`
        : `/app/drivers/${driver.id}`,
    });
    return event;
  }

  @Get('me/leaves')
  async myLeaves(@CurrentUser() user: RequestUser) {
    const driver = await this.driverForUser(user);
    if (!driver) throw new ForbiddenException('Profil conducteur requis');
    const year = new Date().getFullYear();
    const [requests, balances] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where: { companyId: user.companyId, employeeId: driver.employeeId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.leaveBalance.findMany({
        where: {
          companyId: user.companyId,
          employeeId: driver.employeeId,
          year,
        },
      }),
    ]);
    return { requests, balances, year };
  }

  @Post('me/leave')
  async leave(
    @CurrentUser() user: RequestUser,
    @Body()
    body: { type?: string; startsOn: string; endsOn: string; comment?: string },
  ) {
    const driver = await this.driverForUser(user);
    if (!driver) throw new ForbiddenException('Profil conducteur requis');
    if (!body.startsOn || !body.endsOn) {
      throw new BadRequestException('Dates de congé requises');
    }
    const leave = await this.prisma.leaveRequest.create({
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
    await this.alertOps({
      companyId: user.companyId,
      severity: 'warning',
      title: `Demande d’absence — ${driver.employee.lastName} ${driver.employee.firstName}`,
      body: `${body.type || 'conges'} du ${body.startsOn} au ${body.endsOn}`,
      href: '/app/hr/leaves',
    });
    return leave;
  }

  @Get('me/messages')
  async myMessages(@CurrentUser() user: RequestUser) {
    const threads = await this.prisma.messageThread.findMany({
      where: {
        companyId: user.companyId,
        driverUserId: user.userId,
        threadType: 'driver',
      },
      include: {
        messages: {
          include: {
            author: { select: { id: true, displayName: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        participants: { where: { userId: user.userId } },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
    });
    return threads.map((t) => {
      const last = t.messages[t.messages.length - 1];
      const lastRead = t.participants[0]?.lastReadAt;
      const unread =
        !!last &&
        last.authorId !== user.userId &&
        (!lastRead || last.createdAt > lastRead);
      return { ...t, unread };
    });
  }

  @Post('me/messages')
  async sendMessage(
    @CurrentUser() user: RequestUser,
    @Body() body: { subject?: string; body: string; missionId?: string; threadId?: string },
  ) {
    const driver = await this.driverForUser(user);
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
        data: {
          updatedAt: new Date(),
          lastMessageAt: new Date(),
          status: 'new',
        },
      });
      await this.prisma.messageThreadParticipant.upsert({
        where: {
          threadId_userId: { threadId: thread.id, userId: user.userId },
        },
        create: {
          threadId: thread.id,
          userId: user.userId,
          lastReadAt: new Date(),
        },
        update: { lastReadAt: new Date() },
      });
      await this.alertOps({
        companyId: user.companyId,
        severity: 'warning',
        title: `Message conducteur — ${thread.subject}`,
        body: body.body.slice(0, 160),
        href: `/app/messaging?thread=${thread.id}`,
      });
      return msg;
    }
    const thread = await this.prisma.messageThread.create({
      data: {
        companyId: user.companyId,
        subject: body.subject || 'Message conducteur',
        threadType: 'driver',
        status: 'new',
        driverUserId: user.userId,
        missionId: body.missionId,
        lastMessageAt: new Date(),
        messages: {
          create: { authorId: user.userId, body: body.body },
        },
        participants: {
          create: { userId: user.userId, lastReadAt: new Date() },
        },
      },
      include: { messages: true },
    });
    await this.alertOps({
      companyId: user.companyId,
      severity: 'warning',
      title: `Nouveau message — ${driver ? `${driver.employee.lastName} ${driver.employee.firstName}` : user.displayName}`,
      body: body.body.slice(0, 160),
      href: `/app/messaging?thread=${thread.id}`,
    });
    return thread;
  }

  /** Marquer une conversation lue côté conducteur */
  @Post('me/messages/:threadId/read')
  async readMyThread(
    @CurrentUser() user: RequestUser,
    @Param('threadId') threadId: string,
  ) {
    const thread = await this.prisma.messageThread.findFirst({
      where: {
        id: threadId,
        companyId: user.companyId,
        driverUserId: user.userId,
      },
    });
    if (!thread) throw new ForbiddenException('Conversation interdite');
    await this.prisma.messageThreadParticipant.upsert({
      where: { threadId_userId: { threadId, userId: user.userId } },
      create: { threadId, userId: user.userId, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
    await this.prisma.message.updateMany({
      where: {
        threadId,
        authorId: { not: user.userId },
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { ok: true };
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
    const event = await this.prisma.qualityEvent.create({
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
    await this.alertOps({
      companyId: user.companyId,
      severity: body.severity === 'high' ? 'critical' : 'warning',
      title: `Incident portail — ${body.category}`,
      body: body.description.slice(0, 200),
      href: '/app/quality',
    });
    return event;
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
    const mission = await this.prisma.mission.update({
      where: { id: body.missionId },
      data: {
        ticketReturnedAt: new Date(),
        actualPassengers: body.actualPassengers,
        ticketNotes: body.ticketNotes,
        status: 'ops_return_review',
      },
    });
    await this.alertOps({
      companyId: user.companyId,
      severity: 'warning',
      title: `Retour billets — ${mission.number || body.missionId}`,
      body: body.ticketNotes || undefined,
      href: `/app/missions/${body.missionId}`,
    });
    return mission;
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

  @Get('me/documents/:id/download')
  async downloadDocument(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const driver = await this.driverForUser(user);
    if (!driver) throw new ForbiddenException('Profil conducteur requis');
    const doc = await this.prisma.generatedDocument.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!doc?.missionId || !existsSync(doc.storagePath)) {
      throw new NotFoundException('Document introuvable');
    }
    const assignment = await this.prisma.assignment.findFirst({
      where: {
        missionId: doc.missionId,
        driverId: driver.id,
        published: true,
      },
    });
    if (!assignment) {
      throw new ForbiddenException('Document non accessible');
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${doc.fileName}"`,
    );
    res.send(readFileSync(doc.storagePath));
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
      include: {
        driver: {
          include: {
            employee: {
              select: { firstName: true, lastName: true, matricule: true },
            },
          },
        },
        mission: { select: { id: true, number: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const threads = await this.prisma.messageThread.findMany({
      where: { companyId: user.companyId, threadType: 'driver' },
      include: {
        driverUser: {
          select: {
            id: true,
            displayName: true,
            email: true,
            employeeLink: {
              include: {
                employee: {
                  select: {
                    firstName: true,
                    lastName: true,
                    driver: { select: { id: true } },
                  },
                },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            author: { select: { displayName: true } },
          },
        },
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 50,
    });
    const leaves = await this.prisma.leaveRequest.findMany({
      where: { companyId: user.companyId, status: 'submitted' },
      include: {
        employee: {
          include: { driver: { select: { id: true } } },
        },
      },
    });
    const incidents = await this.prisma.qualityEvent.findMany({
      where: { companyId: user.companyId, status: 'open', source: 'driver' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const serviceEvents = await this.prisma.driverServiceEvent.findMany({
      where: { driver: { companyId: user.companyId } },
      include: {
        driver: {
          include: {
            employee: {
              select: { firstName: true, lastName: true, matricule: true },
            },
          },
        },
        mission: { select: { id: true, number: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    const alerts = await this.prisma.opsAlert.findMany({
      where: { companyId: user.companyId, resolved: false },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const ticketReturns = await this.prisma.mission.findMany({
      where: {
        companyId: user.companyId,
        status: 'ops_return_review',
      },
      select: {
        id: true,
        number: true,
        title: true,
        ticketReturnedAt: true,
        actualPassengers: true,
      },
      orderBy: { ticketReturnedAt: 'desc' },
      take: 20,
    });
    return {
      drivers,
      receipts,
      threads,
      leaves,
      incidents,
      serviceEvents,
      alerts,
      ticketReturns,
      counts: {
        messagesNew: threads.filter((t) => t.status === 'new').length,
        leavesPending: leaves.length,
        incidentsOpen: incidents.length,
        alertsOpen: alerts.length,
        ticketReturns: ticketReturns.length,
      },
    };
  }

  @Get('ops/inbox')
  @UseGuards(PermissionsGuard)
  @RequirePermission('portal', 'publication', 'publish')
  async opsInbox(@CurrentUser() user: RequestUser) {
    const overview = await this.opsOverview(user);
    type FeedItem = {
      id: string;
      kind: string;
      title: string;
      body?: string;
      at: string;
      href?: string;
      severity?: string;
    };
    const feed: FeedItem[] = [];
    for (const a of overview.alerts) {
      feed.push({
        id: `alert-${a.id}`,
        kind: 'alert',
        title: a.title,
        body: a.body || undefined,
        at: a.createdAt.toISOString(),
        href: a.href || undefined,
        severity: a.severity,
      });
    }
    for (const t of overview.threads.filter((x) => x.status === 'new')) {
      const name =
        t.driverUser?.employeeLink?.employee
          ? `${t.driverUser.employeeLink.employee.lastName} ${t.driverUser.employeeLink.employee.firstName}`
          : t.driverUser?.displayName || 'Conducteur';
      feed.push({
        id: `msg-${t.id}`,
        kind: 'message',
        title: `Message — ${name}`,
        body: t.subject,
        at: (t.lastMessageAt || t.updatedAt).toISOString(),
        href: `/app/messaging?thread=${t.id}`,
        severity: 'warning',
      });
    }
    for (const e of overview.serviceEvents.slice(0, 15)) {
      feed.push({
        id: `sev-${e.id}`,
        kind: 'service_event',
        title: `${e.kind} — ${e.driver.employee.lastName} ${e.driver.employee.firstName}`,
        body: e.mission?.number || e.note || undefined,
        at: e.createdAt.toISOString(),
        href: e.missionId
          ? `/app/missions/${e.missionId}`
          : `/app/drivers/${e.driverId}`,
      });
    }
    feed.sort((a, b) => b.at.localeCompare(a.at));
    return { feed: feed.slice(0, 60), counts: overview.counts };
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
      data: {
        status: 'open',
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await this.prisma.messageThreadParticipant.upsert({
      where: { threadId_userId: { threadId, userId: user.userId } },
      create: { threadId, userId: user.userId, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
    return msg;
  }
}

@Module({ imports: [AuthModule], controllers: [PortalController] })
export class PortalModule {}
