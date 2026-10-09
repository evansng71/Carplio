import { Body, Controller, Get, Param, Patch, Post, UseGuards, Module } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard } from '../iam/guards';
import { CurrentUser, RequirePermission } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';
import { AuthModule } from '../iam/auth.module';

class VehicleDto {
  @IsString() fleetNumber!: string;
  @IsString() plate!: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsInt() @Min(1) seats?: number;
  @IsOptional() @IsString() depotId?: string;
  @IsOptional() @IsString() energy?: string;
  @IsOptional() @IsString() status?: string;
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
      include: { depot: true },
      orderBy: { fleetNumber: 'asc' },
    });
  }

  @Get(':id')
  @RequirePermission('fleet', 'vehicle', 'read')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.prisma.vehicle.findFirst({
      where: { id, companyId: user.companyId },
      include: { depot: true, assignments: { include: { mission: true, driver: true } } },
    });
  }

  @Post()
  @RequirePermission('fleet', 'vehicle', 'create')
  create(@CurrentUser() user: RequestUser, @Body() dto: VehicleDto) {
    return this.prisma.vehicle.create({
      data: { companyId: user.companyId, ...dto },
    });
  }

  @Patch(':id')
  @RequirePermission('fleet', 'vehicle', 'update')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: Partial<VehicleDto>,
  ) {
    await this.prisma.vehicle.updateMany({
      where: { id, companyId: user.companyId },
      data: dto,
    });
    return this.prisma.vehicle.findUnique({ where: { id } });
  }
}

@Module({ imports: [AuthModule], controllers: [FleetController] })
export class FleetModule {}
