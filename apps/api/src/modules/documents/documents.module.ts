import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
  Module,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, PermissionsGuard } from '../iam/guards';
import { CurrentUser, RequirePermission } from '../iam/decorators';
import type { RequestUser } from '../iam/auth.types';
import { AuthModule } from '../iam/auth.module';

@Controller('documents')
@UseGuards(JwtAuthGuard, PermissionsGuard)
class DocumentsController {
  constructor(private readonly prisma: PrismaService) {}

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

@Module({ imports: [AuthModule], controllers: [DocumentsController] })
export class DocumentsModule {}
