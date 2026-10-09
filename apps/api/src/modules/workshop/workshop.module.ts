import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard } from '../iam/guards';
import { CurrentUser, RequirePermission } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';
import { AuthModule } from '../iam/auth.module';

@Controller('workshop')
@UseGuards(JwtAuthGuard, PermissionsGuard)
class WorkshopController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('alerts')
  @RequirePermission('fleet', 'workshop', 'list')
  alerts(@CurrentUser() user: RequestUser) {
    return this.prisma.maintenanceAlert.findMany({
      where: { companyId: user.companyId },
      include: { vehicle: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('alerts')
  @RequirePermission('fleet', 'workshop', 'manage')
  createAlert(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      vehicleId: string;
      kind?: string;
      title: string;
      dueKm?: number;
      dueAt?: string;
      priority?: string;
    },
  ) {
    return this.prisma.maintenanceAlert.create({
      data: {
        companyId: user.companyId,
        vehicleId: body.vehicleId,
        kind: body.kind || 'km',
        title: body.title,
        dueKm: body.dueKm,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        priority: body.priority || 'medium',
      },
    });
  }

  @Get('repairs')
  @RequirePermission('fleet', 'workshop', 'list')
  repairs(@CurrentUser() user: RequestUser) {
    return this.prisma.repairRequest.findMany({
      where: { companyId: user.companyId },
      include: { vehicle: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('repairs')
  @RequirePermission('fleet', 'workshop', 'manage')
  createRepair(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      vehicleId?: string;
      title: string;
      description: string;
      source?: string;
      priority?: string;
    },
  ) {
    return this.prisma.repairRequest.create({
      data: {
        companyId: user.companyId,
        vehicleId: body.vehicleId,
        title: body.title,
        description: body.description,
        source: body.source || 'ops',
        priority: body.priority || 'medium',
      },
    });
  }

  @Get('work-orders')
  @RequirePermission('fleet', 'workshop', 'list')
  workOrders(@CurrentUser() user: RequestUser) {
    return this.prisma.workOrder.findMany({
      where: { companyId: user.companyId },
      include: {
        vehicle: true,
        links: { include: { alert: true, repairRequest: true } },
        tasks: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('work-orders')
  @RequirePermission('fleet', 'workshop', 'manage')
  async createWo(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      vehicleId: string;
      diagnosis?: string;
      alertIds?: string[];
      repairIds?: string[];
      immobilize?: boolean;
      tasks?: Array<{ label: string; hours?: number }>;
    },
  ) {
    const count = await this.prisma.workOrder.count({
      where: { companyId: user.companyId },
    });
    const wo = await this.prisma.workOrder.create({
      data: {
        companyId: user.companyId,
        vehicleId: body.vehicleId,
        number: `OR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        diagnosis: body.diagnosis,
        immobilized: !!body.immobilize,
        status: 'in_progress',
        tasks: body.tasks
          ? { create: body.tasks.map((t) => ({ label: t.label, hours: t.hours || 1 })) }
          : undefined,
        links: {
          create: [
            ...(body.alertIds || []).map((alertId) => ({ alertId })),
            ...(body.repairIds || []).map((repairRequestId) => ({
              repairRequestId,
            })),
          ],
        },
      },
      include: { links: true, tasks: true, vehicle: true },
    });
    if (body.immobilize) {
      await this.prisma.vehicle.update({
        where: { id: body.vehicleId },
        data: { status: 'immobilized' },
      });
      await this.prisma.vehicleUnavailability.create({
        data: {
          companyId: user.companyId,
          vehicleId: body.vehicleId,
          kind: 'workshop',
          reason: `OR ${wo.number}`,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 3 * 86400000),
        },
      });
    }
    if (body.alertIds?.length) {
      await this.prisma.maintenanceAlert.updateMany({
        where: { id: { in: body.alertIds } },
        data: { status: 'in_progress' },
      });
    }
    if (body.repairIds?.length) {
      await this.prisma.repairRequest.updateMany({
        where: { id: { in: body.repairIds } },
        data: { status: 'in_progress' },
      });
    }
    return wo;
  }

  @Post('work-orders/:id/close')
  @RequirePermission('fleet', 'workshop', 'manage')
  async close(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { partsCost?: number; laborHours?: number },
  ) {
    const wo = await this.prisma.workOrder.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!wo) throw new BadRequestException('OR introuvable');
    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        status: 'closed',
        closedAt: new Date(),
        partsCost: body.partsCost ?? wo.partsCost,
        laborHours: body.laborHours ?? wo.laborHours,
        immobilized: false,
      },
    });
    await this.prisma.vehicle.update({
      where: { id: wo.vehicleId },
      data: { status: 'available' },
    });
    await this.prisma.maintenanceAlert.updateMany({
      where: {
        vehicleId: wo.vehicleId,
        status: 'in_progress',
        workOrderLinks: { some: { workOrderId: id } },
      },
      data: { status: 'done' },
    });
    return updated;
  }

  @Get('parts')
  @RequirePermission('fleet', 'workshop', 'list')
  parts(@CurrentUser() user: RequestUser) {
    return this.prisma.part.findMany({
      where: { companyId: user.companyId },
      orderBy: { sku: 'asc' },
    });
  }

  @Post('parts')
  @RequirePermission('fleet', 'workshop', 'manage')
  createPart(
    @CurrentUser() user: RequestUser,
    @Body()
    body: { sku: string; name: string; qty?: number; minQty?: number; unitCost?: number },
  ) {
    return this.prisma.part.create({
      data: {
        companyId: user.companyId,
        sku: body.sku,
        name: body.name,
        qty: body.qty ?? 0,
        minQty: body.minQty ?? 1,
        unitCost: body.unitCost ?? 0,
      },
    });
  }

  @Post('parts/:id/move')
  @RequirePermission('fleet', 'workshop', 'manage')
  async move(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body()
    body: {
      kind: 'in' | 'out' | 'adjust';
      quantity: number;
      note?: string;
      workOrderId?: string;
    },
  ) {
    const part = await this.prisma.part.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!part) throw new BadRequestException('Pièce introuvable');
    const delta =
      body.kind === 'out' ? -Math.abs(body.quantity) : Math.abs(body.quantity);
    if (body.kind === 'adjust') {
      // absolute set via note quantity as new qty difference
    }
    const newQty = part.qty + (body.kind === 'adjust' ? body.quantity - part.qty : delta);
    await this.prisma.part.update({ where: { id }, data: { qty: newQty } });
    return this.prisma.stockMovement.create({
      data: {
        companyId: user.companyId,
        partId: id,
        kind: body.kind,
        quantity: body.kind === 'adjust' ? body.quantity : delta,
        unitCost: part.unitCost,
        note: body.note,
        workOrderId: body.workOrderId,
      },
    });
  }

  @Get('purchase-orders')
  @RequirePermission('fleet', 'workshop', 'list')
  pos(@CurrentUser() user: RequestUser) {
    return this.prisma.purchaseOrder.findMany({
      where: { companyId: user.companyId },
      orderBy: { orderedAt: 'desc' },
    });
  }

  @Post('purchase-orders')
  @RequirePermission('fleet', 'workshop', 'manage')
  async createPo(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      supplier: string;
      lines: Array<{ partId: string; qty: number; unitCost: number }>;
    },
  ) {
    const count = await this.prisma.purchaseOrder.count({
      where: { companyId: user.companyId },
    });
    return this.prisma.purchaseOrder.create({
      data: {
        companyId: user.companyId,
        number: `BC-${String(count + 1).padStart(4, '0')}`,
        supplier: body.supplier,
        linesJson: JSON.stringify(body.lines),
        status: 'ordered',
      },
    });
  }

  @Post('purchase-orders/:id/deliver')
  @RequirePermission('fleet', 'workshop', 'manage')
  async deliver(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!po) throw new BadRequestException('BC introuvable');
    const lines = JSON.parse(po.linesJson) as Array<{
      partId: string;
      qty: number;
      unitCost: number;
    }>;
    for (const line of lines) {
      await this.prisma.part.update({
        where: { id: line.partId },
        data: { qty: { increment: line.qty }, unitCost: line.unitCost },
      });
      await this.prisma.stockMovement.create({
        data: {
          companyId: user.companyId,
          partId: line.partId,
          kind: 'in',
          quantity: line.qty,
          unitCost: line.unitCost,
          note: `BL ${po.number}`,
        },
      });
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'delivered', deliveredAt: new Date() },
    });
  }

  @Get('fuel')
  @RequirePermission('fleet', 'workshop', 'list')
  fuel(@CurrentUser() user: RequestUser) {
    return this.prisma.fuelTransaction.findMany({
      where: { companyId: user.companyId },
      include: { vehicle: true },
      orderBy: { filledAt: 'desc' },
      take: 100,
    });
  }

  @Post('fuel')
  @RequirePermission('fleet', 'workshop', 'manage')
  createFuel(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      vehicleId?: string;
      liters: number;
      amount?: number;
      odometerKm?: number;
      source?: string;
      filledAt?: string;
    },
  ) {
    return this.prisma.fuelTransaction.create({
      data: {
        companyId: user.companyId,
        vehicleId: body.vehicleId,
        liters: body.liters,
        amount: body.amount || 0,
        odometerKm: body.odometerKm,
        source: body.source || 'manual',
        status: 'to_check',
        filledAt: body.filledAt ? new Date(body.filledAt) : new Date(),
      },
    });
  }

  @Post('fuel/import')
  @RequirePermission('fleet', 'workshop', 'manage')
  async importFuel(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      rows: Array<{
        plate?: string;
        liters: number;
        amount?: number;
        odometerKm?: number;
        filledAt?: string;
      }>;
    },
  ) {
    const created = [];
    for (const row of body.rows) {
      let vehicleId: string | undefined;
      if (row.plate) {
        const v = await this.prisma.vehicle.findFirst({
          where: { companyId: user.companyId, plate: row.plate },
        });
        vehicleId = v?.id;
      }
      created.push(
        await this.prisma.fuelTransaction.create({
          data: {
            companyId: user.companyId,
            vehicleId,
            liters: row.liters,
            amount: row.amount || 0,
            odometerKm: row.odometerKm,
            source: 'import',
            status: 'to_check',
            filledAt: row.filledAt ? new Date(row.filledAt) : new Date(),
            note: row.plate && !vehicleId ? `Plaque inconnue: ${row.plate}` : null,
          },
        }),
      );
    }
    return { imported: created.length, items: created };
  }

  @Post('fuel/:id/validate')
  @RequirePermission('fleet', 'workshop', 'manage')
  validateFuel(
    @Param('id') id: string,
    @Body() body: { liters?: number; note?: string },
  ) {
    return this.prisma.fuelTransaction.update({
      where: { id },
      data: {
        status: 'validated',
        liters: body.liters,
        note: body.note,
      },
    });
  }
}

@Module({ imports: [AuthModule], controllers: [WorkshopController] })
export class WorkshopModule {}
