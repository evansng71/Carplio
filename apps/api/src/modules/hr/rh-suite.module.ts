import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Module,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard } from '../iam/guards';
import { CurrentUser, RequirePermission } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';
import { AuthModule } from '../iam/auth.module';

function monthBounds(yearMonth: string) {
  const [y, m] = yearMonth.split('-').map(Number);
  if (!y || !m) throw new BadRequestException('yearMonth invalide (YYYY-MM)');
  const from = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const to = new Date(y, m, 1, 0, 0, 0, 0);
  return { from, to, y, m };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

@Controller('hr')
@UseGuards(JwtAuthGuard, PermissionsGuard)
class RhSuiteController {
  constructor(private readonly prisma: PrismaService) {}

  /** Cockpit RH — KPIs transporteur */
  @Get('cockpit')
  @RequirePermission('hr', 'employee', 'list')
  async cockpit(@CurrentUser() user: RequestUser) {
    const companyId = user.companyId;
    const now = new Date();
    const in60 = new Date(now);
    in60.setDate(in60.getDate() + 60);
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [
      employeesActive,
      driversActive,
      leavesPending,
      interviewsPlanned,
      trainingsOpen,
      payslipsDraft,
      payslipsMonth,
      fcoSoon,
      medicalSoon,
      licenseSoon,
    ] = await Promise.all([
      this.prisma.employee.count({
        where: { companyId, status: 'active' },
      }),
      this.prisma.driver.count({
        where: { companyId, status: 'active' },
      }),
      this.prisma.leaveRequest.count({
        where: { companyId, status: 'submitted' },
      }),
      this.prisma.hrInterview.count({
        where: { companyId, status: 'planned' },
      }),
      this.prisma.trainingSession.count({
        where: {
          companyId,
          status: { in: ['planned', 'open'] },
          startsAt: { gte: now },
        },
      }),
      this.prisma.payslip.count({
        where: { companyId, status: 'draft' },
      }),
      this.prisma.payslip.findMany({
        where: { companyId, yearMonth },
        select: { grossAmount: true, netAmount: true, status: true },
      }),
      this.prisma.driver.count({
        where: {
          companyId,
          fcoExpiresAt: { not: null, lte: in60 },
        },
      }),
      this.prisma.driver.count({
        where: {
          companyId,
          medicalExpiresAt: { not: null, lte: in60 },
        },
      }),
      this.prisma.driver.count({
        where: {
          companyId,
          licenseExpiresAt: { not: null, lte: in60 },
        },
      }),
    ]);

    const payrollGross = payslipsMonth.reduce((s, p) => s + p.grossAmount, 0);
    const payrollNet = payslipsMonth.reduce((s, p) => s + p.netAmount, 0);

    const upcomingInterviews = await this.prisma.hrInterview.findMany({
      where: {
        companyId,
        status: 'planned',
        scheduledAt: { gte: now },
      },
      include: {
        employee: { select: { firstName: true, lastName: true, matricule: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 8,
    });

    const upcomingSessions = await this.prisma.trainingSession.findMany({
      where: {
        companyId,
        startsAt: { gte: now },
        status: { in: ['planned', 'open'] },
      },
      include: {
        course: true,
        _count: { select: { enrollments: true } },
      },
      orderBy: { startsAt: 'asc' },
      take: 8,
    });

    return {
      yearMonth,
      kpis: {
        employeesActive,
        driversActive,
        leavesPending,
        interviewsPlanned,
        trainingsOpen,
        payslipsDraft,
        payrollGross: round2(payrollGross),
        payrollNet: round2(payrollNet),
        complianceAlerts: fcoSoon + medicalSoon + licenseSoon,
        fcoSoon,
        medicalSoon,
        licenseSoon,
      },
      upcomingInterviews,
      upcomingSessions,
    };
  }

  // ─── Congés / soldes ───────────────────────────────────────────

  @Get('leaves')
  @RequirePermission('hr', 'leave', 'list')
  leaves(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('employeeId') employeeId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.prisma.leaveRequest.findMany({
      where: {
        companyId: user.companyId,
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
        ...(employeeId ? { employeeId } : {}),
        ...(from || to
          ? {
              AND: [
                ...(from ? [{ endsOn: { gte: new Date(from) } }] : []),
                ...(to ? [{ startsOn: { lte: new Date(to) } }] : []),
              ],
            }
          : {}),
      },
      include: {
        employee: {
          include: { driver: true, depot: true },
        },
      },
      orderBy: [{ startsOn: 'desc' }, { createdAt: 'desc' }],
      take: 300,
    });
  }

  @Post('leaves/:id/decide')
  @RequirePermission('hr', 'leave', 'approve')
  async decideLeave(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { status: 'approved' | 'rejected'; decisionNote?: string },
  ) {
    const leave = await this.prisma.leaveRequest.findFirst({
      where: { id, companyId: user.companyId },
      include: { employee: { include: { driver: true } } },
    });
    if (!leave) throw new BadRequestException('Demande introuvable');
    if (leave.status !== 'submitted') {
      throw new BadRequestException('Cette demande a déjà été traitée');
    }
    if (!['approved', 'rejected'].includes(body.status)) {
      throw new BadRequestException('Statut invalide');
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: body.status,
        decisionNote: body.decisionNote,
        decidedAt: new Date(),
      },
      include: { employee: { include: { driver: true } } },
    });

    if (body.status === 'approved') {
      if (updated.employee.driver && updated.startsOn && updated.endsOn) {
        const ends = new Date(updated.endsOn);
        ends.setHours(23, 59, 59, 999);
        await this.prisma.driverUnavailability.create({
          data: {
            companyId: user.companyId,
            driverId: updated.employee.driver.id,
            kind: updated.type === 'maladie' ? 'maladie' : 'conges',
            reason: `Congé RH #${updated.id.slice(-6)} — ${updated.type}`,
            startsAt: updated.startsOn,
            endsAt: ends,
          },
        });
      }
      if (['conges', 'rtt', 'recuperation'].includes(updated.type)) {
        const days =
          Math.max(
            0,
            (updated.endsOn.getTime() - updated.startsOn.getTime()) / 86400000,
          ) + 1;
        const year = updated.startsOn.getFullYear();
        const bal = await this.prisma.leaveBalance.findUnique({
          where: {
            companyId_employeeId_year_type: {
              companyId: user.companyId,
              employeeId: updated.employeeId,
              year,
              type: updated.type,
            },
          },
        });
        if (bal) {
          await this.prisma.leaveBalance.update({
            where: { id: bal.id },
            data: {
              used: bal.used + days,
              remaining: Math.max(0, bal.remaining - days),
            },
          });
        }
      }
    }
    return updated;
  }

  @Get('leave-balances')
  @RequirePermission('hr', 'leave', 'list')
  leaveBalances(
    @CurrentUser() user: RequestUser,
    @Query('year') year?: string,
  ) {
    const y = year ? Number(year) : new Date().getFullYear();
    return this.prisma.leaveBalance.findMany({
      where: { companyId: user.companyId, year: y },
      include: {
        employee: {
          select: {
            id: true,
            matricule: true,
            firstName: true,
            lastName: true,
            driver: { select: { id: true } },
          },
        },
      },
      orderBy: { employee: { lastName: 'asc' } },
    });
  }

  @Post('leave-balances/ensure')
  @RequirePermission('hr', 'leave', 'approve')
  async ensureLeaveBalances(
    @CurrentUser() user: RequestUser,
    @Body() body: { year?: number },
  ) {
    const year = body.year || new Date().getFullYear();
    const employees = await this.prisma.employee.findMany({
      where: { companyId: user.companyId, status: 'active' },
    });
    let created = 0;
    for (const emp of employees) {
      for (const type of ['conges', 'rtt', 'recuperation'] as const) {
        const entitled = type === 'conges' ? 25 : type === 'rtt' ? 8 : 0;
        const existing = await this.prisma.leaveBalance.findUnique({
          where: {
            companyId_employeeId_year_type: {
              companyId: user.companyId,
              employeeId: emp.id,
              year,
              type,
            },
          },
        });
        if (!existing) {
          await this.prisma.leaveBalance.create({
            data: {
              companyId: user.companyId,
              employeeId: emp.id,
              year,
              type,
              entitled,
              used: 0,
              remaining: entitled,
            },
          });
          created++;
        }
      }
    }
    return { year, created };
  }

  /** Pose de congé / absence depuis le back-office RH */
  @Post('leaves')
  @RequirePermission('hr', 'leave', 'approve')
  async createLeave(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      employeeId: string;
      type?: string;
      startsOn: string;
      endsOn: string;
      comment?: string;
      /** Si true : crée déjà approuvé + indispo planning */
      autoApprove?: boolean;
    },
  ) {
    const emp = await this.prisma.employee.findFirst({
      where: { id: body.employeeId, companyId: user.companyId },
      include: { driver: true },
    });
    if (!emp) throw new BadRequestException('Salarié introuvable');
    const status = body.autoApprove ? 'approved' : 'submitted';
    const leave = await this.prisma.leaveRequest.create({
      data: {
        companyId: user.companyId,
        employeeId: emp.id,
        requesterId: user.userId,
        type: body.type || 'conges',
        startsOn: new Date(body.startsOn),
        endsOn: new Date(body.endsOn),
        comment: body.comment,
        status,
        decidedAt: body.autoApprove ? new Date() : null,
        decisionNote: body.autoApprove ? 'Saisie RH' : null,
      },
      include: { employee: { include: { driver: true } } },
    });
    if (status === 'approved' && emp.driver) {
      const ends = new Date(leave.endsOn);
      ends.setHours(23, 59, 59, 999);
      await this.prisma.driverUnavailability.create({
        data: {
          companyId: user.companyId,
          driverId: emp.driver.id,
          kind: leave.type === 'maladie' ? 'maladie' : 'conges',
          reason: `Congé RH #${leave.id.slice(-6)}`,
          startsAt: leave.startsOn,
          endsAt: ends,
        },
      });
    }
    // Décrémente solde si type conges/rtt
    if (status === 'approved' && ['conges', 'rtt'].includes(leave.type)) {
      const days =
        Math.max(
          0,
          (leave.endsOn.getTime() - leave.startsOn.getTime()) / 86400000,
        ) + 1;
      const year = leave.startsOn.getFullYear();
      const bal = await this.prisma.leaveBalance.findUnique({
        where: {
          companyId_employeeId_year_type: {
            companyId: user.companyId,
            employeeId: emp.id,
            year,
            type: leave.type,
          },
        },
      });
      if (bal) {
        await this.prisma.leaveBalance.update({
          where: { id: bal.id },
          data: {
            used: bal.used + days,
            remaining: Math.max(0, bal.remaining - days),
          },
        });
      }
    }
    return leave;
  }

  // ─── Primes & indemnités ───────────────────────────────────────

  @Get('bonuses')
  @RequirePermission('hr', 'payroll', 'list')
  bonuses(
    @CurrentUser() user: RequestUser,
    @Query('employeeId') employeeId?: string,
    @Query('yearMonth') yearMonth?: string,
  ) {
    return this.prisma.payrollBonus.findMany({
      where: {
        companyId: user.companyId,
        ...(employeeId ? { employeeId } : {}),
        ...(yearMonth
          ? {
              OR: [
                { kind: 'recurring', active: true },
                { yearMonth, active: true },
              ],
            }
          : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            matricule: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('bonuses')
  @RequirePermission('hr', 'payroll', 'manage')
  createBonus(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      employeeId: string;
      code: string;
      label: string;
      amount: number;
      kind?: string;
      yearMonth?: string;
      notes?: string;
    },
  ) {
    return this.prisma.payrollBonus.create({
      data: {
        companyId: user.companyId,
        employeeId: body.employeeId,
        code: body.code,
        label: body.label,
        amount: body.amount,
        kind: body.kind || 'one_shot',
        yearMonth: body.yearMonth,
        notes: body.notes,
        active: true,
      },
      include: { employee: true },
    });
  }

  @Patch('bonuses/:id')
  @RequirePermission('hr', 'payroll', 'manage')
  async patchBonus(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body()
    body: {
      amount?: number;
      label?: string;
      active?: boolean;
      notes?: string;
      yearMonth?: string | null;
    },
  ) {
    const row = await this.prisma.payrollBonus.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!row) throw new BadRequestException('Prime introuvable');
    return this.prisma.payrollBonus.update({
      where: { id },
      data: {
        amount: body.amount ?? row.amount,
        label: body.label ?? row.label,
        active: body.active ?? row.active,
        notes: body.notes ?? row.notes,
        yearMonth:
          body.yearMonth === undefined ? row.yearMonth : body.yearMonth,
      },
    });
  }

  // ─── Entretiens ────────────────────────────────────────────────

  @Get('interviews')
  @RequirePermission('hr', 'interview', 'list')
  interviews(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.prisma.hrInterview.findMany({
      where: {
        companyId: user.companyId,
        ...(status ? { status } : {}),
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            matricule: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            driver: { select: { id: true } },
          },
        },
      },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
    });
  }

  @Post('interviews')
  @RequirePermission('hr', 'interview', 'manage')
  createInterview(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      employeeId: string;
      kind?: string;
      title: string;
      scheduledAt?: string;
      objectives?: string;
      notes?: string;
    },
  ) {
    return this.prisma.hrInterview.create({
      data: {
        companyId: user.companyId,
        employeeId: body.employeeId,
        kind: body.kind || 'annuel',
        title: body.title,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        objectives: body.objectives,
        notes: body.notes,
        interviewerUserId: user.userId,
        status: 'planned',
      },
      include: { employee: true },
    });
  }

  @Patch('interviews/:id')
  @RequirePermission('hr', 'interview', 'manage')
  async patchInterview(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      kind?: string;
      scheduledAt?: string | null;
      heldAt?: string | null;
      status?: string;
      objectives?: string;
      notes?: string;
      nextActions?: string;
      rating?: number | null;
    },
  ) {
    const row = await this.prisma.hrInterview.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!row) throw new BadRequestException('Entretien introuvable');
    return this.prisma.hrInterview.update({
      where: { id },
      data: {
        title: body.title ?? row.title,
        kind: body.kind ?? row.kind,
        scheduledAt:
          body.scheduledAt === undefined
            ? row.scheduledAt
            : body.scheduledAt
              ? new Date(body.scheduledAt)
              : null,
        heldAt:
          body.heldAt === undefined
            ? row.heldAt
            : body.heldAt
              ? new Date(body.heldAt)
              : null,
        status: body.status ?? row.status,
        objectives: body.objectives ?? row.objectives,
        notes: body.notes ?? row.notes,
        nextActions: body.nextActions ?? row.nextActions,
        rating: body.rating === undefined ? row.rating : body.rating,
      },
      include: { employee: true },
    });
  }

  // ─── Formations ────────────────────────────────────────────────

  @Get('trainings/courses')
  @RequirePermission('hr', 'training', 'list')
  courses(@CurrentUser() user: RequestUser) {
    return this.prisma.trainingCourse.findMany({
      where: { companyId: user.companyId },
      include: { _count: { select: { sessions: true } } },
      orderBy: { title: 'asc' },
    });
  }

  @Post('trainings/courses')
  @RequirePermission('hr', 'training', 'manage')
  createCourse(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      code: string;
      title: string;
      category?: string;
      durationHours?: number;
      description?: string;
      mandatory?: boolean;
      validityMonths?: number;
    },
  ) {
    return this.prisma.trainingCourse.create({
      data: {
        companyId: user.companyId,
        code: body.code,
        title: body.title,
        category: body.category || 'metier',
        durationHours: body.durationHours ?? 7,
        description: body.description,
        mandatory: !!body.mandatory,
        validityMonths: body.validityMonths,
      },
    });
  }

  @Get('trainings/sessions')
  @RequirePermission('hr', 'training', 'list')
  sessions(@CurrentUser() user: RequestUser) {
    return this.prisma.trainingSession.findMany({
      where: { companyId: user.companyId },
      include: {
        course: true,
        enrollments: {
          include: {
            employee: {
              select: {
                id: true,
                matricule: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { startsAt: 'desc' },
    });
  }

  @Post('trainings/sessions')
  @RequirePermission('hr', 'training', 'manage')
  createSession(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      courseId: string;
      startsAt: string;
      endsAt: string;
      location?: string;
      provider?: string;
      capacity?: number;
      costPerSeat?: number;
      notes?: string;
    },
  ) {
    return this.prisma.trainingSession.create({
      data: {
        companyId: user.companyId,
        courseId: body.courseId,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        location: body.location,
        provider: body.provider,
        capacity: body.capacity ?? 12,
        costPerSeat: body.costPerSeat,
        notes: body.notes,
        status: 'open',
      },
      include: { course: true },
    });
  }

  @Post('trainings/sessions/:id/enroll')
  @RequirePermission('hr', 'training', 'manage')
  async enroll(
    @CurrentUser() user: RequestUser,
    @Param('id') sessionId: string,
    @Body() body: { employeeId: string },
  ) {
    const session = await this.prisma.trainingSession.findFirst({
      where: { id: sessionId, companyId: user.companyId },
      include: { _count: { select: { enrollments: true } } },
    });
    if (!session) throw new BadRequestException('Session introuvable');
    if (session._count.enrollments >= session.capacity) {
      throw new BadRequestException('Session complète');
    }
    return this.prisma.trainingEnrollment.create({
      data: {
        companyId: user.companyId,
        sessionId,
        employeeId: body.employeeId,
        status: 'inscrit',
      },
      include: { employee: true, session: { include: { course: true } } },
    });
  }

  @Patch('trainings/enrollments/:id')
  @RequirePermission('hr', 'training', 'manage')
  async patchEnrollment(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body()
    body: {
      status?: string;
      certificateRef?: string;
      score?: number;
      notes?: string;
    },
  ) {
    const row = await this.prisma.trainingEnrollment.findFirst({
      where: { id, companyId: user.companyId },
      include: { employee: { include: { driver: true } }, session: { include: { course: true } } },
    });
    if (!row) throw new BadRequestException('Inscription introuvable');
    const updated = await this.prisma.trainingEnrollment.update({
      where: { id },
      data: {
        status: body.status ?? row.status,
        certificateRef: body.certificateRef ?? row.certificateRef,
        score: body.score ?? row.score,
        notes: body.notes ?? row.notes,
        completedAt:
          body.status === 'reussi' || body.status === 'present'
            ? new Date()
            : row.completedAt,
      },
    });
    // Si FCO réussie → prolonger fcoExpiresAt conducteur
    if (
      body.status === 'reussi' &&
      row.session.course.category === 'FCO' &&
      row.employee.driver &&
      (row.session.course.validityMonths || 60)
    ) {
      const months = row.session.course.validityMonths || 60;
      const exp = new Date();
      exp.setMonth(exp.getMonth() + months);
      await this.prisma.driver.update({
        where: { id: row.employee.driver.id },
        data: { fcoExpiresAt: exp },
      });
    }
    return updated;
  }

  // ─── Paye / fiches ─────────────────────────────────────────────

  @Get('payslips')
  @RequirePermission('hr', 'payroll', 'list')
  payslips(
    @CurrentUser() user: RequestUser,
    @Query('yearMonth') yearMonth?: string,
    @Query('status') status?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.prisma.payslip.findMany({
      where: {
        companyId: user.companyId,
        ...(yearMonth ? { yearMonth } : {}),
        ...(status ? { status } : {}),
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            matricule: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            contractType: true,
            driver: { select: { id: true } },
          },
        },
        _count: { select: { lines: true } },
      },
      orderBy: [{ yearMonth: 'desc' }, { employee: { lastName: 'asc' } }],
    });
  }

  @Get('payslips/:id')
  @RequirePermission('hr', 'payroll', 'list')
  async getPayslip(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const p = await this.prisma.payslip.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        employee: {
          include: {
            depot: true,
            driver: true,
            accountLink: { include: { user: true } },
          },
        },
      },
    });
    if (!p) throw new BadRequestException('Fiche de paie introuvable');
    return p;
  }

  /**
   * Génère (ou régénère en brouillon) les fiches de paie du mois
   * à partir des heures planning / habillage + salaire de base.
   */
  @Post('payslips/generate')
  @RequirePermission('hr', 'payroll', 'manage')
  async generatePayslips(
    @CurrentUser() user: RequestUser,
    @Body() body: { yearMonth: string; employeeId?: string; overwriteDraft?: boolean },
  ) {
    const { from, to } = monthBounds(body.yearMonth);
    const employees = await this.prisma.employee.findMany({
      where: {
        companyId: user.companyId,
        status: 'active',
        ...(body.employeeId ? { id: body.employeeId } : {}),
      },
      include: { driver: true },
    });

    const results: Array<{ employeeId: string; payslipId: string; action: string }> =
      [];

    for (const emp of employees) {
      const existing = await this.prisma.payslip.findUnique({
        where: {
          companyId_employeeId_yearMonth: {
            companyId: user.companyId,
            employeeId: emp.id,
            yearMonth: body.yearMonth,
          },
        },
      });
      if (existing && existing.status !== 'draft') {
        results.push({
          employeeId: emp.id,
          payslipId: existing.id,
          action: 'skipped_locked',
        });
        continue;
      }
      if (existing && !body.overwriteDraft) {
        results.push({
          employeeId: emp.id,
          payslipId: existing.id,
          action: 'exists',
        });
        continue;
      }

      let workedHours = 0;
      let overtimeHours = 0;
      let nightHours = 0;
      const dayDetails: Array<{ date: string; hours: number; source: string }> =
        [];

      if (emp.driver) {
        const assignments = await this.prisma.assignment.findMany({
          where: {
            companyId: user.companyId,
            driverId: emp.driver.id,
            startsAt: { gte: from, lt: to },
          },
        });
        const byDay = new Map<string, number>();
        for (const a of assignments) {
          const key = a.startsAt.toISOString().slice(0, 10);
          const h =
            Math.max(0, a.endsAt.getTime() - a.startsAt.getTime()) / 3600000;
          byDay.set(key, (byDay.get(key) || 0) + h);
          const hour = a.startsAt.getHours();
          if (hour < 5 || hour >= 22) nightHours += h * 0.3;
        }
        const dressing = await this.prisma.serviceDressingRun.findMany({
          where: {
            companyId: user.companyId,
            driverId: emp.driver.id,
            workDate: { gte: from, lt: to },
          },
        });
        for (const [date, hours] of byDay) {
          const dress = dressing.find(
            (d) => d.workDate.toISOString().slice(0, 10) === date,
          );
          const finalH = dress ? dress.totalMin / 60 : hours;
          const source = dress ? 'dressing' : 'planning';
          dayDetails.push({ date, hours: round2(finalH), source });
          workedHours += finalH;
          if (finalH > 9) overtimeHours += finalH - 9;
        }
      }

      const leaves = await this.prisma.leaveRequest.findMany({
        where: {
          companyId: user.companyId,
          employeeId: emp.id,
          status: 'approved',
          startsOn: { lt: to },
          endsOn: { gte: from },
        },
      });
      let leaveDays = 0;
      for (const l of leaves) {
        const s = Math.max(l.startsOn.getTime(), from.getTime());
        const e = Math.min(l.endsOn.getTime(), to.getTime() - 1);
        leaveDays += Math.max(0, (e - s) / 86400000 + 1);
      }

      const hourly =
        emp.baseHourlyRate ||
        (emp.baseMonthlySalary && emp.contractHours
          ? emp.baseMonthlySalary / (emp.contractHours * 4.33)
          : 14.5);
      const monthlyBase =
        emp.baseMonthlySalary ||
        round2(hourly * (emp.contractHours || 151.67));

      const presenceAmount = round2(workedHours * hourly);
      const otAmount = round2(overtimeHours * hourly * 1.25);
      const nightAmount = round2(nightHours * hourly * 0.1);
      const panier = Math.floor(workedHours / 8) * 12.5;
      // Conducteur au forfait mensuel, ou rémunération à l’heure planning
      const baseSalary = emp.baseMonthlySalary
        ? round2(emp.baseMonthlySalary)
        : round2(presenceAmount || monthlyBase);

      const lines: Array<{
        code: string;
        label: string;
        kind: string;
        quantity: number;
        rate: number;
        amount: number;
        sortOrder: number;
      }> = [
        {
          code: 'BASE',
          label: emp.baseMonthlySalary
            ? 'Salaire de base mensuel'
            : 'Heures travaillées (planning)',
          kind: 'earning',
          quantity: emp.baseMonthlySalary ? 1 : round2(workedHours),
          rate: emp.baseMonthlySalary ? baseSalary : round2(hourly),
          amount: baseSalary,
          sortOrder: 10,
        },
      ];
      if (overtimeHours > 0.01) {
        lines.push({
          code: 'HS25',
          label: 'Heures supplémentaires 25 %',
          kind: 'earning',
          quantity: round2(overtimeHours),
          rate: round2(hourly * 1.25),
          amount: otAmount,
          sortOrder: 20,
        });
      }
      if (nightHours > 0.01) {
        lines.push({
          code: 'NUIT',
          label: 'Majoration nuit (transport)',
          kind: 'earning',
          quantity: round2(nightHours),
          rate: round2(hourly * 0.1),
          amount: nightAmount,
          sortOrder: 30,
        });
      }
      if (panier > 0) {
        lines.push({
          code: 'PANIER',
          label: 'Indemnité de panier conducteur',
          kind: 'earning',
          quantity: Math.floor(workedHours / 8),
          rate: 12.5,
          amount: round2(panier),
          sortOrder: 40,
        });
      }

      const bonuses = await this.prisma.payrollBonus.findMany({
        where: {
          companyId: user.companyId,
          employeeId: emp.id,
          active: true,
          OR: [
            { kind: 'recurring' },
            { kind: 'one_shot', yearMonth: body.yearMonth },
          ],
        },
      });
      let bonusTotal = 0;
      let bi = 45;
      for (const b of bonuses) {
        bonusTotal += b.amount;
        lines.push({
          code: b.code,
          label: b.label,
          kind: 'earning',
          quantity: 1,
          rate: b.amount,
          amount: round2(b.amount),
          sortOrder: bi++,
        });
      }

      if (leaveDays > 0.01) {
        lines.push({
          code: 'CP',
          label: 'Congés payés (jours)',
          kind: 'info',
          quantity: round2(leaveDays),
          rate: 0,
          amount: 0,
          sortOrder: 50,
        });
      }

      const grossAmount = round2(
        baseSalary + otAmount + nightAmount + panier + bonusTotal,
      );
      const employeeCharges = round2(grossAmount * 0.22);
      const employerCharges = round2(grossAmount * 0.42);
      const netAmount = round2(grossAmount - employeeCharges);

      lines.push(
        {
          code: 'CSG_SAL',
          label: 'Charges salariales (estim.)',
          kind: 'deduction',
          quantity: 1,
          rate: 0.22,
          amount: -employeeCharges,
          sortOrder: 80,
        },
        {
          code: 'NET',
          label: 'Net à payer',
          kind: 'info',
          quantity: 1,
          rate: 0,
          amount: netAmount,
          sortOrder: 90,
        },
        {
          code: 'PAT',
          label: 'Charges patronales (estim.)',
          kind: 'employer',
          quantity: 1,
          rate: 0.42,
          amount: employerCharges,
          sortOrder: 100,
        },
      );

      const sourceHoursJson = JSON.stringify({
        yearMonth: body.yearMonth,
        workedHours: round2(workedHours),
        overtimeHours: round2(overtimeHours),
        nightHours: round2(nightHours),
        leaveDays: round2(leaveDays),
        days: dayDetails,
        hourlyRate: round2(hourly),
      });

      if (existing) {
        await this.prisma.payslipLine.deleteMany({
          where: { payslipId: existing.id },
        });
        const p = await this.prisma.payslip.update({
          where: { id: existing.id },
          data: {
            workedHours: round2(workedHours),
            overtimeHours: round2(overtimeHours),
            nightHours: round2(nightHours),
            leaveDays: round2(leaveDays),
            absenceDays: 0,
            baseSalary,
            grossAmount,
            employeeCharges,
            employerCharges,
            netAmount,
            sourceHoursJson,
            generatedFromPrep: true,
            lines: { create: lines },
          },
        });
        results.push({
          employeeId: emp.id,
          payslipId: p.id,
          action: 'regenerated',
        });
      } else {
        const p = await this.prisma.payslip.create({
          data: {
            companyId: user.companyId,
            employeeId: emp.id,
            yearMonth: body.yearMonth,
            status: 'draft',
            workedHours: round2(workedHours),
            overtimeHours: round2(overtimeHours),
            nightHours: round2(nightHours),
            leaveDays: round2(leaveDays),
            baseSalary,
            grossAmount,
            employeeCharges,
            employerCharges,
            netAmount,
            sourceHoursJson,
            generatedFromPrep: true,
            lines: { create: lines },
          },
        });
        results.push({
          employeeId: emp.id,
          payslipId: p.id,
          action: 'created',
        });
      }
    }

    return {
      yearMonth: body.yearMonth,
      count: results.length,
      results,
    };
  }

  @Patch('payslips/:id')
  @RequirePermission('hr', 'payroll', 'manage')
  async patchPayslip(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body()
    body: {
      status?: string;
      notes?: string;
      workedHours?: number;
      overtimeHours?: number;
      nightHours?: number;
      leaveDays?: number;
      baseSalary?: number;
      grossAmount?: number;
      employeeCharges?: number;
      employerCharges?: number;
      netAmount?: number;
    },
  ) {
    const p = await this.prisma.payslip.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!p) throw new BadRequestException('Fiche introuvable');
    if (p.status === 'paid' && body.status !== 'paid') {
      throw new BadRequestException('Fiche déjà payée');
    }
    const data: Record<string, unknown> = {};
    for (const k of [
      'notes',
      'workedHours',
      'overtimeHours',
      'nightHours',
      'leaveDays',
      'baseSalary',
      'grossAmount',
      'employeeCharges',
      'employerCharges',
      'netAmount',
    ] as const) {
      if (body[k] !== undefined) data[k] = body[k];
    }
    if (body.status) {
      data.status = body.status;
      if (body.status === 'validated') data.validatedAt = new Date();
      if (body.status === 'paid') data.paidAt = new Date();
    }
    return this.prisma.payslip.update({
      where: { id },
      data,
      include: { lines: { orderBy: { sortOrder: 'asc' } }, employee: true },
    });
  }

  @Post('payslips/:id/lines')
  @RequirePermission('hr', 'payroll', 'manage')
  async addLine(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body()
    body: {
      code: string;
      label: string;
      kind?: string;
      quantity?: number;
      rate?: number;
      amount: number;
      sortOrder?: number;
    },
  ) {
    const p = await this.prisma.payslip.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!p) throw new BadRequestException('Fiche introuvable');
    if (p.status !== 'draft') {
      throw new BadRequestException('Seules les fiches brouillon sont éditables');
    }
    const line = await this.prisma.payslipLine.create({
      data: {
        payslipId: id,
        code: body.code,
        label: body.label,
        kind: body.kind || 'earning',
        quantity: body.quantity ?? 1,
        rate: body.rate ?? 0,
        amount: body.amount,
        sortOrder: body.sortOrder ?? 55,
      },
    });
    await this.recomputePayslipTotals(id);
    return line;
  }

  @Patch('payslips/:payslipId/lines/:lineId')
  @RequirePermission('hr', 'payroll', 'manage')
  async patchLine(
    @CurrentUser() user: RequestUser,
    @Param('payslipId') payslipId: string,
    @Param('lineId') lineId: string,
    @Body()
    body: {
      label?: string;
      quantity?: number;
      rate?: number;
      amount?: number;
      kind?: string;
    },
  ) {
    const p = await this.prisma.payslip.findFirst({
      where: { id: payslipId, companyId: user.companyId },
    });
    if (!p || p.status !== 'draft') {
      throw new BadRequestException('Ligne non modifiable');
    }
    const line = await this.prisma.payslipLine.update({
      where: { id: lineId },
      data: {
        label: body.label,
        quantity: body.quantity,
        rate: body.rate,
        amount: body.amount,
        kind: body.kind,
      },
    });
    await this.recomputePayslipTotals(payslipId);
    return line;
  }

  @Delete('payslips/:payslipId/lines/:lineId')
  @RequirePermission('hr', 'payroll', 'manage')
  async deleteLine(
    @CurrentUser() user: RequestUser,
    @Param('payslipId') payslipId: string,
    @Param('lineId') lineId: string,
  ) {
    const p = await this.prisma.payslip.findFirst({
      where: { id: payslipId, companyId: user.companyId },
    });
    if (!p || p.status !== 'draft') {
      throw new BadRequestException('Ligne non supprimable');
    }
    await this.prisma.payslipLine.delete({ where: { id: lineId } });
    await this.recomputePayslipTotals(payslipId);
    return { ok: true };
  }

  private async recomputePayslipTotals(payslipId: string) {
    const lines = await this.prisma.payslipLine.findMany({
      where: { payslipId },
    });
    const earnings = lines
      .filter((l) => l.kind === 'earning')
      .reduce((s, l) => s + l.amount, 0);
    const deductions = lines
      .filter((l) => l.kind === 'deduction')
      .reduce((s, l) => s + Math.abs(l.amount), 0);
    const employer = lines
      .filter((l) => l.kind === 'employer')
      .reduce((s, l) => s + Math.abs(l.amount), 0);
    const gross = round2(earnings);
    const net = round2(gross - deductions);
    await this.prisma.payslip.update({
      where: { id: payslipId },
      data: {
        grossAmount: gross,
        employeeCharges: round2(deductions),
        employerCharges: round2(employer),
        netAmount: net,
      },
    });
  }

  /** Heures du mois pour un salarié (lien planning) */
  @Get('hours')
  @RequirePermission('hr', 'payroll', 'list')
  async hours(
    @CurrentUser() user: RequestUser,
    @Query('yearMonth') yearMonth: string,
    @Query('employeeId') employeeId?: string,
  ) {
    if (!yearMonth) throw new BadRequestException('yearMonth requis');
    const { from, to } = monthBounds(yearMonth);
    const employees = await this.prisma.employee.findMany({
      where: {
        companyId: user.companyId,
        ...(employeeId ? { id: employeeId } : {}),
        driver: { isNot: null },
      },
      include: { driver: true },
    });
    const rows = [];
    for (const emp of employees) {
      if (!emp.driver) continue;
      const assignments = await this.prisma.assignment.findMany({
        where: {
          companyId: user.companyId,
          driverId: emp.driver.id,
          startsAt: { gte: from, lt: to },
        },
      });
      const hours = assignments.reduce(
        (s, a) =>
          s + Math.max(0, a.endsAt.getTime() - a.startsAt.getTime()) / 3600000,
        0,
      );
      rows.push({
        employeeId: emp.id,
        matricule: emp.matricule,
        name: `${emp.lastName} ${emp.firstName}`,
        driverId: emp.driver.id,
        assignmentCount: assignments.length,
        workedHours: round2(hours),
        contractHours: emp.contractHours,
      });
    }
    return { yearMonth, from, to, rows };
  }
}

@Module({
  imports: [AuthModule],
  controllers: [RhSuiteController],
})
export class RhSuiteModule {}
