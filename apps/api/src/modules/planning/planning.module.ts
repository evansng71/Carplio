import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  Module,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard } from '../iam/guards';
import { CurrentUser, RequirePermission } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';
import { AuthModule } from '../iam/auth.module';

@Controller('planning')
@UseGuards(JwtAuthGuard, PermissionsGuard)
class PlanningController {
  constructor(private readonly prisma: PrismaService) {}

  /** Vue unifiée jour / semaine / quatorzaine */
  @Get('board')
  @RequirePermission('planning', 'assignment', 'list')
  async board(
    @CurrentUser() user: RequestUser,
    @Query('from') from?: string,
    @Query('mode') mode: 'day' | 'week' | 'fortnight' = 'fortnight',
  ) {
    const start = from ? startOfDay(new Date(from)) : startOfDay(new Date());
    const days = mode === 'day' ? 1 : mode === 'week' ? 7 : 14;
    const end = new Date(start);
    end.setDate(end.getDate() + days);

    const missionInclude = {
      order: {
        include: {
          customer: true,
          quote: { include: { vehicleCategory: true } },
        },
      },
    } as const;

    const [
      drivers,
      vehicles,
      assignments,
      rests,
      driverUnavs,
      vehicleUnavs,
      unassigned,
      cancelled,
    ] = await Promise.all([
      this.prisma.driver.findMany({
        where: { companyId: user.companyId, status: 'active' },
        include: { employee: true, depot: true },
        orderBy: { employee: { lastName: 'asc' } },
      }),
      this.prisma.vehicle.findMany({
        where: { companyId: user.companyId },
        include: { depot: true, category: true },
      }),
      this.prisma.assignment.findMany({
        where: {
          companyId: user.companyId,
          startsAt: { lt: end },
          endsAt: { gt: start },
        },
        include: {
          mission: { include: missionInclude },
          driver: { include: { employee: true } },
          vehicle: true,
        },
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.plannedRest.findMany({
        where: {
          companyId: user.companyId,
          startsAt: { lt: end },
          endsAt: { gt: start },
        },
      }),
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
      this.prisma.mission.findMany({
        where: {
          companyId: user.companyId,
          startsAt: { lt: end },
          endsAt: { gt: start },
          assignments: { none: {} },
          status: { notIn: ['cancelled'] },
        },
        include: missionInclude,
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.mission.findMany({
        where: {
          companyId: user.companyId,
          startsAt: { lt: end },
          endsAt: { gt: start },
          status: 'cancelled',
        },
        include: missionInclude,
        orderBy: { startsAt: 'asc' },
      }),
    ]);

    const conflicts = detectConflicts(assignments);
    const unavConflicts = [
      ...assignments
        .filter((a) =>
          driverUnavs.some(
            (u) =>
              u.driverId === a.driverId &&
              a.startsAt < u.endsAt &&
              a.endsAt > u.startsAt,
          ),
        )
        .map((a) => ({ type: 'driver_unavailability', assignmentId: a.id })),
      ...assignments
        .filter((a) =>
          vehicleUnavs.some(
            (u) =>
              u.vehicleId === a.vehicleId &&
              a.startsAt < u.endsAt &&
              a.endsAt > u.startsAt,
          ),
        )
        .map((a) => ({ type: 'vehicle_unavailability', assignmentId: a.id })),
    ];

    /** Stats journalières par conducteur (TTE, vacations, début, véhicule principal) */
    const driverStats = drivers.map((d) => {
      const mine = assignments
        .filter((a) => a.driverId === d.id)
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        );
      const tteHours =
        Math.round(
          (mine.reduce(
            (s, a) =>
              s +
              Math.max(
                0,
                new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime(),
              ),
            0,
          ) /
            3600000) *
            100,
        ) / 100;
      const vehiclesUsed = [
        ...new Set(
          mine
            .map((a) => a.vehicle?.fleetNumber || a.vehicle?.plate)
            .filter(Boolean) as string[],
        ),
      ];
      const primaryVehicle = mine.find((a) => a.vehicle)?.vehicle || null;
      const weeklyRest = rests.some(
        (r) =>
          r.driverId === d.id &&
          (r.kind === 'weekly_rest' || r.kind === 'repos_hebdo'),
      );
      return {
        driverId: d.id,
        tteHours,
        vacCount: mine.length,
        debut: mine[0]?.startsAt || null,
        fin: mine.length ? mine[mine.length - 1].endsAt : null,
        vehiclesUsed,
        primaryVehicle,
        weeklyRest,
        overtime: tteHours > 9,
      };
    });

    return {
      mode,
      from: start.toISOString(),
      to: end.toISOString(),
      days,
      drivers,
      vehicles,
      assignments,
      rests,
      driverUnavs,
      vehicleUnavs,
      /** compat */
      orphans: unassigned,
      pool: {
        unassigned,
        cancelled,
        unprogrammed: unassigned.filter((m) => m.status === 'to_plan'),
      },
      driverStats,
      conflicts: [...conflicts, ...unavConflicts],
    };
  }

  @Get('fortnight')
  @RequirePermission('planning', 'assignment', 'list')
  fortnight(@CurrentUser() user: RequestUser, @Query('from') from?: string) {
    return this.board(user, from, 'fortnight');
  }

  /**
   * Place une mission non affectée.
   * Conducteur et véhicule sont indépendants (au moins l’un des deux requis).
   */
  @Post('place')
  @RequirePermission('planning', 'assignment', 'assign')
  async place(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      missionId: string;
      driverId?: string;
      vehicleId?: string;
      /** Si true et véhicule non fourni : tentative d’auto-affectation véhicule */
      autoVehicle?: boolean;
      startsAt?: string;
      endsAt?: string;
      publish?: boolean;
    },
  ) {
    const mission = await this.prisma.mission.findFirst({
      where: { id: body.missionId, companyId: user.companyId },
      include: { assignments: true },
    });
    if (!mission) throw new BadRequestException('Mission introuvable');
    if (mission.assignments.length > 0) {
      throw new BadRequestException('Mission déjà affectée — désaffectez d’abord');
    }
    if (!body.driverId && !body.vehicleId) {
      throw new BadRequestException('Conducteur ou véhicule requis');
    }

    let vehicleId = body.vehicleId || undefined;
    if (!vehicleId && body.autoVehicle && body.driverId) {
      const dayStart = startOfDay(mission.startsAt);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const sameDay = await this.prisma.assignment.findFirst({
        where: {
          companyId: user.companyId,
          driverId: body.driverId,
          vehicleId: { not: null },
          startsAt: { lt: dayEnd },
          endsAt: { gt: dayStart },
        },
        orderBy: { startsAt: 'desc' },
      });
      vehicleId = sameDay?.vehicleId || undefined;
      if (!vehicleId) {
        const need = mission.minSeats || mission.passengers || 0;
        const candidate = await this.prisma.vehicle.findFirst({
          where: {
            companyId: user.companyId,
            status: { in: ['available', 'in_service'] },
            seats: need > 0 ? { gte: need } : undefined,
            ...(mission.requiresPmr ? { hasPmr: true } : {}),
          },
          orderBy: { fleetNumber: 'asc' },
        });
        vehicleId = candidate?.id;
      }
    }

    const assignment = await this.assign(user, {
      missionId: body.missionId,
      driverId: body.driverId || undefined,
      vehicleId,
      startsAt: body.startsAt || mission.startsAt.toISOString(),
      endsAt: body.endsAt || mission.endsAt.toISOString(),
      notes: 'Placé depuis le planning',
    });
    if (body.publish !== false) {
      await this.publish(user, assignment.id);
    }
    return this.prisma.assignment.findFirstOrThrow({
      where: { id: assignment.id },
      include: {
        mission: {
          include: {
            order: {
              include: {
                customer: true,
                quote: { include: { vehicleCategory: true } },
              },
            },
          },
        },
        driver: { include: { employee: true } },
        vehicle: true,
      },
    });
  }

  @Post('assignments')
  @RequirePermission('planning', 'assignment', 'assign')
  async assign(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      missionId: string;
      driverId?: string;
      vehicleId?: string;
      startsAt: string;
      endsAt: string;
      notes?: string;
    },
  ) {
    const mission = await this.prisma.mission.findFirst({
      where: { id: body.missionId, companyId: user.companyId },
    });
    if (!mission) throw new BadRequestException('Mission introuvable');

    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);

    if (body.driverId) {
      const overlap = await this.prisma.assignment.findFirst({
        where: {
          companyId: user.companyId,
          driverId: body.driverId,
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
      });
      if (overlap) {
        throw new BadRequestException({
          message: 'Collision conducteur',
          conflictAssignmentId: overlap.id,
        });
      }
      const unav = await this.prisma.driverUnavailability.findFirst({
        where: {
          driverId: body.driverId,
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
      });
      if (unav) {
        throw new BadRequestException({
          message: 'Conducteur indisponible sur la période',
          unavailabilityId: unav.id,
        });
      }
    }
    if (body.vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: body.vehicleId, companyId: user.companyId },
      });
      if (!vehicle) throw new BadRequestException('Véhicule introuvable');
      const needSeats = mission.minSeats || mission.passengers || 0;
      if (needSeats > 0 && vehicle.seats < needSeats) {
        throw new BadRequestException(
          `Capacité insuffisante : ${vehicle.seats} places < ${needSeats} passagers`,
        );
      }
      if (mission.requiresPmr && !vehicle.hasPmr) {
        throw new BadRequestException(
          'Ce véhicule n’est pas équipé PMR alors que la mission le requiert',
        );
      }
      if (
        vehicle.inspectionExpiresAt &&
        vehicle.inspectionExpiresAt < startsAt
      ) {
        throw new BadRequestException('Contrôle technique du véhicule expiré');
      }
      const overlap = await this.prisma.assignment.findFirst({
        where: {
          companyId: user.companyId,
          vehicleId: body.vehicleId,
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
      });
      if (overlap) {
        throw new BadRequestException({
          message: 'Collision véhicule',
          conflictAssignmentId: overlap.id,
        });
      }
      const unav = await this.prisma.vehicleUnavailability.findFirst({
        where: {
          vehicleId: body.vehicleId,
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
      });
      if (unav) {
        throw new BadRequestException({
          message: 'Véhicule indisponible',
          unavailabilityId: unav.id,
        });
      }
    }
    if (body.driverId) {
      const driver = await this.prisma.driver.findFirst({
        where: { id: body.driverId, companyId: user.companyId },
      });
      if (driver?.licenseExpiresAt && driver.licenseExpiresAt < startsAt) {
        throw new BadRequestException('Permis du conducteur expiré');
      }
    }

    const assignment = await this.prisma.assignment.create({
      data: {
        companyId: user.companyId,
        missionId: body.missionId,
        driverId: body.driverId,
        vehicleId: body.vehicleId,
        startsAt,
        endsAt,
        notes: body.notes,
        status: 'planned',
      },
      include: { mission: true, driver: true, vehicle: true },
    });

    await this.prisma.mission.update({
      where: { id: mission.id },
      data: { status: 'planned' },
    });

    return assignment;
  }

  @Post('assignments/:id/reassign')
  @RequirePermission('planning', 'assignment', 'assign')
  async reassign(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body()
    body: {
      /** null = retirer le conducteur */
      driverId?: string | null;
      /** null = retirer le véhicule */
      vehicleId?: string | null;
    },
  ) {
    const a = await this.prisma.assignment.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!a) throw new BadRequestException('Affectation introuvable');
    const nextDriver =
      body.driverId === undefined ? a.driverId : body.driverId || null;
    const nextVehicle =
      body.vehicleId === undefined ? a.vehicleId : body.vehicleId || null;
    if (!nextDriver && !nextVehicle) {
      throw new BadRequestException(
        'Une affectation doit garder au moins un conducteur ou un véhicule',
      );
    }
    return this.prisma.assignment.update({
      where: { id },
      data: {
        driverId: nextDriver,
        vehicleId: nextVehicle,
        version: a.version + 1,
        status: a.published ? 'published' : 'planned',
      },
      include: {
        mission: true,
        driver: { include: { employee: true } },
        vehicle: true,
      },
    });
  }

