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

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
class RosterController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('rosters')
  @RequirePermission('services', 'service', 'list')
  list(@CurrentUser() user: RequestUser) {
    return this.prisma.roster.findMany({
      where: { companyId: user.companyId },
      include: {
        slots: {
          include: { service: true, driver: { include: { employee: true } } },
          orderBy: { dayOffset: 'asc' },
        },
        rotations: { orderBy: { weekIndex: 'asc' } },
      },
      orderBy: { code: 'asc' },
    });
  }

  @Post('rosters')
  @RequirePermission('services', 'service', 'create')
  create(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      code: string;
      name: string;
      cycleDays?: number;
      pattern?: string;
      slots?: Array<{
        dayOffset: number;
        label: string;
        serviceId?: string;
        driverId?: string;
        startTime?: string;
        endTime?: string;
      }>;
    },
  ) {
    return this.prisma.roster.create({
      data: {
        companyId: user.companyId,
        code: body.code,
        name: body.name,
        cycleDays: body.cycleDays ?? 14,
        pattern: body.pattern ?? 'A/B',
        slots: body.slots
          ? {
              create: body.slots.map((s) => ({
                dayOffset: s.dayOffset,
                label: s.label,
                serviceId: s.serviceId,
                driverId: s.driverId,
                startTime: s.startTime || '07:00',
                endTime: s.endTime || '09:30',
              })),
            }
          : undefined,
      },
      include: { slots: true, rotations: true },
    });
  }

  @Post('rosters/:id/slots')
  @RequirePermission('services', 'service', 'update')
  addSlot(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body()
    body: {
      dayOffset: number;
      label: string;
      serviceId?: string;
      driverId?: string;
      startTime?: string;
      endTime?: string;
    },
  ) {
    return this.prisma.roster
      .findFirst({ where: { id, companyId: user.companyId } })
      .then((r) => {
        if (!r) throw new BadRequestException('Roulement introuvable');
        return this.prisma.rosterSlot.create({
          data: {
            rosterId: id,
            dayOffset: body.dayOffset,
            label: body.label,
            serviceId: body.serviceId,
            driverId: body.driverId,
            startTime: body.startTime || '07:00',
            endTime: body.endTime || '09:30',
          },
        });
      });
  }

  @Delete('rosters/:id/slots/:slotId')
  @RequirePermission('services', 'service', 'update')
  deleteSlot(@Param('slotId') slotId: string) {
    return this.prisma.rosterSlot.delete({ where: { id: slotId } });
  }

  /** Applique le roulement sur une période → crée missions + affectations draft */
  @Post('rosters/:id/apply')
  @RequirePermission('planning', 'assignment', 'assign')
  async apply(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { from: string; days?: number; publish?: boolean },
  ) {
    const roster = await this.prisma.roster.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        slots: { include: { service: true, driver: true } },
      },
    });
    if (!roster) throw new BadRequestException('Roulement introuvable');

    const customer = await this.prisma.customer.findFirst({
      where: { companyId: user.companyId },
    });
    if (!customer) throw new BadRequestException('Aucun client pour générer');

    const from = new Date(body.from);
    from.setHours(0, 0, 0, 0);
    const days = body.days ?? roster.cycleDays;
    const created: unknown[] = [];

    for (let d = 0; d < days; d++) {
      const day = new Date(from.getTime() + d * 86400000);
      const offset = d % roster.cycleDays;
      const slots = roster.slots.filter((s) => s.dayOffset === offset);
      for (const slot of slots) {
        const [sh, sm] = (slot.startTime || '07:00').split(':').map(Number);
        const [eh, em] = (slot.endTime || '09:30').split(':').map(Number);
        const startsAt = new Date(day);
        startsAt.setHours(sh, sm, 0, 0);
        const endsAt = new Date(day);
        endsAt.setHours(eh, em, 0, 0);

        const orderCount = await this.prisma.order.count({
          where: { companyId: user.companyId },
        });
        const order = await this.prisma.order.create({
          data: {
            companyId: user.companyId,
            customerId: customer.id,
            number: `C-R-${Date.now().toString(36)}-${d}`,
            title: `${roster.name} — ${slot.label}`,
            status: body.publish ? 'published' : 'planned',
          },
        });
        const mission = await this.prisma.mission.create({
          data: {
            companyId: user.companyId,
            orderId: order.id,
            number: `M-R-${Date.now().toString(36)}-${orderCount}-${d}`,
            title: slot.label,
            startsAt,
            endsAt,
            origin: 'Dépôt',
            destination: slot.service?.name || slot.label,
            status: body.publish ? 'published' : 'planned',
            publishedAt: body.publish ? new Date() : null,
          },
        });
        const assignment = await this.prisma.assignment.create({
          data: {
            companyId: user.companyId,
            missionId: mission.id,
            driverId: slot.driverId || undefined,
            startsAt,
            endsAt,
            status: body.publish ? 'published' : 'planned',
            published: !!body.publish,
            notes: `Roulement ${roster.code}`,
          },
        });
        created.push({ mission, assignment });
      }
    }

    return { created: created.length, items: created };
  }

  @Get('theoretical-assignments')
  @RequirePermission('planning', 'assignment', 'list')
  listTheo(@CurrentUser() user: RequestUser) {
    return this.prisma.theoreticalAssignment.findMany({
      where: { companyId: user.companyId },
      include: {
        service: true,
        course: true,
        driver: { include: { employee: true } },
        vehicle: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('theoretical-assignments')
  @RequirePermission('planning', 'assignment', 'assign')
  createTheo(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      serviceId?: string;
      courseId?: string;
      driverId?: string;
      vehicleId?: string;
      weekday?: number;
      notes?: string;
    },
  ) {
    return this.prisma.theoreticalAssignment.create({
      data: { companyId: user.companyId, ...body },
      include: {
        service: true,
        driver: { include: { employee: true } },
        vehicle: true,
      },
    });
  }

  @Delete('theoretical-assignments/:id')
  @RequirePermission('planning', 'assignment', 'unassign')
  deleteTheo(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.prisma.theoreticalAssignment.deleteMany({
      where: { id, companyId: user.companyId },
    });
  }

  @Get('unavailabilities')
  @RequirePermission('planning', 'assignment', 'list')
  async unavs(
    @CurrentUser() user: RequestUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const start = from ? new Date(from) : new Date();
    const end = to ? new Date(to) : new Date(start.getTime() + 14 * 86400000);
    const [drivers, vehicles] = await Promise.all([
      this.prisma.driverUnavailability.findMany({
        where: {
          companyId: user.companyId,
          startsAt: { lt: end },
          endsAt: { gt: start },
        },
        include: { driver: { include: { employee: true } } },
      }),
      this.prisma.vehicleUnavailability.findMany({
        where: {
          companyId: user.companyId,
          startsAt: { lt: end },
          endsAt: { gt: start },
        },
        include: { vehicle: true },
      }),
    ]);
    return { drivers, vehicles, from: start, to: end };
  }

  @Post('unavailabilities/driver')
  @RequirePermission('planning', 'assignment', 'assign')
  async createDriverUnav(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      driverId: string;
      kind?: string;
      reason?: string;
      startsAt: string;
      endsAt: string;
    },
  ) {
    const unav = await this.prisma.driverUnavailability.create({
      data: {
        companyId: user.companyId,
        driverId: body.driverId,
        kind: body.kind || 'absence',
        reason: body.reason,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
      },
    });
    const impacted = await this.prisma.assignment.findMany({
      where: {
        companyId: user.companyId,
        driverId: body.driverId,
        startsAt: { lt: new Date(body.endsAt) },
        endsAt: { gt: new Date(body.startsAt) },
      },
      include: { mission: true },
    });
    await this.prisma.opsAlert.create({
      data: {
        companyId: user.companyId,
        severity: 'warning',
        title: `Absence conducteur — ${impacted.length} mission(s) impactée(s)`,
        body: body.reason || body.kind,
        href: '/app/planning',
      },
    });
    return { unav, impacted };
  }

  @Post('unavailabilities/vehicle')
  @RequirePermission('planning', 'assignment', 'assign')
  async createVehicleUnav(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      vehicleId: string;
      kind?: string;
      reason?: string;
      startsAt: string;
      endsAt: string;
    },
  ) {
    const unav = await this.prisma.vehicleUnavailability.create({
      data: {
        companyId: user.companyId,
        vehicleId: body.vehicleId,
        kind: body.kind || 'maintenance',
        reason: body.reason,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
      },
    });
    await this.prisma.vehicle.update({
      where: { id: body.vehicleId },
      data: { status: 'immobilized' },
    });
    const impacted = await this.prisma.assignment.findMany({
      where: {
        companyId: user.companyId,
        vehicleId: body.vehicleId,
        startsAt: { lt: new Date(body.endsAt) },
        endsAt: { gt: new Date(body.startsAt) },
      },
      include: { mission: true },
    });
    await this.prisma.opsAlert.create({
      data: {
        companyId: user.companyId,
        severity: 'warning',
        title: `Véhicule indisponible — ${impacted.length} affectation(s)`,
        body: body.reason,
        href: '/app/planning',
      },
    });
    return { unav, impacted };
  }
}

@Module({ imports: [AuthModule], controllers: [RosterController] })
export class RosterModule {}
