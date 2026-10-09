import {
  BadRequestException,
  Body,
  Controller,
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

type BlockInput = {
  sequence: number;
  kind: string;
  label: string;
  startsAt: Date;
  endsAt: Date;
  distanceKm?: number;
  paid?: boolean;
  locked?: boolean;
  fromLocation?: string;
  toLocation?: string;
};

function buildDressing(params: {
  workDate: Date;
  commercialStart: Date;
  commercialEnd: Date;
  scenario: {
    prepMin: number;
    finishMin: number;
    cashMin: number;
    approachHlpMin: number;
    returnHlpMin: number;
    paidBreakMin: number;
  };
  origin: string;
  destination: string;
  depotName: string;
  lockedKinds?: string[];
}): BlockInput[] {
  const s = params.scenario;
  const locked = new Set(params.lockedKinds || []);
  const blocks: BlockInput[] = [];
  let seq = 1;

  const approachStart = new Date(
    params.commercialStart.getTime() - (s.prepMin + s.approachHlpMin) * 60000,
  );
  const prepStart = approachStart;
  const prepEnd = new Date(prepStart.getTime() + s.prepMin * 60000);
  const hlpApproachEnd = params.commercialStart;

  blocks.push({
    sequence: seq++,
    kind: 'duty_start',
    label: 'Prise de service',
    startsAt: prepStart,
    endsAt: prepEnd,
    paid: true,
    locked: locked.has('duty_start'),
    fromLocation: params.depotName,
    toLocation: params.depotName,
  });
  blocks.push({
    sequence: seq++,
    kind: 'hlp_approach',
    label: 'HLP approche',
    startsAt: prepEnd,
    endsAt: hlpApproachEnd,
    distanceKm: 8,
    paid: true,
    locked: locked.has('hlp_approach'),
    fromLocation: params.depotName,
    toLocation: params.origin,
  });
  blocks.push({
    sequence: seq++,
    kind: 'commercial',
    label: 'Course commerciale',
    startsAt: params.commercialStart,
    endsAt: params.commercialEnd,
    distanceKm: 18,
    paid: true,
    locked: locked.has('commercial'),
    fromLocation: params.origin,
    toLocation: params.destination,
  });

  if (s.paidBreakMin > 0) {
    const breakStart = params.commercialEnd;
    const breakEnd = new Date(breakStart.getTime() + s.paidBreakMin * 60000);
    blocks.push({
      sequence: seq++,
      kind: 'paid_break',
      label: 'Coupure rémunérée',
      startsAt: breakStart,
      endsAt: breakEnd,
      paid: true,
      locked: locked.has('paid_break'),
      fromLocation: params.destination,
      toLocation: params.destination,
    });
  }

  const afterCommercial = new Date(
    params.commercialEnd.getTime() + s.paidBreakMin * 60000,
  );
  const cashEnd = new Date(afterCommercial.getTime() + s.cashMin * 60000);
  const hlpReturnEnd = new Date(cashEnd.getTime() + s.returnHlpMin * 60000);
  const finishEnd = new Date(hlpReturnEnd.getTime() + s.finishMin * 60000);

  if (s.cashMin > 0) {
    blocks.push({
      sequence: seq++,
      kind: 'cash',
      label: 'Caisse / recette',
      startsAt: afterCommercial,
      endsAt: cashEnd,
      paid: true,
      locked: locked.has('cash'),
      fromLocation: params.destination,
      toLocation: params.destination,
    });
  }
  blocks.push({
    sequence: seq++,
    kind: 'hlp_return',
    label: 'Retour dépôt',
    startsAt: cashEnd,
    endsAt: hlpReturnEnd,
    distanceKm: 8,
    paid: true,
    locked: locked.has('hlp_return'),
    fromLocation: params.destination,
    toLocation: params.depotName,
  });
  blocks.push({
    sequence: seq++,
    kind: 'duty_end',
    label: 'Fin de service',
    startsAt: hlpReturnEnd,
    endsAt: finishEnd,
    paid: true,
    locked: locked.has('duty_end'),
    fromLocation: params.depotName,
    toLocation: params.depotName,
  });

  return blocks;
}

@Controller('dressing')
@UseGuards(JwtAuthGuard, PermissionsGuard)
class DressingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('scenarios')
  @RequirePermission('planning', 'assignment', 'list')
  scenarios(@CurrentUser() user: RequestUser) {
    return this.prisma.serviceDressingScenario.findMany({
      where: { companyId: user.companyId },
      orderBy: { code: 'asc' },
    });
  }

  @Post('scenarios')
  @RequirePermission('planning', 'assignment', 'assign')
  createScenario(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      code: string;
      name: string;
      prepMin?: number;
      finishMin?: number;
      cashMin?: number;
      approachHlpMin?: number;
      returnHlpMin?: number;
      paidBreakMin?: number;
    },
  ) {
    return this.prisma.serviceDressingScenario.create({
      data: {
        companyId: user.companyId,
        code: body.code,
        name: body.name,
        prepMin: body.prepMin ?? 15,
        finishMin: body.finishMin ?? 10,
        cashMin: body.cashMin ?? 5,
        approachHlpMin: body.approachHlpMin ?? 20,
        returnHlpMin: body.returnHlpMin ?? 20,
        paidBreakMin: body.paidBreakMin ?? 0,
      },
    });
  }

  @Get('runs')
  @RequirePermission('planning', 'assignment', 'list')
  runs(
    @CurrentUser() user: RequestUser,
    @Query('date') date?: string,
  ) {
    const where: { companyId: string; workDate?: { gte: Date; lt: Date } } = {
      companyId: user.companyId,
    };
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d.getTime() + 86400000);
      where.workDate = { gte: d, lt: next };
    }
    return this.prisma.serviceDressingRun.findMany({
      where,
      include: {
        scenario: true,
        driver: { include: { employee: true } },
        service: true,
        blocks: { orderBy: { sequence: 'asc' } },
      },
      orderBy: { workDate: 'desc' },
      take: 50,
    });
  }

  @Get('runs/:id')
  @RequirePermission('planning', 'assignment', 'list')
  run(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.prisma.serviceDressingRun.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        scenario: true,
        driver: { include: { employee: true } },
        service: true,
        blocks: { orderBy: { sequence: 'asc' } },
      },
    });
  }

  /** Génère un habillage depuis une affectation */
  @Post('generate')
  @RequirePermission('planning', 'assignment', 'assign')
  async generate(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      assignmentId: string;
      scenarioId: string;
      keepLocked?: boolean;
    },
  ) {
    const assignment = await this.prisma.assignment.findFirst({
      where: { id: body.assignmentId, companyId: user.companyId },
      include: { mission: true, driver: true },
    });
    if (!assignment) throw new BadRequestException('Affectation introuvable');
    const scenario = await this.prisma.serviceDressingScenario.findFirst({
      where: { id: body.scenarioId, companyId: user.companyId },
    });
    if (!scenario) throw new BadRequestException('Scénario introuvable');

    const existing = await this.prisma.serviceDressingRun.findFirst({
      where: { assignmentId: assignment.id },
      include: { blocks: true },
    });
    const lockedKinds = body.keepLocked
      ? existing?.blocks.filter((b) => b.locked).map((b) => b.kind) || []
      : [];

    if (existing) {
      await this.prisma.serviceTimeBlock.deleteMany({
        where: {
          runId: existing.id,
          locked: false,
        },
      });
      await this.prisma.serviceDressingRun.delete({ where: { id: existing.id } });
    }

    const depot =
      (await this.prisma.location.findFirst({
        where: { companyId: user.companyId, type: 'depot' },
      }))?.name || 'Dépôt';

    const blocks = buildDressing({
      workDate: assignment.startsAt,
      commercialStart: assignment.startsAt,
      commercialEnd: assignment.endsAt,
      scenario,
      origin: assignment.mission.origin || 'Origine',
      destination: assignment.mission.destination || 'Destination',
      depotName: depot,
      lockedKinds,
    });

    const totalMin = blocks.reduce(
      (acc, b) =>
        acc + Math.round((b.endsAt.getTime() - b.startsAt.getTime()) / 60000),
      0,
    );
    const totalKm = blocks.reduce((acc, b) => acc + (b.distanceKm || 0), 0);

    const run = await this.prisma.serviceDressingRun.create({
      data: {
        companyId: user.companyId,
        scenarioId: scenario.id,
        assignmentId: assignment.id,
        driverId: assignment.driverId,
        workDate: assignment.startsAt,
        status: 'calculated',
        totalMin,
        totalKm,
        lockedBlocksJson: JSON.stringify(lockedKinds),
        blocks: {
          create: blocks.map((b) => ({
            companyId: user.companyId,
            sequence: b.sequence,
            kind: b.kind,
            label: b.label,
            startsAt: b.startsAt,
            endsAt: b.endsAt,
            distanceKm: b.distanceKm || 0,
            paid: b.paid !== false,
            locked: !!b.locked,
            fromLocation: b.fromLocation,
            toLocation: b.toLocation,
          })),
        },
      },
      include: {
        blocks: { orderBy: { sequence: 'asc' } },
        scenario: true,
        driver: { include: { employee: true } },
      },
    });
    return run;
  }

  @Patch('blocks/:id')
  @RequirePermission('planning', 'assignment', 'assign')
  async patchBlock(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body()
    body: {
      startsAt?: string;
      endsAt?: string;
      locked?: boolean;
      label?: string;
      notes?: string;
    },
  ) {
    const block = await this.prisma.serviceTimeBlock.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!block) throw new BadRequestException('Bloc introuvable');
    return this.prisma.serviceTimeBlock.update({
      where: { id },
      data: {
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
        locked: body.locked,
        label: body.label,
        notes: body.notes,
      },
    });
  }

  /** Réhabillage après changement conducteur / lieux */
  @Post('runs/:id/rehab')
  @RequirePermission('planning', 'assignment', 'assign')
  async rehab(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { origin?: string; destination?: string; driverId?: string },
  ) {
    const run = await this.prisma.serviceDressingRun.findFirst({
      where: { id, companyId: user.companyId },
      include: { scenario: true, blocks: true },
    });
    if (!run || !run.assignmentId) {
      throw new BadRequestException('Run introuvable');
    }
    if (body.driverId) {
      await this.prisma.assignment.update({
        where: { id: run.assignmentId },
        data: { driverId: body.driverId },
      });
      if (body.origin || body.destination) {
        const a = await this.prisma.assignment.findUnique({
          where: { id: run.assignmentId },
        });
        if (a) {
          await this.prisma.mission.update({
            where: { id: a.missionId },
            data: {
              origin: body.origin,
              destination: body.destination,
            },
          });
        }
      }
    }
    return this.generate(user, {
      assignmentId: run.assignmentId,
      scenarioId: run.scenarioId,
      keepLocked: true,
    });
  }
}

@Module({ imports: [AuthModule], controllers: [DressingController] })
export class DressingModule {}
