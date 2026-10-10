import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Module,
  ForbiddenException,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard } from '../iam/guards';
import { CurrentUser, RequirePermission } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';
import { AuthModule } from '../iam/auth.module';
import { PermissionEngine } from '../iam/permission.engine';

class EmployeeDto {
  @IsString() matricule!: string;
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() depotId?: string;
  @IsOptional() @IsString() jobTitle?: string;
  @IsOptional() @IsString() contractType?: string;
  @IsOptional() @IsString() classification?: string;
  @IsOptional() @IsString() echelon?: string;
  @IsOptional() contractHours?: number;
  @IsOptional() baseHourlyRate?: number;
  @IsOptional() baseMonthlySalary?: number;
  @IsOptional() weeklyHours?: number;
  @IsOptional() dependentsCount?: number;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() addressLine1?: string;
  @IsOptional() @IsString() addressLine2?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() birthPlace?: string;
  @IsOptional() @IsString() familyStatus?: string;
  @IsOptional() @IsString() collectiveAgreement?: string;
  @IsOptional() @IsString() jobCoefficient?: string;
  @IsOptional() @IsString() workTimeType?: string;
  @IsOptional() @IsString() mutuelle?: string;
  @IsOptional() @IsString() prevoyance?: string;
  @IsOptional() @IsString() iban?: string;
  @IsOptional() @IsString() bic?: string;
  @IsOptional() @IsString() socialSecurityNumber?: string;
  @IsOptional() @IsString() emergencyContact?: string;
  @IsOptional() @IsString() emergencyPhone?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() sensitiveNotes?: string;
  @IsOptional() @IsString() rhNotes?: string;
  /** ISO date strings */
  @IsOptional() @IsString() hiredAt?: string;
  @IsOptional() @IsString() endedAt?: string;
  @IsOptional() @IsString() birthDate?: string;
  @IsOptional() @IsString() trialEndAt?: string;
}

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
class HrController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: PermissionEngine,
  ) {}

  @Get('employees')
  @RequirePermission('hr', 'employee', 'list')
  list(@CurrentUser() user: RequestUser) {
    return this.prisma.employee.findMany({
      where: { companyId: user.companyId },
      include: {
        depot: true,
        driver: true,
        accountLink: { include: { user: true } },
      },
      orderBy: { lastName: 'asc' },
    });
  }

  @Get('employees/:id')
  @RequirePermission('hr', 'employee', 'read')
  async get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const emp = await this.prisma.employee.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        depot: true,
        driver: true,
        accountLink: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                status: true,
                mustChangePassword: true,
                lastLoginAt: true,
                memberships: { include: { group: true } },
                invitations: { orderBy: { createdAt: 'desc' }, take: 3 },
              },
            },
          },
        },
        leaveRequests: { orderBy: { createdAt: 'desc' }, take: 20 },
        leaveBalances: { orderBy: [{ year: 'desc' }, { type: 'asc' }] },
        bonuses: { where: { active: true }, orderBy: { createdAt: 'desc' } },
        payslips: {
          orderBy: { yearMonth: 'desc' },
          take: 24,
          select: {
            id: true,
            yearMonth: true,
            status: true,
            workedHours: true,
            overtimeHours: true,
            grossAmount: true,
            netAmount: true,
            employeeCharges: true,
            employerCharges: true,
          },
        },
        interviews: {
          orderBy: { scheduledAt: 'desc' },
          take: 20,
        },
        enrollments: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            session: {
              include: { course: true },
            },
          },
        },
      },
    });
    if (!emp) return null;
    const sensitive = this.engine.authorize(user, {
      module: 'hr',
      resource: 'sensitive',
      action: 'read',
    });
    if (!sensitive.allowed) {
      const {
        sensitiveNotes: _n,
        socialSecurityNumber: _ssn,
        iban: _iban,
        bic: _bic,
        ...rest
      } = emp;
      return {
        ...rest,
        sensitiveNotes: null,
        socialSecurityNumber: null,
        iban: null,
        bic: null,
        _sensitiveHidden: true,
      };
    }
    return emp;
  }

  @Post('employees')
  @RequirePermission('hr', 'employee', 'update')
  create(@CurrentUser() user: RequestUser, @Body() dto: EmployeeDto) {
    return this.prisma.employee.create({
      data: { companyId: user.companyId, ...dto },
    });
  }

  @Patch('employees/:id')
  @RequirePermission('hr', 'employee', 'update')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: Partial<EmployeeDto>,
  ) {
    const sensitiveKeys = [
      'sensitiveNotes',
      'socialSecurityNumber',
      'iban',
      'bic',
    ] as const;
    if (sensitiveKeys.some((k) => dto[k] !== undefined)) {
      const sensitive = this.engine.authorize(user, {
        module: 'hr',
        resource: 'sensitive',
        action: 'read',
      });
      if (!sensitive.allowed) {
        throw new ForbiddenException('Données RH sensibles interdites');
      }
    }
    const data: Record<string, unknown> = { ...dto };
    for (const key of ['hiredAt', 'endedAt', 'birthDate', 'trialEndAt'] as const) {
      if (dto[key] !== undefined) {
        data[key] = dto[key] ? new Date(dto[key] as string) : null;
      }
    }
    await this.prisma.employee.updateMany({
      where: { id, companyId: user.companyId },
      data: data as Partial<EmployeeDto>,
    });
    return this.get(user, id);
  }

  @Get('drivers')
  @RequirePermission('drivers', 'driver', 'list')
  drivers(@CurrentUser() user: RequestUser) {
    return this.prisma.driver.findMany({
      where: { companyId: user.companyId },
      include: {
        employee: { include: { accountLink: { include: { user: true } } } },
        depot: true,
        rests: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('drivers/:id')
  @RequirePermission('drivers', 'driver', 'read')
  driver(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.prisma.driver.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        employee: {
          include: {
            accountLink: {
              include: {
                user: {
                  include: {
                    memberships: { include: { group: true } },
                    invitations: { orderBy: { createdAt: 'desc' }, take: 3 },
                    sessions: {
                      where: { revokedAt: null, expiresAt: { gt: new Date() } },
                    },
                  },
                },
              },
            },
          },
        },
        depot: true,
        rests: true,
        assignments: {
          include: { mission: true, vehicle: true },
          orderBy: { startsAt: 'asc' },
          take: 50,
        },
      },
    });
  }

  @Post('drivers')
  @RequirePermission('drivers', 'driver', 'create')
  async createDriver(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      matricule: string;
      firstName: string;
      lastName: string;
      email?: string;
      depotId?: string;
      licenseNumber?: string;
      licenseCategories?: string;
    },
  ) {
    const employee = await this.prisma.employee.create({
      data: {
        companyId: user.companyId,
        matricule: body.matricule,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        depotId: body.depotId,
        jobTitle: 'Conducteur',
      },
    });
    return this.prisma.driver.create({
      data: {
        companyId: user.companyId,
        employeeId: employee.id,
        depotId: body.depotId,
        licenseNumber: body.licenseNumber,
        licenseCategories: body.licenseCategories || 'D',
      },
      include: { employee: true },
    });
  }

  @Patch('drivers/:id')
  @RequirePermission('drivers', 'driver', 'update')
  async updateDriver(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body()
    body: {
      depotId?: string | null;
      licenseNumber?: string | null;
      licenseCategories?: string | null;
      licenseExpiresAt?: string | null;
      cardExpiresAt?: string | null;
      fcoExpiresAt?: string | null;
      medicalExpiresAt?: string | null;
      adrExpiresAt?: string | null;
      qualifications?: string | null;
      maxDailyHours?: number | null;
      preferredNotes?: string | null;
      status?: string;
    },
  ) {
    const existing = await this.prisma.driver.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!existing) throw new ForbiddenException('Conducteur introuvable');
    const parse = (v?: string | null) => {
      if (v === undefined) return undefined;
      if (!v) return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    return this.prisma.driver.update({
      where: { id },
      data: {
        ...(body.depotId !== undefined ? { depotId: body.depotId } : {}),
        ...(body.licenseNumber !== undefined
          ? { licenseNumber: body.licenseNumber }
          : {}),
        ...(body.licenseCategories !== undefined
          ? { licenseCategories: body.licenseCategories }
          : {}),
        ...(body.licenseExpiresAt !== undefined
          ? { licenseExpiresAt: parse(body.licenseExpiresAt) }
          : {}),
        ...(body.cardExpiresAt !== undefined
          ? { cardExpiresAt: parse(body.cardExpiresAt) }
          : {}),
        ...(body.fcoExpiresAt !== undefined
          ? { fcoExpiresAt: parse(body.fcoExpiresAt) }
          : {}),
        ...(body.medicalExpiresAt !== undefined
          ? { medicalExpiresAt: parse(body.medicalExpiresAt) }
          : {}),
        ...(body.adrExpiresAt !== undefined
          ? { adrExpiresAt: parse(body.adrExpiresAt) }
          : {}),
        ...(body.qualifications !== undefined
          ? { qualifications: body.qualifications }
          : {}),
        ...(body.maxDailyHours !== undefined
          ? { maxDailyHours: body.maxDailyHours }
          : {}),
        ...(body.preferredNotes !== undefined
          ? { preferredNotes: body.preferredNotes }
          : {}),
        ...(body.status ? { status: body.status } : {}),
      },
      include: {
        employee: true,
        depot: true,
      },
    });
  }

  @Get('leaves')
  @RequirePermission('hr', 'leave', 'approve')
  leaves(@CurrentUser() user: RequestUser) {
    return this.prisma.leaveRequest.findMany({
      where: { companyId: user.companyId },
      include: { employee: true, requester: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('leaves/:id/decide')
  @RequirePermission('hr', 'leave', 'approve')
  async decide(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { status: 'approved' | 'rejected'; decisionNote?: string },
  ) {
    const leave = await this.prisma.leaveRequest.findFirst({
      where: { id, companyId: user.companyId },
      include: { employee: { include: { driver: true } } },
    });
    if (!leave) return null;
    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: body.status,
        decisionNote: body.decisionNote,
        decidedAt: new Date(),
      },
      include: { employee: { include: { driver: true } } },
    });
    // Sync exploitation : indisponibilité conducteur pour bloquer le planning
    if (
      body.status === 'approved' &&
      updated.employee.driver &&
      updated.startsOn &&
      updated.endsOn
    ) {
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
    return updated;
  }
}

@Module({ imports: [AuthModule], controllers: [HrController] })
export class HrModule {}
