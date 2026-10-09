import { Body, Controller, Get, Param, Post, UseGuards, Module } from '@nestjs/common';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard } from '../iam/guards';
import { CurrentUser, RequirePermission } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';
import { AuthModule } from '../iam/auth.module';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
class TransportController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('locations')
  @RequirePermission('courses', 'course', 'list')
  locations(@CurrentUser() user: RequestUser) {
    return this.prisma.location.findMany({
      where: { companyId: user.companyId },
      orderBy: { name: 'asc' },
    });
  }

  @Post('locations')
  @RequirePermission('courses', 'course', 'create')
  createLocation(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      name: string;
      type?: string;
      address?: string;
      city?: string;
      lat?: number;
      lng?: number;
    },
  ) {
    return this.prisma.location.create({
      data: { companyId: user.companyId, ...body },
    });
  }

  @Get('calendars')
  @RequirePermission('courses', 'course', 'list')
  calendars(@CurrentUser() user: RequestUser) {
    return this.prisma.operatingCalendar.findMany({
      where: { companyId: user.companyId },
    });
  }

  @Post('calendars')
  @RequirePermission('courses', 'course', 'create')
  createCalendar(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      name: string;
      kind?: string;
      weekdays?: string;
      oddEven?: string;
      exceptionsJson?: string;
    },
  ) {
    return this.prisma.operatingCalendar.create({
      data: { companyId: user.companyId, ...body },
    });
  }

  @Get('courses')
  @RequirePermission('courses', 'course', 'list')
  courses(@CurrentUser() user: RequestUser) {
    return this.prisma.course.findMany({
      where: { companyId: user.companyId },
      include: {
        segments: { orderBy: { sequence: 'asc' } },
        operations: { orderBy: { sequence: 'asc' } },
      },
    });
  }

  @Post('courses')
  @RequirePermission('courses', 'course', 'create')
  async createCourse(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      code: string;
      name: string;
      kind?: string;
      distanceKm?: number;
      durationMin?: number;
      segments?: Array<{ sequence: number; kind?: string; name: string; plannedTime?: string; locationId?: string }>;
    },
  ) {
    const { segments, ...data } = body;
    return this.prisma.course.create({
      data: {
        companyId: user.companyId,
        ...data,
        segments: segments
          ? { create: segments.map((s) => ({ ...s, kind: s.kind || 'stop' })) }
          : undefined,
      },
      include: { segments: true },
    });
  }

  @Get('services')
  @RequirePermission('services', 'service', 'list')
  services(@CurrentUser() user: RequestUser) {
    return this.prisma.service.findMany({
      where: { companyId: user.companyId },
      include: {
        courseLinks: {
          include: { course: true },
          orderBy: { sequence: 'asc' },
        },
      },
    });
  }

  @Post('services')
  @RequirePermission('services', 'service', 'create')
  createService(
    @CurrentUser() user: RequestUser,
    @Body() body: { code: string; name: string; courseIds?: string[] },
  ) {
    return this.prisma.service.create({
      data: {
        companyId: user.companyId,
        code: body.code,
        name: body.name,
        courseLinks: body.courseIds
          ? {
              create: body.courseIds.map((courseId, i) => ({
                courseId,
                sequence: i + 1,
              })),
            }
          : undefined,
      },
      include: { courseLinks: { include: { course: true } } },
    });
  }

  @Get('itineraries')
  @RequirePermission('courses', 'course', 'list')
  itineraries(@CurrentUser() user: RequestUser) {
    return this.prisma.itinerary.findMany({
      where: { companyId: user.companyId },
      orderBy: { code: 'asc' },
    });
  }

  @Post('itineraries')
  @RequirePermission('courses', 'course', 'create')
  createItinerary(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      code: string;
      name: string;
      distanceKm?: number;
      durationMin?: number;
      stops?: Array<{ name: string; lat?: number; lng?: number }>;
    },
  ) {
    return this.prisma.itinerary.create({
      data: {
        companyId: user.companyId,
        code: body.code,
        name: body.name,
        distanceKm: body.distanceKm,
        durationMin: body.durationMin,
        stopsJson: JSON.stringify(body.stops || []),
      },
    });
  }

  @Post('courses/:id/operations')
  @RequirePermission('courses', 'course', 'update')
  addOperation(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      courseId?: string;
      sequence: number;
      kind?: string;
      label: string;
      fromLocationId?: string;
      toLocationId?: string;
      plannedStart?: string;
      plannedEnd?: string;
      distanceKm?: number;
      durationMin?: number;
    },
    @Param('id') id: string,
  ) {
    return this.prisma.course
      .findFirst({ where: { id, companyId: user.companyId } })
      .then((c) => {
        if (!c) throw new Error('Course introuvable');
        return this.prisma.courseOperation.create({
          data: {
            courseId: id,
            sequence: body.sequence,
            kind: body.kind || 'run',
            label: body.label,
            fromLocationId: body.fromLocationId,
            toLocationId: body.toLocationId,
            plannedStart: body.plannedStart,
            plannedEnd: body.plannedEnd,
            distanceKm: body.distanceKm,
            durationMin: body.durationMin,
          },
        });
      });
  }

  @Get('courses/:id/detail')
  @RequirePermission('courses', 'course', 'list')
  courseDetail(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.prisma.course.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        segments: { orderBy: { sequence: 'asc' } },
        operations: { orderBy: { sequence: 'asc' } },
        serviceLinks: { include: { service: true } },
      },
    });
  }
}

@Module({ imports: [AuthModule], controllers: [TransportController] })
export class TransportModule {}
