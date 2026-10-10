import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard } from '../iam/guards';
import { CurrentUser, RequirePermission } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';
import { AuthModule } from '../iam/auth.module';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function daysUntil(d: Date | null | undefined) {
  if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

@Controller('ops')
@UseGuards(JwtAuthGuard, PermissionsGuard)
class OpsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Cockpit exploitation — KPIs + alertes conformité */
  @Get('overview')
  @RequirePermission('planning', 'assignment', 'list')
  async overview(
    @CurrentUser() user: RequestUser,
    @Query('date') date?: string,
  ) {
    const day = date ? startOfDay(new Date(date)) : startOfDay(new Date());
    const dayEnd = endOfDay(day);
    const weekEnd = new Date(day);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const [
      missionsToday,
      toPlan,
      published,
      inProgress,
      unassigned,
      assignmentsToday,
      driversActive,
      vehiclesAvailable,
      drivers,
      vehicles,
      conflictsPreview,
    ] = await Promise.all([
      this.prisma.mission.count({
        where: {
          companyId: user.companyId,
          startsAt: { lt: dayEnd },
          endsAt: { gt: day },
        },
      }),
      this.prisma.mission.count({
        where: {
          companyId: user.companyId,
          status: 'to_plan',
          startsAt: { gte: day, lt: weekEnd },
        },
      }),
      this.prisma.mission.count({
        where: {
          companyId: user.companyId,
          status: 'published',
          startsAt: { lt: dayEnd },
          endsAt: { gt: day },
        },
      }),
      this.prisma.mission.count({
        where: {
          companyId: user.companyId,
          status: 'in_progress',
        },
      }),
      this.prisma.mission.count({
        where: {
          companyId: user.companyId,
          startsAt: { gte: day, lt: weekEnd },
          assignments: { none: {} },
          status: { notIn: ['cancelled', 'done', 'to_invoice'] },
        },
      }),
      this.prisma.assignment.count({
        where: {
          companyId: user.companyId,
          startsAt: { lt: dayEnd },
          endsAt: { gt: day },
        },
      }),
      this.prisma.driver.count({
        where: { companyId: user.companyId, status: 'active' },
      }),
      this.prisma.vehicle.count({
        where: { companyId: user.companyId, status: 'available' },
      }),
      this.prisma.driver.findMany({
        where: { companyId: user.companyId, status: 'active' },
        include: { employee: true },
      }),
      this.prisma.vehicle.findMany({
        where: { companyId: user.companyId },
        include: { category: true, depot: true },
      }),
      this.prisma.assignment.findMany({
        where: {
          companyId: user.companyId,
          startsAt: { lt: weekEnd },
          endsAt: { gt: day },
        },
        select: {
          id: true,
          driverId: true,
          vehicleId: true,
          startsAt: true,
          endsAt: true,
        },
      }),
    ]);

    const complianceAlerts: Array<{
      kind: string;
      severity: 'critical' | 'warn' | 'info';
      label: string;
      resourceType: 'driver' | 'vehicle';
      resourceId: string;
      expiresAt?: string;
      daysLeft?: number | null;
    }> = [];

    for (const d of drivers) {
      const checks: Array<[string, Date | null | undefined]> = [
        ['Permis', d.licenseExpiresAt],
        ['Carte chrono', d.cardExpiresAt],
        ['FCO', d.fcoExpiresAt],
        ['Visite médicale', d.medicalExpiresAt],
      ];
      for (const [label, exp] of checks) {
        const left = daysUntil(exp);
        if (left == null) continue;
        if (left < 0) {
          complianceAlerts.push({
            kind: 'expired',
            severity: 'critical',
            label: `${d.employee.firstName} ${d.employee.lastName} — ${label} expiré`,
            resourceType: 'driver',
            resourceId: d.id,
            expiresAt: exp!.toISOString(),
            daysLeft: left,
          });
        } else if (left <= 30) {
          complianceAlerts.push({
            kind: 'expiring',
            severity: left <= 7 ? 'critical' : 'warn',
            label: `${d.employee.firstName} ${d.employee.lastName} — ${label} dans ${left} j`,
            resourceType: 'driver',
            resourceId: d.id,
            expiresAt: exp!.toISOString(),
            daysLeft: left,
          });
        }
      }
    }

    for (const v of vehicles) {
      const checks: Array<[string, Date | null | undefined]> = [
        ['Contrôle technique', v.inspectionExpiresAt],
        ['Assurance', v.insuranceExpiresAt],
        ['Chronotachygraphe', v.tachographExpiresAt],
        ['Entretien', v.nextMaintenanceAt],
      ];
      for (const [label, exp] of checks) {
        const left = daysUntil(exp);
        if (left == null) continue;
        if (left < 0) {
          complianceAlerts.push({
            kind: 'expired',
            severity: 'critical',
            label: `${v.fleetNumber} (${v.plate}) — ${label} expiré`,
            resourceType: 'vehicle',
            resourceId: v.id,
            expiresAt: exp!.toISOString(),
            daysLeft: left,
          });
        } else if (left <= 30) {
          complianceAlerts.push({
            kind: 'expiring',
            severity: left <= 7 ? 'critical' : 'warn',
            label: `${v.fleetNumber} (${v.plate}) — ${label} dans ${left} j`,
            resourceType: 'vehicle',
            resourceId: v.id,
            expiresAt: exp!.toISOString(),
            daysLeft: left,
          });
        }
      }
    }

    complianceAlerts.sort(
      (a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999),
    );

    let conflictCount = 0;
    for (let i = 0; i < conflictsPreview.length; i++) {
      for (let j = i + 1; j < conflictsPreview.length; j++) {
        const a = conflictsPreview[i];
        const b = conflictsPreview[j];
        if (!(a.startsAt < b.endsAt && a.endsAt > b.startsAt)) continue;
        if (
          (a.driverId && a.driverId === b.driverId) ||
          (a.vehicleId && a.vehicleId === b.vehicleId)
        ) {
          conflictCount += 1;
        }
      }
    }

    const upcoming = await this.prisma.mission.findMany({
      where: {
        companyId: user.companyId,
        startsAt: { gte: day, lt: weekEnd },
      },
      include: {
        order: { include: { customer: true, quote: true } },
        assignments: {
          include: {
            driver: { include: { employee: true } },
            vehicle: true,
          },
        },
      },
      orderBy: { startsAt: 'asc' },
      take: 12,
    });

    return {
      date: day.toISOString(),
      kpis: {
        missionsToday,
        toPlan,
        published,
        inProgress,
        unassigned,
        assignmentsToday,
        driversActive,
        vehiclesAvailable,
        conflictCount,
        complianceCritical: complianceAlerts.filter(
          (a) => a.severity === 'critical',
        ).length,
      },
      complianceAlerts: complianceAlerts.slice(0, 20),
      upcoming,
    };
  }

  /**
   * Affectation automatique des missions non affectées sur une journée
   * (disponibilité + capacité places + PMR + même dépôt si possible)
   */
  @Post('auto-assign')
  @RequirePermission('planning', 'assignment', 'assign')
  async autoAssign(
    @CurrentUser() user: RequestUser,
    @Body() body: { date?: string; dryRun?: boolean },
  ) {
    const day = body.date
      ? startOfDay(new Date(body.date))
      : startOfDay(new Date());
    const dayEnd = endOfDay(day);

    const missions = await this.prisma.mission.findMany({
      where: {
        companyId: user.companyId,
        startsAt: { lt: dayEnd },
        endsAt: { gt: day },
        assignments: { none: {} },
        status: { in: ['to_plan', 'planned'] },
      },
      include: {
        order: { include: { customer: true, quote: true } },
      },
      orderBy: { startsAt: 'asc' },
    });

    const drivers = await this.prisma.driver.findMany({
      where: { companyId: user.companyId, status: 'active' },
      include: { employee: true, depot: true },
    });
    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        companyId: user.companyId,
        status: { in: ['available', 'in_service'] },
      },
      include: { depot: true, category: true },
    });

    const existing = await this.prisma.assignment.findMany({
      where: {
        companyId: user.companyId,
        startsAt: { lt: dayEnd },
        endsAt: { gt: day },
      },
    });
    const unavDrivers = await this.prisma.driverUnavailability.findMany({
      where: {
        companyId: user.companyId,
        startsAt: { lt: dayEnd },
        endsAt: { gt: day },
      },
    });
    const unavVehicles = await this.prisma.vehicleUnavailability.findMany({
      where: {
        companyId: user.companyId,
        startsAt: { lt: dayEnd },
        endsAt: { gt: day },
      },
    });

    const busyDriver = new Set(
      existing.filter((a) => a.driverId).map((a) => a.driverId!),
    );
    const busyVehicle = new Set(
      existing.filter((a) => a.vehicleId).map((a) => a.vehicleId!),
    );
    // Track newly assigned in this run
    const usedDrivers = new Set(busyDriver);
    const usedVehicles = new Set(busyVehicle);

    const results: Array<{
      missionId: string;
      missionNumber: string;
      ok: boolean;
      reason: string;
      driverId?: string;
      vehicleId?: string;
      driverName?: string;
      vehicleLabel?: string;
    }> = [];

    for (const mission of missions) {
      const start = mission.startsAt;
      const end = mission.endsAt;
      const needSeats = mission.minSeats || mission.passengers || 0;

      const freeDrivers = drivers.filter((d) => {
        if (usedDrivers.has(d.id)) return false;
        if (
          unavDrivers.some(
            (u) =>
              u.driverId === d.id && u.startsAt < end && u.endsAt > start,
          )
        )
          return false;
        if (
          existing.some(
            (a) =>
              a.driverId === d.id && a.startsAt < end && a.endsAt > start,
          )
        )
          return false;
        // Licence expired?
        if (d.licenseExpiresAt && d.licenseExpiresAt < start) return false;
        return true;
      });

      const freeVehicles = vehicles.filter((v) => {
        if (usedVehicles.has(v.id)) return false;
        if (v.seats < needSeats) return false;
        if (mission.requiresPmr && !v.hasPmr) return false;
        if (
          unavVehicles.some(
            (u) =>
              u.vehicleId === v.id && u.startsAt < end && u.endsAt > start,
          )
        )
          return false;
        if (
          existing.some(
            (a) =>
              a.vehicleId === v.id && a.startsAt < end && a.endsAt > start,
          )
        )
          return false;
        if (v.inspectionExpiresAt && v.inspectionExpiresAt < start)
          return false;
        return true;
      });

      // Prefer same depot pairing
      let bestDriver = freeDrivers[0];
      let bestVehicle = freeVehicles[0];
      let reason = '';

      if (!bestDriver || !bestVehicle) {
        results.push({
          missionId: mission.id,
          missionNumber: mission.number,
          ok: false,
          reason: !bestDriver
            ? 'Aucun conducteur libre / habilité'
            : `Aucun véhicule assez grand (${needSeats} places${mission.requiresPmr ? ', PMR' : ''})`,
        });
        continue;
      }

      const paired = freeDrivers.find((d) =>
        freeVehicles.some((v) => v.depotId && v.depotId === d.depotId),
      );
      if (paired) {
        bestDriver = paired;
        bestVehicle =
          freeVehicles.find((v) => v.depotId === paired.depotId) ||
          bestVehicle;
        reason = `Même dépôt (${bestDriver.depot?.name || 'dépôt'}) · ${bestVehicle.seats} places`;
      } else {
        reason = `Dispo · ${bestVehicle.seats} places ≥ ${needSeats}`;
      }

      if (body.dryRun) {
        results.push({
          missionId: mission.id,
          missionNumber: mission.number,
          ok: true,
          reason: `[simulation] ${reason}`,
          driverId: bestDriver.id,
          vehicleId: bestVehicle.id,
          driverName: `${bestDriver.employee.firstName} ${bestDriver.employee.lastName}`,
          vehicleLabel: `${bestVehicle.fleetNumber} · ${bestVehicle.plate}`,
        });
        usedDrivers.add(bestDriver.id);
        usedVehicles.add(bestVehicle.id);
        continue;
      }

      await this.prisma.assignment.create({
        data: {
          companyId: user.companyId,
          missionId: mission.id,
          driverId: bestDriver.id,
          vehicleId: bestVehicle.id,
          startsAt: start,
          endsAt: end,
          status: 'planned',
          notes: `Auto-affecté : ${reason}`,
        },
      });
      await this.prisma.mission.update({
        where: { id: mission.id },
        data: { status: 'planned' },
      });
      usedDrivers.add(bestDriver.id);
      usedVehicles.add(bestVehicle.id);
      results.push({
        missionId: mission.id,
        missionNumber: mission.number,
        ok: true,
        reason,
        driverId: bestDriver.id,
        vehicleId: bestVehicle.id,
        driverName: `${bestDriver.employee.firstName} ${bestDriver.employee.lastName}`,
        vehicleLabel: `${bestVehicle.fleetNumber} · ${bestVehicle.plate}`,
      });
    }

    return {
      date: day.toISOString(),
      dryRun: !!body.dryRun,
      total: missions.length,
      assigned: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  @Get('dispatch')
  @RequirePermission('planning', 'assignment', 'list')
  async dispatch(
    @CurrentUser() user: RequestUser,
    @Query('date') date?: string,
  ) {
    const day = date ? startOfDay(new Date(date)) : startOfDay(new Date());
    const dayEnd = endOfDay(day);

    const missions = await this.prisma.mission.findMany({
      where: {
        companyId: user.companyId,
        startsAt: { lt: dayEnd },
        endsAt: { gt: day },
      },
      include: {
        order: {
          include: {
            customer: true,
            quote: { include: { vehicleCategory: true } },
          },
        },
        assignments: {
          include: {
            driver: { include: { employee: true } },
            vehicle: true,
          },
        },
      },
      orderBy: { startsAt: 'asc' },
    });

    return {
      date: day.toISOString(),
      missions: missions.map((m) => ({
        ...m,
        assigned: m.assignments.length > 0,
        capacityOk: m.assignments.every(
          (a) => !a.vehicle || a.vehicle.seats >= (m.minSeats || m.passengers),
        ),
        pmrOk:
          !m.requiresPmr ||
          m.assignments.some((a) => a.vehicle?.hasPmr),
      })),
    };
  }
}

@Module({ imports: [AuthModule], controllers: [OpsController] })
export class OpsModule {}
