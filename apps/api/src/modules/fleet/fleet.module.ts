import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard } from '../iam/guards';
import { CurrentUser, RequirePermission } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';
import { AuthModule } from '../iam/auth.module';

class VehicleDto {
  @IsString() fleetNumber!: string;
  @IsString() plate!: string;
  @IsOptional() @IsString() brand?: string | null;
  @IsOptional() @IsString() model?: string | null;
  @IsOptional() @IsString() vin?: string | null;
  @IsOptional() @IsInt() year?: number | null;
  @IsOptional() @IsString() color?: string | null;
  @IsOptional() @IsInt() @Min(1) seats?: number;
  @IsOptional() @IsString() depotId?: string | null;
  @IsOptional() @IsString() categoryId?: string | null;
  @IsOptional() @IsString() energy?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsInt() odometerKm?: number;
  @IsOptional() @IsString() inspectionExpiresAt?: string | null;
  @IsOptional() @IsString() insuranceExpiresAt?: string | null;
  @IsOptional() @IsString() tachographExpiresAt?: string | null;
  @IsOptional() @IsString() nextMaintenanceAt?: string | null;
  @IsOptional() @IsInt() nextMaintenanceKm?: number | null;
  @IsOptional() @IsBoolean() hasPmr?: boolean;
  @IsOptional() @IsBoolean() hasToilet?: boolean;
  @IsOptional() @IsBoolean() hasWifi?: boolean;
  @IsOptional() @IsString() optionsNotes?: string | null;
  @IsOptional() @IsString() notes?: string | null;
}

function parseDate(v?: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mapVehicleData(dto: Partial<VehicleDto>) {
  const {
    inspectionExpiresAt,
    insuranceExpiresAt,
    tachographExpiresAt,
    nextMaintenanceAt,
    ...rest
  } = dto;
  return {
    ...rest,
    ...(inspectionExpiresAt !== undefined
      ? { inspectionExpiresAt: parseDate(inspectionExpiresAt) }
      : {}),
    ...(insuranceExpiresAt !== undefined
      ? { insuranceExpiresAt: parseDate(insuranceExpiresAt) }
      : {}),
    ...(tachographExpiresAt !== undefined
      ? { tachographExpiresAt: parseDate(tachographExpiresAt) }
      : {}),
    ...(nextMaintenanceAt !== undefined
      ? { nextMaintenanceAt: parseDate(nextMaintenanceAt) }
      : {}),
  };
}

@Controller('vehicles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
class FleetController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('fleet', 'vehicle', 'list')
  list(@CurrentUser() user: RequestUser) {
    return this.prisma.vehicle.findMany({
      where: { companyId: user.companyId },
      include: {
        depot: true,
        category: true,
        _count: { select: { assignments: true, unavailabilities: true } },
      },
      orderBy: { fleetNumber: 'asc' },
    });
  }

  @Get(':id')
  @RequirePermission('fleet', 'vehicle', 'read')
  async get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const v = await this.prisma.vehicle.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        depot: true,
        category: true,
        assignments: {
          include: {
            mission: {
              include: { order: { include: { customer: true } } },
            },
            driver: { include: { employee: true } },
          },
          orderBy: { startsAt: 'desc' },
          take: 30,
        },
        unavailabilities: { orderBy: { startsAt: 'desc' }, take: 20 },
        maintenanceAlerts: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!v) throw new NotFoundException('Véhicule introuvable');
    return v;
  }

  @Post()
  @RequirePermission('fleet', 'vehicle', 'create')
  create(@CurrentUser() user: RequestUser, @Body() dto: VehicleDto) {
    return this.prisma.vehicle.create({
      data: {
        companyId: user.companyId,
        ...mapVehicleData(dto),
        fleetNumber: dto.fleetNumber,
        plate: dto.plate,
        seats: dto.seats ?? 53,
      },
      include: { depot: true, category: true },
    });
  }

  @Patch(':id')
  @RequirePermission('fleet', 'vehicle', 'update')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: Partial<VehicleDto>,
  ) {
    const existing = await this.prisma.vehicle.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!existing) throw new BadRequestException('Véhicule introuvable');
    return this.prisma.vehicle.update({
      where: { id },
      data: mapVehicleData(dto),
      include: { depot: true, category: true },
    });
  }

  @Post(':id/unavailability')
  @RequirePermission('fleet', 'vehicle', 'update')
  async addUnav(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body()
    body: { kind?: string; reason?: string; startsAt: string; endsAt: string },
  ) {
    const v = await this.prisma.vehicle.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!v) throw new BadRequestException('Véhicule introuvable');
    return this.prisma.vehicleUnavailability.create({
      data: {
        companyId: user.companyId,
        vehicleId: id,
        kind: body.kind || 'maintenance',
        reason: body.reason,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
      },
    });
  }
}

@Module({ imports: [AuthModule], controllers: [FleetController] })
export class FleetModule {}
