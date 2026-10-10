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
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard } from '../iam/guards';
import { CurrentUser, RequirePermission } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';
import { AuthModule } from '../iam/auth.module';

class UpsertCustomerDto {
  @IsOptional() @IsString() @MaxLength(40) reference?: string | null;
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(200) tradeName?: string | null;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() siret?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() vatNumber?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() email?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() phone?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() mobile?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() website?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() addressLine1?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() addressLine2?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() postalCode?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() city?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() country?: string | null;
  @IsOptional() @IsBoolean() billingSameAsMain?: boolean;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() billingAddressLine1?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() billingAddressLine2?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() billingPostalCode?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() billingCity?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() billingCountry?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() billingAddress?: string | null;
  @IsOptional() @IsInt() @Min(0) paymentTermsDays?: number;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() paymentMethod?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber() creditLimit?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() currency?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() alertNote?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() notes?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() internalRemarks?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() preferredVehicleNotes?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() preferredDriverNotes?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() accountManagerId?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() apeCode?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() invoiceEmail?: string | null;
  @IsOptional() @IsBoolean() requirePurchaseOrder?: boolean;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber() latePenaltyRate?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber() earlyDiscountRate?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() sepaMandateStatus?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() contractRef?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() contractEndsAt?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() pricingNotes?: string | null;
}

class UpsertContactDto {
  @IsOptional() @IsString() civility?: string | null;
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsOptional() @IsString() email?: string | null;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsString() mobile?: string | null;
  @IsOptional() @IsString() role?: string | null;
  @IsOptional() @IsString() department?: string | null;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsBoolean() isBilling?: boolean;
  @IsOptional() @IsBoolean() isOps?: boolean;
  @IsOptional() @IsString() notes?: string | null;
}

class UpsertBankDto {
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsString() bankName?: string | null;
  @IsOptional() @IsString() iban?: string | null;
  @IsOptional() @IsString() bic?: string | null;
  @IsOptional() @IsString() accountHolder?: string | null;
  @IsOptional() @IsString() rum?: string | null;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsString() notes?: string | null;
}

class UpsertDestinationDto {
  @IsString() label!: string;
  @IsOptional() @IsString() addressLine1?: string | null;
  @IsOptional() @IsString() addressLine2?: string | null;
  @IsOptional() @IsString() postalCode?: string | null;
  @IsOptional() @IsString() city?: string | null;
  @IsOptional() @IsString() country?: string | null;
  @IsOptional() @IsString() contactName?: string | null;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsString() notes?: string | null;
}

class UpsertDocumentDto {
  @IsString() name!: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() fileName?: string | null;
  @IsOptional() @IsString() mimeType?: string | null;
  @IsOptional() @IsString() @MaxLength(2_000_000) fileUrl?: string | null;
  @IsOptional() @IsString() notes?: string | null;
}

class CreateCommentDto {
  @IsString() @MaxLength(4000) body!: string;
}

