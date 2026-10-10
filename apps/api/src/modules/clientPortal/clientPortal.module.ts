import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Module,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsInt, IsOptional, IsString, Min } from 'class-validator';
import type { Response } from 'express';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard } from '../iam/guards';
import { CurrentUser, RequirePermission } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';
import { AuthModule } from '../iam/auth.module';

class PublicRequestDto {
  @IsString() contactName!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() tripType?: string;
  @IsOptional() @IsString() origin?: string;
  @IsOptional() @IsString() destination?: string;
  @IsOptional() @IsString() departureAt?: string;
  @IsOptional() @IsString() returnAt?: string;
  @IsOptional() @IsInt() @Min(1) passengers?: number;
  @IsOptional() @IsString() vehicleHint?: string;
  @IsOptional() @IsString() budgetHint?: string;
  @IsOptional() @IsString() message?: string;
  @IsOptional() @IsString() companySlug?: string;
}

@Controller()
class ClientPortalController {
  constructor(private readonly prisma: PrismaService) {}

  private uploadsDir() {
    const dir = join(process.cwd(), 'uploads', 'client-docs');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  private async customerForUser(user: RequestUser) {
    const link = await this.prisma.clientAccountLink.findUnique({
      where: { userId: user.userId },
      include: {
        customer: {
          include: {
            contacts: { orderBy: [{ isPrimary: 'desc' }, { lastName: 'asc' }] },
            bankAccounts: true,
            destinations: { orderBy: { label: 'asc' } },
          },
        },
      },
    });
    if (!link) return null;
    return { ...link.customer, portalRole: link.portalRole, linkId: link.id };
  }

  private async requireCustomer(user: RequestUser) {
    const c = await this.customerForUser(user);
    if (!c) throw new ForbiddenException('Espace client requis');
    return c;
  }

  /** Demande publique (sans auth) */
  @Post('public/quote-requests')
  async publicRequest(@Body() dto: PublicRequestDto) {
    const company = await this.prisma.company.findFirst({
      where: { isDemo: true },
    });
    if (!company) return { error: 'Société introuvable' };
    const existing = await this.prisma.customer.findFirst({
      where: {
        companyId: company.id,
        OR: [
          { email: dto.email },
          { contacts: { some: { email: dto.email } } },
        ],
      },
    });
    const req = await this.prisma.clientQuoteRequest.create({
      data: {
        companyId: company.id,
        customerId: existing?.id,
        contactName: dto.contactName,
        email: dto.email,
        phone: dto.phone,
        tripType: dto.tripType || 'occasionnel',
        origin: dto.origin,
        destination: dto.destination,
        departureAt: dto.departureAt ? new Date(dto.departureAt) : null,
        returnAt: dto.returnAt ? new Date(dto.returnAt) : null,
        passengers: dto.passengers || 0,
        vehicleHint: dto.vehicleHint,
        budgetHint: dto.budgetHint,
        message: dto.message,
        status: 'new',
      },
    });
    await this.prisma.opsAlert.create({
      data: {
        companyId: company.id,
        severity: 'info',
        title: 'Nouvelle demande portail client',
        body: `${dto.contactName} — ${dto.origin || '?'} → ${dto.destination || '?'}`,
        href: '/app/client-requests',
      },
    });
    return { ok: true, id: req.id };
  }

  @Get('client-requests')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('quotes', 'quote', 'list')
  list(@CurrentUser() user: RequestUser) {
    return this.prisma.clientQuoteRequest.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('client-requests/:id/convert')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('quotes', 'quote', 'create')
  async convert(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    const req = await this.prisma.clientQuoteRequest.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!req) return { error: 'Demande introuvable' };
    let customer = req.customerId
      ? await this.prisma.customer.findFirst({
          where: { id: req.customerId, companyId: user.companyId },
        })
      : null;
    if (!customer) {
      customer = await this.prisma.customer.findFirst({
        where: { companyId: user.companyId, email: req.email },
      });
    }
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          companyId: user.companyId,
          name: req.contactName,
          email: req.email,
          phone: req.phone,
          type: 'particular',
        },
      });
    }
    const count = await this.prisma.quote.count({
      where: { companyId: user.companyId },
    });
    const quote = await this.prisma.quote.create({
      data: {
        companyId: user.companyId,
        customerId: customer.id,
        number: `D-${new Date().getFullYear()}-P${String(count + 1).padStart(3, '0')}`,
        title: `Demande portail ${req.origin || ''} → ${req.destination || ''}`.trim(),
        status: 'sent',
        origin: req.origin,
        destination: req.destination,
        departureAt: req.departureAt,
        returnAt: req.returnAt,
        passengers: req.passengers,
        amountHt: Math.max(req.passengers * 12, 180),
        amountTtc: Math.max(req.passengers * 12, 180) * 1.1,
        availabilityNote: 'Issu du portail client',
        availabilityConfidence: 'low',
        source: 'portal',
      },
    });
    await this.prisma.clientQuoteRequest.update({
      where: { id },
      data: { status: 'converted', customerId: customer.id },
    });
    return { quote, customer };
  }

  /* ───────── Espace client authentifié ───────── */

  @Get('client-portal/me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: RequestUser) {
    const customer = await this.requireCustomer(user);
    const now = new Date();
    const [
      quotesOpen,
      tripsUpcoming,
      invoicesOpen,
      invoicesOverdue,
      requestsOpen,
      messagesOpen,
      docsCount,
    ] = await Promise.all([
      this.prisma.quote.count({
        where: {
          customerId: customer.id,
          status: { in: ['sent', 'draft'] },
        },
      }),
      this.prisma.mission.count({
        where: {
          order: { customerId: customer.id },
          endsAt: { gte: now },
          status: { notIn: ['cancelled'] },
        },
      }),
      this.prisma.invoice.count({
        where: {
          customerId: customer.id,
          status: { in: ['sent', 'partial', 'overdue'] },
        },
      }),
      this.prisma.invoice.count({
        where: {
          customerId: customer.id,
          status: { in: ['sent', 'partial', 'overdue'] },
          dueAt: { lt: now },
          paidAt: null,
        },
      }),
      this.prisma.clientQuoteRequest.count({
        where: {
          OR: [{ customerId: customer.id }, { email: customer.email || '' }],
          status: { in: ['new', 'in_progress'] },
        },
      }),
      this.prisma.clientPortalMessage.count({
        where: {
          customerId: customer.id,
          status: 'open',
          authorKind: 'staff',
          readAt: null,
        },
      }),
      this.prisma.customerDocument.count({
        where: { customerId: customer.id },
      }),
    ]);

    const nextTrip = await this.prisma.mission.findFirst({
      where: {
        order: { customerId: customer.id },
        endsAt: { gte: now },
        status: { notIn: ['cancelled'] },
      },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true,
        number: true,
        title: true,
        startsAt: true,
        endsAt: true,
        origin: true,
        destination: true,
        passengers: true,
        status: true,
      },
    });

    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId },
      select: {
        name: true,
        tradeName: true,
        logoUrl: true,
      },
    });

    return {
      user: {
        id: user.userId,
        email: user.email,
        displayName: user.displayName,
      },
      company: {
        name: company?.name || '',
        tradeName: company?.tradeName || null,
        logoUrl: company?.logoUrl || null,
      },
      customer: {
        id: customer.id,
        name: customer.name,
        tradeName: customer.tradeName,
        reference: customer.reference,
        type: customer.type,
        email: customer.email,
        phone: customer.phone,
        mobile: customer.mobile,
        addressLine1: customer.addressLine1,
        addressLine2: customer.addressLine2,
        postalCode: customer.postalCode,
        city: customer.city,
        country: customer.country,
        siret: customer.siret,
        vatNumber: customer.vatNumber,
        paymentTermsDays: customer.paymentTermsDays,
        paymentMethod: customer.paymentMethod,
        invoiceEmail: customer.invoiceEmail,
        portalRole: customer.portalRole,
      },
      contacts: customer.contacts,
      counts: {
        quotesOpen,
        tripsUpcoming,
        invoicesOpen,
        invoicesOverdue,
        requestsOpen,
        messagesOpen,
        docsCount,
      },
      nextTrip,
    };
  }

  @Get('client-portal/profile')
  @UseGuards(JwtAuthGuard)
  async profile(@CurrentUser() user: RequestUser) {
    const customer = await this.requireCustomer(user);
    return {
      customer,
      contacts: customer.contacts,
      bankAccounts: customer.bankAccounts.map((b) => ({
        ...b,
        iban: b.iban
          ? `${b.iban.slice(0, 4)} •••• ${b.iban.slice(-4)}`
          : null,
      })),
      destinations: customer.destinations,
    };
  }

  @Patch('client-portal/profile')
  @UseGuards(JwtAuthGuard)
  async patchProfile(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      phone?: string;
      mobile?: string;
      email?: string;
      invoiceEmail?: string;
      addressLine1?: string;
      addressLine2?: string;
      postalCode?: string;
      city?: string;
      website?: string;
    },
  ) {
    const customer = await this.requireCustomer(user);
    return this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.mobile !== undefined ? { mobile: body.mobile } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.invoiceEmail !== undefined
          ? { invoiceEmail: body.invoiceEmail }
          : {}),
        ...(body.addressLine1 !== undefined
          ? { addressLine1: body.addressLine1 }
          : {}),
        ...(body.addressLine2 !== undefined
          ? { addressLine2: body.addressLine2 }
          : {}),
        ...(body.postalCode !== undefined
          ? { postalCode: body.postalCode }
          : {}),
        ...(body.city !== undefined ? { city: body.city } : {}),
        ...(body.website !== undefined ? { website: body.website } : {}),
      },
    });
  }

  @Get('client-portal/quotes')
  @UseGuards(JwtAuthGuard)
  async quotes(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
  ) {
    const customer = await this.requireCustomer(user);
    return this.prisma.quote.findMany({
      where: {
        customerId: customer.id,
        status: status || { notIn: ['trashed', 'draft'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        origin: true,
        destination: true,
        departureAt: true,
        returnAt: true,
        passengers: true,
        amountHt: true,
        amountTtc: true,
        vatRate: true,
        validUntil: true,
        proposedAt: true,
        acceptedAt: true,
        createdAt: true,
        caseType: true,
      },
    });
  }

  @Get('client-portal/quotes/:id')
  @UseGuards(JwtAuthGuard)
  async quoteDetail(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    const customer = await this.requireCustomer(user);
    const quote = await this.prisma.quote.findFirst({
      where: { id, customerId: customer.id },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        salesperson: { select: { displayName: true, email: true } },
      },
    });
    if (!quote) throw new BadRequestException('Devis introuvable');
    return quote;
  }

  @Post('client-portal/quotes/:id/accept')
  @UseGuards(JwtAuthGuard)
  async acceptQuote(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    const customer = await this.requireCustomer(user);
    const quote = await this.prisma.quote.findFirst({
      where: {
        id,
        customerId: customer.id,
        status: 'sent',
      },
    });
    if (!quote) throw new BadRequestException('Devis non acceptable');
    const updated = await this.prisma.quote.update({
      where: { id },
      data: { status: 'accepted', acceptedAt: new Date() },
    });
    await this.prisma.opsAlert.create({
      data: {
        companyId: user.companyId,
        severity: 'info',
        title: `Devis accepté — ${quote.number}`,
        body: customer.name,
        href: `/app/quotes/${quote.id}`,
      },
    });
    return updated;
  }

  @Post('client-portal/quotes/:id/refuse')
  @UseGuards(JwtAuthGuard)
  async refuseQuote(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const customer = await this.requireCustomer(user);
    const quote = await this.prisma.quote.findFirst({
      where: {
        id,
        customerId: customer.id,
        status: 'sent',
      },
    });
    if (!quote) throw new BadRequestException('Devis non refusable');
    const updated = await this.prisma.quote.update({
      where: { id },
      data: {
        status: 'refused',
        refusedReason: body.reason || 'Refusé via portail client',
      },
    });
    await this.prisma.opsAlert.create({
      data: {
        companyId: user.companyId,
        severity: 'warning',
        title: `Devis refusé — ${quote.number}`,
        body: body.reason || customer.name,
        href: `/app/quotes/${quote.id}`,
      },
    });
    return updated;
  }

  @Get('client-portal/trips')
  @UseGuards(JwtAuthGuard)
  async trips(
    @CurrentUser() user: RequestUser,
    @Query('scope') scope?: string,
  ) {
    const customer = await this.requireCustomer(user);
    const now = new Date();
    const where =
      scope === 'past'
        ? {
            order: { customerId: customer.id },
            endsAt: { lt: now },
          }
        : scope === 'all'
          ? { order: { customerId: customer.id } }
          : {
              order: { customerId: customer.id },
              endsAt: { gte: now },
              status: { notIn: ['cancelled'] },
            };

    return this.prisma.mission.findMany({
      where,
      orderBy: { startsAt: scope === 'past' ? 'desc' : 'asc' },
      take: 80,
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        startsAt: true,
        endsAt: true,
        origin: true,
        destination: true,
        passengers: true,
        clientBrief: true,
        order: {
          select: {
            id: true,
            number: true,
            title: true,
            customerPoNumber: true,
          },
        },
      },
    });
  }

  @Get('client-portal/invoices')
  @UseGuards(JwtAuthGuard)
  async invoices(@CurrentUser() user: RequestUser) {
    const customer = await this.requireCustomer(user);
    const [rows, payments, credits] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          customerId: customer.id,
          status: { notIn: ['draft', 'void'] },
        },
        orderBy: { issuedAt: 'desc' },
        take: 100,
        select: {
          id: true,
          number: true,
          kind: true,
          status: true,
          amountHt: true,
          amountTtc: true,
          balance: true,
          vatRate: true,
          dueAt: true,
          issuedAt: true,
          paidAt: true,
          customerPoNumber: true,
          serviceFrom: true,
          serviceTo: true,
          reference: true,
        },
      }),
      this.prisma.payment.findMany({
        where: { customerId: customer.id },
        orderBy: { paidAt: 'desc' },
        take: 40,
      }),
      this.prisma.customerCredit.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    const openBalance = rows
      .filter((i) => !i.paidAt && i.status !== 'cancelled')
      .reduce((s, i) => s + (i.balance || i.amountTtc || 0), 0);
    return { invoices: rows, payments, credits, openBalance };
  }

  @Get('client-portal/documents')
  @UseGuards(JwtAuthGuard)
  async documents(@CurrentUser() user: RequestUser) {
    const customer = await this.requireCustomer(user);
    return this.prisma.customerDocument.findMany({
      where: { customerId: customer.id },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  @Post('client-portal/documents')
  @UseGuards(JwtAuthGuard)
  async uploadDocument(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      name: string;
      category?: string;
      fileName?: string;
      mimeType?: string;
      /** base64 (sans préfixe data:) ou data-URL */
      contentBase64?: string;
      notes?: string;
    },
  ) {
    const customer = await this.requireCustomer(user);
    if (!body.name?.trim()) throw new BadRequestException('Nom requis');
    let fileUrl: string | undefined;
    let fileName = body.fileName || body.name;
    if (body.contentBase64) {
      const raw = body.contentBase64.includes(',')
        ? body.contentBase64.split(',')[1]
        : body.contentBase64;
      const buf = Buffer.from(raw, 'base64');
      if (buf.length > 8 * 1024 * 1024) {
        throw new BadRequestException('Fichier trop volumineux (max 8 Mo)');
      }
      const safe = `${customer.id}-${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const path = join(this.uploadsDir(), safe);
      writeFileSync(path, buf);
      fileUrl = `file://${safe}`;
    }
    return this.prisma.customerDocument.create({
      data: {
        customerId: customer.id,
        name: body.name.trim(),
        category: body.category || 'client_upload',
        fileName,
        mimeType: body.mimeType,
        fileUrl,
        notes: body.notes,
      },
    });
  }

  @Get('client-portal/documents/:id/download')
  @UseGuards(JwtAuthGuard)
  async downloadDocument(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const customer = await this.requireCustomer(user);
    const doc = await this.prisma.customerDocument.findFirst({
      where: { id, customerId: customer.id },
    });
    if (!doc?.fileUrl?.startsWith('file://')) {
      throw new BadRequestException('Document non téléchargeable');
    }
    const path = join(this.uploadsDir(), doc.fileUrl.replace('file://', ''));
    if (!existsSync(path)) throw new BadRequestException('Fichier introuvable');
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${doc.fileName || doc.name}"`,
    );
    res.send(readFileSync(path));
  }

  @Get('client-portal/requests')
  @UseGuards(JwtAuthGuard)
  async myRequests(@CurrentUser() user: RequestUser) {
    const customer = await this.requireCustomer(user);
    return this.prisma.clientQuoteRequest.findMany({
      where: {
        companyId: user.companyId,
        OR: [
          { customerId: customer.id },
          ...(customer.email ? [{ email: customer.email }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  @Post('client-portal/requests')
  @UseGuards(JwtAuthGuard)
  async createRequest(
    @CurrentUser() user: RequestUser,
    @Body() dto: PublicRequestDto,
  ) {
    const customer = await this.requireCustomer(user);
    const req = await this.prisma.clientQuoteRequest.create({
      data: {
        companyId: user.companyId,
        customerId: customer.id,
        contactName: dto.contactName || user.displayName,
        email: dto.email || customer.email || user.email,
        phone: dto.phone || customer.phone || undefined,
        tripType: dto.tripType || 'occasionnel',
        origin: dto.origin,
        destination: dto.destination,
        departureAt: dto.departureAt ? new Date(dto.departureAt) : null,
        returnAt: dto.returnAt ? new Date(dto.returnAt) : null,
        passengers: dto.passengers || 0,
        vehicleHint: dto.vehicleHint,
        budgetHint: dto.budgetHint,
        message: dto.message,
        status: 'new',
      },
    });
    await this.prisma.opsAlert.create({
      data: {
        companyId: user.companyId,
        severity: 'info',
        title: `Demande client — ${customer.name}`,
        body: `${dto.origin || '?'} → ${dto.destination || '?'}`,
        href: '/app/client-requests',
      },
    });
    return req;
  }

  @Get('client-portal/messages')
  @UseGuards(JwtAuthGuard)
  async messages(@CurrentUser() user: RequestUser) {
    const customer = await this.requireCustomer(user);
    const rows = await this.prisma.clientPortalMessage.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        author: { select: { displayName: true, email: true } },
      },
    });
    await this.prisma.clientPortalMessage.updateMany({
      where: {
        customerId: customer.id,
        authorKind: 'staff',
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return rows;
  }

  @Post('client-portal/messages')
  @UseGuards(JwtAuthGuard)
  async sendMessage(
    @CurrentUser() user: RequestUser,
    @Body() body: { subject?: string; body: string },
  ) {
    const customer = await this.requireCustomer(user);
    if (!body.body?.trim()) throw new BadRequestException('Message vide');
    const msg = await this.prisma.clientPortalMessage.create({
      data: {
        companyId: user.companyId,
        customerId: customer.id,
        authorId: user.userId,
        authorKind: 'client',
        subject: body.subject || 'Message portail',
        body: body.body.trim(),
        status: 'open',
      },
    });
    await this.prisma.opsAlert.create({
      data: {
        companyId: user.companyId,
        severity: 'warning',
        title: `Message client — ${customer.name}`,
        body: body.body.slice(0, 160),
        href: `/app/customers/${customer.id}`,
      },
    });
    return msg;
  }

  @Get('client-portal/destinations')
  @UseGuards(JwtAuthGuard)
  async destinations(@CurrentUser() user: RequestUser) {
    const customer = await this.requireCustomer(user);
    return customer.destinations;
  }

  @Post('client-portal/destinations')
  @UseGuards(JwtAuthGuard)
  async addDestination(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      label: string;
      addressLine1?: string;
      postalCode?: string;
      city?: string;
      contactName?: string;
      phone?: string;
      notes?: string;
    },
  ) {
    const customer = await this.requireCustomer(user);
    if (!body.label?.trim()) throw new BadRequestException('Libellé requis');
    return this.prisma.customerDestination.create({
      data: {
        customerId: customer.id,
        label: body.label.trim(),
        addressLine1: body.addressLine1,
        postalCode: body.postalCode,
        city: body.city,
        contactName: body.contactName,
        phone: body.phone,
        notes: body.notes,
      },
    });
  }
}

@Module({ imports: [AuthModule], controllers: [ClientPortalController] })
export class ClientPortalModule {}
