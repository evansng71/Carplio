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
  @IsOptional() @IsString() sensitiveNotes?: string;
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
              include: {
                memberships: { include: { group: true } },
                invitations: { orderBy: { createdAt: 'desc' }, take: 3 },
              },
            },
          },
        },
        leaveRequests: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!emp) return null;
    const sensitive = this.engine.authorize(user, {
      module: 'hr',
      resource: 'sensitive',
      action: 'read',
    });
    if (!sensitive.allowed) {
      const { sensitiveNotes: _, ...rest } = emp;
      return { ...rest, sensitiveNotes: null, _sensitiveHidden: true };
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
    if (dto.sensitiveNotes !== undefined) {
      const sensitive = this.engine.authorize(user, {
        module: 'hr',
        resource: 'sensitive',
        action: 'read',
      });
      if (!sensitive.allowed) {
        throw new ForbiddenException('Données RH sensibles interdites');
      }
    }
    await this.prisma.employee.updateMany({
      where: { id, companyId: user.companyId },
      data: dto,
    });
    return this.prisma.employee.findUnique({ where: { id } });
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
      },
      include: { employee: true },
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
  decide(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { status: 'approved' | 'rejected'; decisionNote?: string },
  ) {
    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: body.status,
        decisionNote: body.decisionNote,
        decidedAt: new Date(),
      },
    });
  }
}

@Module({ imports: [AuthModule], controllers: [HrController] })
export class HrModule {}