@Controller('customers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
class CrmController {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCustomer(companyId: string, id: string) {
    const c = await this.prisma.customer.findFirst({
      where: { id, companyId, archivedAt: null },
    });
    if (!c) throw new BadRequestException('Client introuvable');
    return c;
  }

  private customerInclude() {
    return {
      accountManager: {
        select: { id: true, email: true, displayName: true },
      },
      contacts: { orderBy: [{ isPrimary: 'desc' as const }, { lastName: 'asc' as const }] },
      bankAccounts: { orderBy: [{ isDefault: 'desc' as const }, { createdAt: 'asc' as const }] },
      destinations: { orderBy: [{ lastUsedAt: 'desc' as const }, { label: 'asc' as const }] },
      documents: { orderBy: { uploadedAt: 'desc' as const } },
      comments: { orderBy: { createdAt: 'desc' as const }, take: 100 },
      quotes: {
        orderBy: { createdAt: 'desc' as const },
        take: 20,
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          origin: true,
          destination: true,
          amountTtc: true,
          createdAt: true,
        },
      },
      invoices: {
        orderBy: { issuedAt: 'desc' as const },
        take: 20,
        select: {
          id: true,
          number: true,
          status: true,
          amountTtc: true,
          balance: true,
          issuedAt: true,
        },
      },
      _count: {
        select: {
          quotes: true,
          orders: true,
          invoices: true,
          contacts: true,
          destinations: true,
          documents: true,
        },
      },
    };
  }

  private mapCustomerData(dto: UpsertCustomerDto) {
    const { contractEndsAt, ...rest } = dto;
    return {
      ...rest,
      ...(contractEndsAt !== undefined
        ? {
            contractEndsAt: contractEndsAt
              ? new Date(contractEndsAt)
              : null,
          }
        : {}),
    };
  }

  @Get()
  @RequirePermission('customers', 'customer', 'list')
  list(
    @CurrentUser() user: RequestUser,
    @Query('q') q?: string,
  ) {
    const term = q?.trim();
    return this.prisma.customer.findMany({
      where: {
        companyId: user.companyId,
        archivedAt: null,
        ...(term
          ? {
              OR: [
                { name: { contains: term } },
                { tradeName: { contains: term } },
                { reference: { contains: term } },
                { email: { contains: term } },
                { city: { contains: term } },
                { siret: { contains: term } },
              ],
            }
          : {}),
      },
      include: {
        contacts: { where: { isPrimary: true }, take: 1 },
        _count: { select: { quotes: true, orders: true, invoices: true, contacts: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  @Get(':id')
  @RequirePermission('customers', 'customer', 'read')
  async get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, companyId: user.companyId },
      include: this.customerInclude(),
    });
    if (!customer) throw new BadRequestException('Client introuvable');

    // Destinations issues des devis (historique métier)
    const tripDestinations = await this.prisma.quote.findMany({
      where: {
        customerId: id,
        companyId: user.companyId,
        OR: [{ destination: { not: null } }, { origin: { not: null } }],
      },
      select: {
        id: true,
        number: true,
        title: true,
        origin: true,
        destination: true,
        departureAt: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return { ...customer, tripHistory: tripDestinations };
  }

  @Post()
  @RequirePermission('customers', 'customer', 'create')
  async create(@CurrentUser() user: RequestUser, @Body() dto: UpsertCustomerDto) {
    const count = await this.prisma.customer.count({
      where: { companyId: user.companyId },
    });
    const reference =
      dto.reference?.trim() ||
      `CLI-${String(count + 1).padStart(4, '0')}`;

    return this.prisma.customer.create({
      data: {
        companyId: user.companyId,
        ...this.mapCustomerData(dto),
        reference,
        name: dto.name.trim(),
      },
      include: this.customerInclude(),
    });
  }

  @Patch(':id')
  @RequirePermission('customers', 'customer', 'update')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpsertCustomerDto,
  ) {
    await this.assertCustomer(user.companyId, id);
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...this.mapCustomerData(dto),
        ...(dto.name ? { name: dto.name.trim() } : {}),
      },
      include: this.customerInclude(),
    });
  }

  @Delete(':id')
  @RequirePermission('customers', 'customer', 'delete')
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.assertCustomer(user.companyId, id);
    await this.prisma.customer.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    return { ok: true };
  }

  @Post(':id/contacts')
  @RequirePermission('customers', 'customer', 'update')
  async addContact(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpsertContactDto,
  ) {
    await this.assertCustomer(user.companyId, id);
    if (dto.isPrimary) {
      await this.prisma.contact.updateMany({
        where: { customerId: id },
        data: { isPrimary: false },
      });
    }
    return this.prisma.contact.create({ data: { customerId: id, ...dto } });
  }

  @Patch(':id/contacts/:contactId')
  @RequirePermission('customers', 'customer', 'update')
  async updateContact(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpsertContactDto,
  ) {
    await this.assertCustomer(user.companyId, id);
    if (dto.isPrimary) {
      await this.prisma.contact.updateMany({
        where: { customerId: id },
        data: { isPrimary: false },
      });
    }
    return this.prisma.contact.update({
      where: { id: contactId },
      data: dto,
    });
  }

  @Delete(':id/contacts/:contactId')
  @RequirePermission('customers', 'customer', 'update')
  async deleteContact(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('contactId') contactId: string,
  ) {
    await this.assertCustomer(user.companyId, id);
    await this.prisma.contact.deleteMany({ where: { id: contactId, customerId: id } });
    return { ok: true };
  }

  @Post(':id/bank-accounts')
  @RequirePermission('customers', 'customer', 'update')
  async addBank(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpsertBankDto,
  ) {
    await this.assertCustomer(user.companyId, id);
    if (dto.isDefault !== false) {
      await this.prisma.customerBankAccount.updateMany({
        where: { customerId: id },
        data: { isDefault: false },
      });
    }
    return this.prisma.customerBankAccount.create({
      data: { customerId: id, isDefault: true, ...dto },
    });
  }

  @Patch(':id/bank-accounts/:bankId')
  @RequirePermission('customers', 'customer', 'update')
  async updateBank(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('bankId') bankId: string,
    @Body() dto: UpsertBankDto,
  ) {
    await this.assertCustomer(user.companyId, id);
    if (dto.isDefault) {
      await this.prisma.customerBankAccount.updateMany({
        where: { customerId: id },
        data: { isDefault: false },
      });
    }
    return this.prisma.customerBankAccount.update({
      where: { id: bankId },
      data: dto,
    });
  }

  @Delete(':id/bank-accounts/:bankId')
  @RequirePermission('customers', 'customer', 'update')
  async deleteBank(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('bankId') bankId: string,
  ) {
    await this.assertCustomer(user.companyId, id);
    await this.prisma.customerBankAccount.deleteMany({
      where: { id: bankId, customerId: id },
    });
    return { ok: true };
  }

  @Post(':id/destinations')
  @RequirePermission('customers', 'customer', 'update')
  async addDestination(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpsertDestinationDto,
  ) {
    await this.assertCustomer(user.companyId, id);
    return this.prisma.customerDestination.create({
      data: { customerId: id, ...dto },
    });
  }

  @Patch(':id/destinations/:destId')
  @RequirePermission('customers', 'customer', 'update')
  async updateDestination(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('destId') destId: string,
    @Body() dto: UpsertDestinationDto,
  ) {
    await this.assertCustomer(user.companyId, id);
    return this.prisma.customerDestination.update({
      where: { id: destId },
      data: dto,
    });
  }

  @Delete(':id/destinations/:destId')
  @RequirePermission('customers', 'customer', 'update')
  async deleteDestination(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('destId') destId: string,
  ) {
    await this.assertCustomer(user.companyId, id);
    await this.prisma.customerDestination.deleteMany({
      where: { id: destId, customerId: id },
    });
    return { ok: true };
  }

  @Post(':id/documents')
  @RequirePermission('customers', 'customer', 'update')
  async addDocument(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpsertDocumentDto,
  ) {
    await this.assertCustomer(user.companyId, id);
    return this.prisma.customerDocument.create({
      data: { customerId: id, ...dto },
    });
  }

  @Delete(':id/documents/:docId')
  @RequirePermission('customers', 'customer', 'update')
  async deleteDocument(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    await this.assertCustomer(user.companyId, id);
    await this.prisma.customerDocument.deleteMany({
      where: { id: docId, customerId: id },
    });
    return { ok: true };
  }

  @Post(':id/comments')
  @RequirePermission('customers', 'customer', 'update')
  async addComment(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    await this.assertCustomer(user.companyId, id);
    const actor = await this.prisma.userAccount.findUnique({
      where: { id: user.userId },
      select: { displayName: true },
    });
    return this.prisma.customerComment.create({
      data: {
        customerId: id,
        authorId: user.userId,
        authorName: actor?.displayName || user.userId,
        body: dto.body.trim(),
      },
    });
  }

  @Delete(':id/comments/:commentId')
  @RequirePermission('customers', 'customer', 'update')
  async deleteComment(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
  ) {
    await this.assertCustomer(user.companyId, id);
    await this.prisma.customerComment.deleteMany({
      where: { id: commentId, customerId: id },
    });
    return { ok: true };
  }
}

@Module({ imports: [AuthModule], controllers: [CrmController] })
export class CrmModule {}
