import { Body, Controller, Get, Param, Patch, Post, UseGuards, Module } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard } from '../iam/guards';
import { CurrentUser, RequirePermission } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';
import { AuthModule } from '../iam/auth.module';

class CreateCustomerDto {
  @IsString() name!: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() siret?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() billingAddress?: string;
  @IsOptional() @IsString() preferredVehicleNotes?: string;
  @IsOptional() @IsString() preferredDriverNotes?: string;
  @IsOptional() @IsInt() @Min(0) paymentTermsDays?: number;
}

class CreateContactDto {
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() isBilling?: boolean;
  @IsOptional() isOps?: boolean;
}

@Controller('customers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
class CrmController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('customers', 'customer', 'list')
  list(@CurrentUser() user: RequestUser) {
    return this.prisma.customer.findMany({
      where: { companyId: user.companyId },
      include: { contacts: true, _count: { select: { quotes: true, orders: true } } },
      orderBy: { name: 'asc' },
    });
  }

  @Get(':id')
  @RequirePermission('customers', 'customer', 'read')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.prisma.customer.findFirst({
      where: { id, companyId: user.companyId },
      include: { contacts: true, quotes: true, orders: true },
    });
  }

  @Post()
  @RequirePermission('customers', 'customer', 'create')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: { companyId: user.companyId, ...dto },
    });
  }

  @Patch(':id')
  @RequirePermission('customers', 'customer', 'update')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.prisma.customer.updateMany({
      where: { id, companyId: user.companyId },
      data: dto,
    }).then(() => this.prisma.customer.findUnique({ where: { id } }));
  }

  @Post(':id/contacts')
  @RequirePermission('customers', 'customer', 'update')
  addContact(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CreateContactDto,
  ) {
    return this.prisma.contact.create({
      data: { customerId: id, ...dto },
    });
  }
}

@Module({ imports: [AuthModule], controllers: [CrmController] })
export class CrmModule {}
