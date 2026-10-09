import { Module } from '@nestjs/common';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../iam/guards';
import { CurrentUser } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';

@Controller('org')
@UseGuards(JwtAuthGuard)
class OrgController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('company')
  company(@CurrentUser() user: RequestUser) {
    return this.prisma.company.findUnique({ where: { id: user.companyId } });
  }

  @Get('depots')
  depots(@CurrentUser() user: RequestUser) {
    return this.prisma.depot.findMany({
      where: { companyId: user.companyId },
      orderBy: { name: 'asc' },
    });
  }
}

@Module({ controllers: [OrgController] })
export class OrgModule {}