  @Post('assignments/:id/publish')
  @RequirePermission('planning', 'assignment', 'publish')
  async publish(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const a = await this.prisma.assignment.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!a) throw new BadRequestException('Affectation introuvable');
    const updated = await this.prisma.assignment.update({
      where: { id },
      data: { published: true, status: 'published', version: a.version + 1 },
    });
    await this.prisma.mission.update({
      where: { id: a.missionId },
      data: { status: 'published', publishedAt: new Date() },
    });
    return updated;
  }

  @Post('publish-range')
  @RequirePermission('planning', 'assignment', 'publish')
  async publishRange(
    @CurrentUser() user: RequestUser,
    @Body() body: { from: string; to: string; label?: string },
  ) {
    const from = new Date(body.from);
    const to = new Date(body.to);
    const result = await this.prisma.assignment.updateMany({
      where: {
        companyId: user.companyId,
        published: false,
        startsAt: { gte: from, lt: to },
      },
      data: { published: true, status: 'published' },
    });
    const missions = await this.prisma.assignment.findMany({
      where: {
        companyId: user.companyId,
        startsAt: { gte: from, lt: to },
        published: true,
      },
      select: { missionId: true },
    });
    const ids = [...new Set(missions.map((m) => m.missionId))];
    await this.prisma.mission.updateMany({
      where: { id: { in: ids } },
      data: { status: 'published', publishedAt: new Date() },
    });
    const batch = await this.prisma.planningPublicationBatch.create({
      data: {
        companyId: user.companyId,
        label: body.label || `Publication ${from.toLocaleDateString('fr-FR')}`,
        fromDate: from,
        toDate: to,
        count: result.count,
      },
    });
    return { updated: result.count, batch };
  }

  @Post('assignments/:id/unassign')
  @RequirePermission('planning', 'assignment', 'unassign')
  unassign(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.prisma.assignment.deleteMany({
      where: { id, companyId: user.companyId },
    });
  }

  /** Propose un conducteur + véhicule libres */
  @Get('suggest-replacement')
  @RequirePermission('planning', 'assignment', 'assign')
  async suggest(
    @CurrentUser() user: RequestUser,
    @Query('startsAt') startsAt: string,
    @Query('endsAt') endsAt: string,
    @Query('excludeDriverId') excludeDriverId?: string,
  ) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    const busyDrivers = await this.prisma.assignment.findMany({
      where: {
        companyId: user.companyId,
        startsAt: { lt: end },
        endsAt: { gt: start },
        driverId: { not: null },
      },
      select: { driverId: true },
    });
    const busyVehicles = await this.prisma.assignment.findMany({
      where: {
        companyId: user.companyId,
        startsAt: { lt: end },
        endsAt: { gt: start },
        vehicleId: { not: null },
      },
      select: { vehicleId: true },
    });
    const unavDrivers = await this.prisma.driverUnavailability.findMany({
      where: {
        companyId: user.companyId,
        startsAt: { lt: end },
        endsAt: { gt: start },
      },
      select: { driverId: true },
    });
    const excludeD = new Set([
      ...busyDrivers.map((b) => b.driverId!),
      ...unavDrivers.map((u) => u.driverId),
      ...(excludeDriverId ? [excludeDriverId] : []),
    ]);
    const excludeV = new Set(busyVehicles.map((b) => b.vehicleId!));

    const drivers = await this.prisma.driver.findMany({
      where: {
        companyId: user.companyId,
        status: 'active',
        id: { notIn: [...excludeD] },
      },
      include: { employee: true },
      take: 5,
    });
    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        companyId: user.companyId,
        status: 'available',
        id: { notIn: [...excludeV] },
      },
      take: 5,
    });
    return { drivers, vehicles };
  }
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function detectConflicts(
  assignments: Array<{
    id: string;
    driverId: string | null;
    vehicleId: string | null;
    startsAt: Date;
    endsAt: Date;
  }>,
) {
  const conflicts: Array<{ type: string; a: string; b: string }> = [];
  for (let i = 0; i < assignments.length; i++) {
    for (let j = i + 1; j < assignments.length; j++) {
      const a = assignments[i];
      const b = assignments[j];
      const overlap = a.startsAt < b.endsAt && a.endsAt > b.startsAt;
      if (!overlap) continue;
      if (a.driverId && a.driverId === b.driverId) {
        conflicts.push({ type: 'driver', a: a.id, b: b.id });
      }
      if (a.vehicleId && a.vehicleId === b.vehicleId) {
        conflicts.push({ type: 'vehicle', a: a.id, b: b.id });
      }
    }
  }
  return conflicts;
}

@Module({ imports: [AuthModule], controllers: [PlanningController] })
export class PlanningModule {}
