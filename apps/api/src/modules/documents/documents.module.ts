import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  Module,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard } from '../iam/guards';
import { CurrentUser, RequirePermission } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';
import { AuthModule } from '../iam/auth.module';
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_KINDS,
  type TemplateKind,
} from './template-catalog';
import {
  escapeHtml,
  frToday,
  renderTemplate,
  wrapPrintDocument,
} from './template-engine';

class TemplateDto {
  @IsOptional() @IsString() kind?: string;
  @IsOptional() @IsString() key?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() bodyHtml?: string;
  @IsOptional() @IsString() headerHtml?: string | null;
  @IsOptional() @IsString() footerHtml?: string | null;
  @IsOptional() @IsString() layoutJson?: string | null;
  @IsOptional() @IsString() stylesCss?: string | null;
  @IsOptional() @IsString() paperSize?: string;
  @IsOptional() @IsString() orientation?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
}

function customerAddress(c: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  billingAddress?: string | null;
}) {
  const parts = [
    c.addressLine1,
    c.addressLine2,
    [c.postalCode, c.city].filter(Boolean).join(' '),
    c.country,
  ].filter(Boolean);
  return parts.join('<br/>') || c.billingAddress || '';
}

@Controller('document-templates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
class DocumentTemplatesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('catalog')
  @RequirePermission('documents', 'template', 'list')
  catalog() {
    return { kinds: TEMPLATE_KINDS, defaults: DEFAULT_TEMPLATES };
  }

  @Get()
  @RequirePermission('documents', 'template', 'list')
  async list(
    @CurrentUser() user: RequestUser,
    @Query('kind') kind?: string,
  ) {
    await this.ensureDefaults(user.companyId);
    return this.prisma.documentTemplate.findMany({
      where: {
        companyId: user.companyId,
        ...(kind ? { kind } : {}),
      },
      orderBy: [{ kind: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  @Post('preview')
  @RequirePermission('documents', 'template', 'list')
  preview(
    @Body()
    body: {
      bodyHtml: string;
      headerHtml?: string;
      footerHtml?: string;
      stylesCss?: string;
      paperSize?: string;
      orientation?: string;
      kind?: string;
      sampleData?: Record<string, unknown>;
    },
  ) {
    const kind = (body.kind || 'quote') as TemplateKind;
    const data = body.sampleData || sampleDataFor(kind);
    const rendered = wrapPrintDocument({
      title: `Aperçu — ${kind}`,
      bodyHtml: renderTemplate(body.bodyHtml || '', data),
      headerHtml: body.headerHtml
        ? renderTemplate(body.headerHtml, data)
        : null,
      footerHtml: body.footerHtml
        ? renderTemplate(body.footerHtml, data)
        : null,
      stylesCss: body.stylesCss,
      paperSize: body.paperSize,
      orientation: body.orientation,
    });
    return { html: rendered, data };
  }

  @Get(':id')
  @RequirePermission('documents', 'template', 'list')
  async get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const t = await this.prisma.documentTemplate.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!t) throw new NotFoundException('Modèle introuvable');
    return t;
  }

  @Post()
  @RequirePermission('documents', 'template', 'manage')
  async create(@CurrentUser() user: RequestUser, @Body() dto: TemplateDto) {
    if (!dto.kind || !dto.name || !dto.bodyHtml) {
      throw new BadRequestException('kind, name et bodyHtml requis');
    }
    const key =
      dto.key ||
      `${dto.kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    if (dto.isDefault) {
      await this.prisma.documentTemplate.updateMany({
        where: { companyId: user.companyId, kind: dto.kind },
        data: { isDefault: false },
      });
    }
    return this.prisma.documentTemplate.create({
      data: {
        companyId: user.companyId,
        kind: dto.kind,
        key,
        name: dto.name,
        description: dto.description,
        bodyHtml: dto.bodyHtml,
        headerHtml: dto.headerHtml,
        footerHtml: dto.footerHtml,
        layoutJson: dto.layoutJson,
        stylesCss: dto.stylesCss,
        paperSize: dto.paperSize || 'A4',
        orientation: dto.orientation || 'portrait',
        isDefault: !!dto.isDefault,
        active: dto.active !== false,
      },
    });
  }

  @Patch(':id')
  @RequirePermission('documents', 'template', 'manage')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: TemplateDto,
  ) {
    const existing = await this.prisma.documentTemplate.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!existing) throw new NotFoundException('Modèle introuvable');
    if (dto.isDefault) {
      await this.prisma.documentTemplate.updateMany({
        where: {
          companyId: user.companyId,
          kind: existing.kind,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }
    return this.prisma.documentTemplate.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.bodyHtml != null ? { bodyHtml: dto.bodyHtml } : {}),
        ...(dto.headerHtml !== undefined
          ? { headerHtml: dto.headerHtml }
          : {}),
        ...(dto.footerHtml !== undefined
          ? { footerHtml: dto.footerHtml }
          : {}),
        ...(dto.layoutJson !== undefined
          ? { layoutJson: dto.layoutJson }
          : {}),
        ...(dto.stylesCss !== undefined ? { stylesCss: dto.stylesCss } : {}),
        ...(dto.paperSize != null ? { paperSize: dto.paperSize } : {}),
        ...(dto.orientation != null ? { orientation: dto.orientation } : {}),
        ...(dto.isDefault != null ? { isDefault: dto.isDefault } : {}),
        ...(dto.active != null ? { active: dto.active } : {}),
        version: { increment: 1 },
      },
    });
  }

  @Post(':id/duplicate')
  @RequirePermission('documents', 'template', 'manage')
  async duplicate(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    const t = await this.prisma.documentTemplate.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!t) throw new NotFoundException('Modèle introuvable');
    return this.prisma.documentTemplate.create({
      data: {
        companyId: user.companyId,
        kind: t.kind,
        key: `${t.key}_copy_${Date.now().toString(36)}`,
        name: `${t.name} (copie)`,
        description: t.description,
        bodyHtml: t.bodyHtml,
        headerHtml: t.headerHtml,
        footerHtml: t.footerHtml,
        layoutJson: t.layoutJson,
        stylesCss: t.stylesCss,
        paperSize: t.paperSize,
        orientation: t.orientation,
        isDefault: false,
        isSystem: false,
        active: true,
      },
    });
  }

  @Post(':id/reset')
  @RequirePermission('documents', 'template', 'manage')
  async reset(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const t = await this.prisma.documentTemplate.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!t) throw new NotFoundException('Modèle introuvable');
    const def = DEFAULT_TEMPLATES.find(
      (d) => d.kind === t.kind && (t.isSystem || d.key === `${t.kind}_default`),
    ) || DEFAULT_TEMPLATES.find((d) => d.kind === t.kind);
    if (!def) throw new BadRequestException('Aucun modèle système pour ce type');
    return this.prisma.documentTemplate.update({
      where: { id },
      data: {
        bodyHtml: def.bodyHtml,
        headerHtml: def.headerHtml || null,
        footerHtml: def.footerHtml || null,
        stylesCss: def.stylesCss || null,
        version: { increment: 1 },
      },
    });
  }

  @Delete(':id')
  @RequirePermission('documents', 'template', 'manage')
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const t = await this.prisma.documentTemplate.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!t) throw new NotFoundException('Modèle introuvable');
    if (t.isSystem && t.isDefault) {
      throw new BadRequestException(
        'Impossible de supprimer le modèle système par défaut',
      );
    }
    await this.prisma.documentTemplate.delete({ where: { id } });
    return { ok: true };
  }

  async ensureDefaults(companyId: string) {
    const count = await this.prisma.documentTemplate.count({
      where: { companyId },
    });
    if (count > 0) return;
    for (const def of DEFAULT_TEMPLATES) {
      await this.prisma.documentTemplate.create({
        data: {
          companyId,
          kind: def.kind,
          key: def.key,
          name: def.name,
          description: def.description,
          bodyHtml: def.bodyHtml,
          headerHtml: def.headerHtml || null,
          footerHtml: def.footerHtml || null,
          stylesCss: def.stylesCss || null,
          isDefault: true,
          isSystem: true,
          active: true,
        },
      });
    }
  }
}

@Controller('documents')
@UseGuards(JwtAuthGuard, PermissionsGuard)
class DocumentsController {
  constructor(private readonly prisma: PrismaService) {}

  private async getTemplate(
    companyId: string,
    kind: string,
    templateId?: string,
  ) {
    if (templateId) {
      const t = await this.prisma.documentTemplate.findFirst({
        where: { id: templateId, companyId, active: true },
      });
      if (t) return t;
    }
    const preferred = await this.prisma.documentTemplate.findFirst({
      where: { companyId, kind, active: true, isDefault: true },
    });
    if (preferred) return preferred;
    const any = await this.prisma.documentTemplate.findFirst({
      where: { companyId, kind, active: true },
    });
    if (any) return any;

    // bootstrap defaults then retry
    const templatesCtrl = new DocumentTemplatesController(this.prisma);
    await templatesCtrl.ensureDefaults(companyId);
    return this.prisma.documentTemplate.findFirst({
      where: { companyId, kind, active: true, isDefault: true },
    });
  }

  @Get('print/quote/:id')
  @RequirePermission('quotes', 'quote', 'read')
  async printQuote(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Query('templateId') templateId: string | undefined,
    @Res() res: Response,
  ) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        customer: true,
        contact: true,
        salesperson: true,
        vehicleCategory: true,
      },
    });
    if (!quote) throw new NotFoundException('Devis introuvable');
    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId },
    });
    const template = await this.getTemplate(
      user.companyId,
      'quote',
      templateId,
    );
    if (!template) throw new BadRequestException('Aucun modèle de devis');

    const data = {
      today: frToday(),
      company: {
        name: company?.name,
        tradeName: company?.tradeName || company?.brandName || company?.name,
        siret: company?.siret,
        vatNumber: company?.vatNumber,
        logoUrl: company?.logoUrl,
      },
      quote: {
        number: quote.number,
        title: quote.title,
        description: quote.description || '',
        status: quote.status,
        origin: quote.origin || '',
        originAddress: quote.originAddress || '',
        destination: quote.destination || '',
        destinationAddress: quote.destinationAddress || '',
        departureAt: quote.departureAt,
        returnAt: quote.returnAt,
        garageDepartureAt: quote.garageDepartureAt,
        presentationAt: quote.presentationAt,
        onSiteAt: quote.onSiteAt,
        returnDepartureAt: quote.returnDepartureAt,
        returnGarageAt: quote.returnGarageAt,
        vehicleCount: quote.vehicleCount,
        vehicleCategory: quote.vehicleCategory?.name || '',
        passengers: quote.passengers,
        amountHt: quote.amountHt,
        proposedPriceHt: quote.proposedPriceHt,
        vatRate: quote.vatRate,
        amountTtc: quote.amountTtc,
        proposedAt: quote.proposedAt,
        validUntil: quote.validUntil,
        dayDetails: quote.dayDetails || '',
      },
      customer: {
        name: quote.customer.name,
        email: quote.customer.email || '',
        phone: quote.customer.phone || '',
        address: customerAddress(quote.customer),
      },
      contact: {
        name: quote.contact
          ? `${quote.contact.firstName} ${quote.contact.lastName}`
          : '',
        email: quote.contact?.email || '',
      },
      salesperson: {
        name: quote.salesperson?.displayName || '',
        email: quote.salesperson?.email || '',
      },
    };

    const html = wrapPrintDocument({
      title: `Devis ${quote.number}`,
      bodyHtml: renderTemplate(template.bodyHtml, data),
      headerHtml: template.headerHtml
        ? renderTemplate(template.headerHtml, data)
        : null,
      footerHtml: template.footerHtml
        ? renderTemplate(template.footerHtml, data)
        : null,
      stylesCss: template.stylesCss,
      paperSize: template.paperSize,
      orientation: template.orientation,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get('print/invoice/:id')
  @RequirePermission('billing', 'invoice', 'list')
  async printInvoice(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Query('templateId') templateId: string | undefined,
    @Res() res: Response,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId: user.companyId },
      include: { customer: true, lines: true },
    });
    if (!invoice) throw new NotFoundException('Facture introuvable');
    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId },
    });
    const template = await this.getTemplate(
      user.companyId,
      'invoice',
      templateId,
    );
    if (!template) throw new BadRequestException('Aucun modèle de facture');

    const linesHtml = `<table><thead><tr><th>Libellé</th><th>Qté</th><th>P.U. HT</th><th>Total HT</th></tr></thead><tbody>${invoice.lines
      .map(
        (l) =>
          `<tr><td>${escapeHtml(l.label)}</td><td>${l.quantity}</td><td>${l.unitPriceHt.toFixed(2)} €</td><td>${l.amountHt.toFixed(2)} €</td></tr>`,
      )
      .join('')}</tbody></table>`;

    const data = {
      today: frToday(),
      company: {
        name: company?.name,
        siret: company?.siret,
        vatNumber: company?.vatNumber,
      },
      invoice: {
        number: invoice.number,
        status: invoice.status,
        amountHt: invoice.amountHt,
        vatRate: invoice.vatRate,
        amountTtc: invoice.amountTtc,
        balance: invoice.balance,
        issuedAt: invoice.issuedAt,
        notes: invoice.notes || '',
        linesHtml,
      },
      customer: {
        name: invoice.customer.name,
        address: customerAddress(invoice.customer),
      },
    };

    const html = wrapPrintDocument({
      title: `Facture ${invoice.number}`,
      bodyHtml: renderTemplate(template.bodyHtml, data),
      headerHtml: template.headerHtml
        ? renderTemplate(template.headerHtml, data)
        : null,
      footerHtml: template.footerHtml
        ? renderTemplate(template.footerHtml, data)
        : null,
      stylesCss: template.stylesCss,
      paperSize: template.paperSize,
      orientation: template.orientation,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get('print/mission/:id/ticket')
  @RequirePermission('missions', 'mission', 'read')
  async printTicket(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Query('templateId') templateId: string | undefined,
    @Res() res: Response,
  ) {
    const mission = await this.prisma.mission.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        order: { include: { customer: true } },
        assignments: {
          include: {
            driver: { include: { employee: true } },
            vehicle: true,
          },
        },
      },
    });
    if (!mission) throw new NotFoundException('Mission introuvable');
    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId },
    });
    const template = await this.getTemplate(
      user.companyId,
      'collective_ticket',
      templateId,
    );
    if (!template) throw new BadRequestException('Aucun modèle de billet');

    const assignment = mission.assignments[0];
    const data = {
      today: frToday(),
      company: { name: company?.name, siret: company?.siret },
      mission: {
        number: mission.number,
        title: mission.title,
        origin: mission.origin || '',
        destination: mission.destination || '',
        startsAt: mission.startsAt,
        endsAt: mission.endsAt,
        passengers: mission.passengers,
      },
      customer: { name: mission.order.customer.name },
      driver: {
        name: assignment?.driver
          ? `${assignment.driver.employee.firstName} ${assignment.driver.employee.lastName}`
          : 'Non affecté',
      },
      vehicle: {
        plate: assignment?.vehicle?.plate || '—',
        fleetNumber: assignment?.vehicle?.fleetNumber || '—',
      },
    };

    const html = wrapPrintDocument({
      title: `Billet ${mission.number}`,
      bodyHtml: renderTemplate(template.bodyHtml, data),
      headerHtml: template.headerHtml
        ? renderTemplate(template.headerHtml, data)
        : null,
      footerHtml: template.footerHtml
        ? renderTemplate(template.footerHtml, data)
        : null,
      stylesCss: template.stylesCss,
      paperSize: template.paperSize,
      orientation: template.orientation,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get('print/planning')
  @RequirePermission('planning', 'assignment', 'list')
  async printPlanning(
    @CurrentUser() user: RequestUser,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('templateId') templateId: string | undefined,
    @Res() res: Response,
  ) {
    const start = from ? new Date(from) : new Date();
    start.setHours(0, 0, 0, 0);
    const end = to ? new Date(to) : new Date(start);
    end.setHours(23, 59, 59, 999);

    const assignments = await this.prisma.assignment.findMany({
      where: {
        companyId: user.companyId,
        startsAt: { lt: end },
        endsAt: { gt: start },
      },
      include: {
        mission: { include: { order: { include: { customer: true } } } },
        driver: { include: { employee: true } },
        vehicle: true,
      },
      orderBy: { startsAt: 'asc' },
    });

    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId },
    });
    const template = await this.getTemplate(
      user.companyId,
      'planning',
      templateId,
    );
    if (!template) throw new BadRequestException('Aucun modèle de planning');

    const rowsHtml = `<table><thead><tr><th>Heure</th><th>Mission</th><th>Client</th><th>Conducteur</th><th>Véhicule</th></tr></thead><tbody>${assignments
      .map((a) => {
        const drv = a.driver
          ? `${a.driver.employee.firstName} ${a.driver.employee.lastName}`
          : '—';
        return `<tr>
          <td>${a.startsAt.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</td>
          <td>${escapeHtml(a.mission.number)} — ${escapeHtml(a.mission.title)}</td>
          <td>${escapeHtml(a.mission.order.customer.name)}</td>
          <td>${escapeHtml(drv)}</td>
          <td>${escapeHtml(a.vehicle?.fleetNumber || '—')} ${escapeHtml(a.vehicle?.plate || '')}</td>
        </tr>`;
      })
      .join('')}</tbody></table>`;

    const data = {
      today: frToday(),
      company: { name: company?.name },
      planning: {
        title: 'Planning exploitation',
        period: `${start.toLocaleDateString('fr-FR')} → ${end.toLocaleDateString('fr-FR')}`,
        rowsHtml,
      },
    };

    const html = wrapPrintDocument({
      title: 'Planning',
      bodyHtml: renderTemplate(template.bodyHtml, data),
      headerHtml: template.headerHtml
        ? renderTemplate(template.headerHtml, data)
        : null,
      footerHtml: template.footerHtml
        ? renderTemplate(template.footerHtml, data)
        : null,
      stylesCss: template.stylesCss,
      paperSize: template.paperSize,
      orientation: template.orientation,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Post('missions/:missionId/collective-ticket')
  @RequirePermission('missions', 'mission', 'generate_pdf')
  async generateTicket(
    @CurrentUser() user: RequestUser,
    @Param('missionId') missionId: string,
  ) {
    const mission = await this.prisma.mission.findFirst({
      where: { id: missionId, companyId: user.companyId },
      include: {
        order: { include: { customer: true } },
        assignments: {
          include: {
            driver: { include: { employee: true } },
            vehicle: true,
          },
        },
      },
    });
    if (!mission) throw new BadRequestException('Mission introuvable');

    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId },
    });
    const dir = join(process.cwd(), 'generated-pdfs');
    mkdirSync(dir, { recursive: true });
    const fileName = `billet-${mission.number}.pdf`;
    const storagePath = join(dir, fileName);

    const assignment = mission.assignments[0];
    const snapshot = {
      societe: company?.name,
      client: mission.order.customer.name,
      mission: mission.number,
      titre: mission.title,
      depart: mission.startsAt.toISOString(),
      arrivee: mission.endsAt.toISOString(),
      origin: mission.origin,
      destination: mission.destination,
      voyageurs: mission.passengers,
      conducteur: assignment?.driver
        ? `${assignment.driver.employee.firstName} ${assignment.driver.employee.lastName}`
        : 'Non affecté',
      vehicule: assignment?.vehicle?.plate || 'Non affecté',
      templateVersion: 1,
    };

    await renderCollectiveTicketPdf(storagePath, snapshot);

    const doc = await this.prisma.generatedDocument.create({
      data: {
        companyId: user.companyId,
        missionId: mission.id,
        kind: 'collective_ticket',
        templateKey: 'billet_collectif',
        templateVersion: 1,
        fileName,
        storagePath,
        snapshotJson: JSON.stringify(snapshot),
      },
    });

    return doc;
  }

  @Get(':id/download')
  @RequirePermission('documents', 'document', 'download')
  async download(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const doc = await this.prisma.generatedDocument.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!doc || !existsSync(doc.storagePath)) {
      throw new NotFoundException('Document introuvable');
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${doc.fileName}"`,
    );
    res.send(readFileSync(doc.storagePath));
  }

  @Get()
  @RequirePermission('documents', 'document', 'list')
  list(@CurrentUser() user: RequestUser) {
    return this.prisma.generatedDocument.findMany({
      where: { companyId: user.companyId },
      orderBy: { issuedAt: 'desc' },
    });
  }
}

function sampleDataFor(kind: TemplateKind): Record<string, unknown> {
  const base = {
    today: frToday(),
    company: {
      name: 'Autocars Horizon SAS',
      tradeName: 'Horizon Cars',
      siret: '12345678900012',
      vatNumber: 'FR12123456789',
      logoUrl: '',
    },
    customer: {
      name: 'Mairie de Villeurbanne',
      email: 'transport@villeurbanne.fr',
      phone: '04 00 00 00 00',
      address: '3 place Lazare Goujon<br/>69100 Villeurbanne',
    },
    contact: { name: 'Claire Dupont', email: 'claire@example.fr' },
    salesperson: {
      name: 'Camille Commercial',
      email: 'commercial@horizon-demo.fr',
    },
  };
  if (kind === 'quote') {
    return {
      ...base,
      quote: {
        number: 'D-2026-0042',
        title: 'Sortie scolaire Annecy',
        description: 'Aller-retour journée',
        status: 'draft',
        origin: 'Collège Jean Moulin',
        originAddress: 'Lyon 8e',
        destination: 'Annecy',
        destinationAddress: 'Parc Charles Bosson',
        departureAt: new Date(),
        returnAt: new Date(),
        garageDepartureAt: new Date(),
        presentationAt: new Date(),
        onSiteAt: new Date(),
        returnDepartureAt: new Date(),
        returnGarageAt: new Date(),
        vehicleCount: 1,
        vehicleCategory: 'Grand tourisme 55',
        passengers: 55,
        amountHt: 890,
        proposedPriceHt: 850,
        vatRate: 10,
        amountTtc: 935,
        proposedAt: new Date(),
        validUntil: new Date(Date.now() + 20 * 86400000),
        dayDetails: '',
      },
    };
  }
  if (kind === 'invoice') {
    return {
      ...base,
      invoice: {
        number: 'F-2026-0012',
        status: 'draft',
        amountHt: 850,
        vatRate: 10,
        amountTtc: 935,
        balance: 935,
        issuedAt: new Date(),
        notes: 'Échéance 30 jours',
        linesHtml:
          '<table><tr><td>Transport Annecy</td><td>1</td><td>850,00 €</td><td>850,00 €</td></tr></table>',
      },
    };
  }
  if (kind === 'planning') {
    return {
      ...base,
      planning: {
        title: 'Planning du jour',
        period: frToday(),
        rowsHtml:
          '<table><tr><td>07:30</td><td>M-1001 Navette</td><td>Mairie</td><td>David Martin</td><td>A12</td></tr></table>',
      },
    };
  }
  if (kind === 'collective_ticket') {
    return {
      ...base,
      mission: {
        number: 'M-2026-0100',
        title: 'Navette scolaire',
        origin: 'Dépôt Lyon',
        destination: 'Collège Jean Moulin',
        startsAt: new Date(),
        endsAt: new Date(),
        passengers: 48,
      },
      driver: { name: 'David Martin' },
      vehicle: { plate: 'AB-123-CD', fleetNumber: 'A12' },
    };
  }
  return {
    ...base,
    order: {
      number: 'C-2026-0010',
      title: 'Commande demo',
      status: 'confirmed',
    },
    quote: { number: 'D-2026-0042' },
  };
}

function renderCollectiveTicketPdf(
  path: string,
  data: Record<string, unknown>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => {
      writeFileSync(path, Buffer.concat(chunks));
      resolve();
    });
    doc.on('error', reject);

    doc.fontSize(18).text('BILLET COLLECTIF', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11).text(`Société : ${data.societe}`);
    doc.text(`Client : ${data.client}`);
    doc.text(`Mission : ${data.mission} — ${data.titre}`);
    doc.text(`Départ : ${data.depart}`);
    doc.text(`Arrivée : ${data.arrivee}`);
    doc.text(`Trajet : ${data.origin} → ${data.destination}`);
    doc.text(`Voyageurs : ${data.voyageurs}`);
    doc.text(`Conducteur : ${data.conducteur}`);
    doc.text(`Véhicule : ${data.vehicule}`);
    doc.moveDown();
    doc
      .fontSize(9)
      .fillColor('#666')
      .text(
        'Document généré par AUTOCAR OS (modèle v1). Mentions réglementaires à valider par un expert avant usage production.',
      );
    doc.end();
  });
}

@Module({
  imports: [AuthModule],
  controllers: [DocumentTemplatesController, DocumentsController],
})
export class DocumentsModule {}
