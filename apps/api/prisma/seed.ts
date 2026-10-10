import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { PERMISSION_CATALOG } from '@autocar/shared';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { DEFAULT_TEMPLATES } from '../src/modules/documents/template-catalog';

const prisma = new PrismaClient();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo-Autocar-OS-2026!';

const GROUP_DEFS: Array<{
  key: string;
  name: string;
  permissionPrefixes?: string[];
  all?: boolean;
  extra?: string[];
  deny?: string[];
  scope?: string;
}> = [
  { key: 'super_admin', name: 'Super-administrateur', all: true },
  { key: 'company_admin', name: 'Administrateur société', all: true },
  {
    key: 'direction',
    name: 'Direction',
    permissionPrefixes: ['dashboard', 'customers', 'quotes', 'orders', 'missions', 'planning', 'fleet', 'drivers', 'audits', 'quality', 'billing'],
    extra: ['dashboard:analytics:list', 'hr:prepPayroll:list'],
  },
  {
    key: 'dispatcher',
    name: 'Exploitant',
    permissionPrefixes: [
      'dashboard',
      'missions',
      'planning',
      'drivers',
      'fleet',
      'courses',
      'services',
      'portal',
      'messaging',
      'quality',
      'documents',
    ],
    deny: ['hr:sensitive:read', 'billing:invoice:download'],
    scope: 'depot',
  },
  {
    key: 'sales',
    name: 'Commercial',
    permissionPrefixes: ['dashboard', 'customers', 'quotes', 'orders', 'missions', 'documents'],
    deny: ['documents:template:manage'],
  },
  {
    key: 'hr_manager',
    name: 'Responsable RH',
    permissionPrefixes: ['dashboard', 'hr', 'drivers', 'portal', 'users'],
    extra: ['hr:sensitive:read', 'portal:access:manage', 'hr:prepPayroll:list', 'hr:prepPayroll:manage'],
  },
  {
    key: 'prepPayroll',
    name: 'Gestionnaire prépaye',
    permissionPrefixes: ['dashboard', 'hr', 'drivers'],
    extra: ['hr:prepPayroll:list', 'hr:prepPayroll:manage'],
  },
  {
    key: 'workshop_manager',
    name: 'Chef d’atelier',
    permissionPrefixes: ['dashboard', 'fleet'],
    extra: ['fleet:workshop:list', 'fleet:workshop:manage'],
  },
  {
    key: 'accountant',
    name: 'Comptable',
    permissionPrefixes: ['dashboard', 'billing', 'customers'],
    extra: ['dashboard:analytics:list'],
  },
  {
    key: 'driver',
    name: 'Conducteur',
    extra: [
      'portal:access:manage', // not really — drivers don't manage; keep minimal
    ],
  },
  {
    key: 'mechanic',
    name: 'Mécanicien',
    permissionPrefixes: ['fleet', 'dashboard'],
    deny: ['billing:invoice:list', 'billing:invoice:download', 'hr:sensitive:read'],
  },
];

async function main() {
  console.log('Seeding AUTOCAR OS DEMO…');

  await prisma.accessAuditEvent.deleteMany();
  await prisma.message.deleteMany();
  await prisma.messageThread.deleteMany();
  await prisma.portalReadReceipt.deleteMany();
  await prisma.driverServiceEvent.deleteMany();
  await prisma.qualityEvent.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.plannedRest.deleteMany();
  await prisma.clientQuoteRequest.deleteMany();
  await prisma.simulation.deleteMany();
  await prisma.analyticsReport.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.qualityClassification.deleteMany();
  await prisma.fuelTransaction.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.workOrderTask.deleteMany();
  await prisma.workOrderAlertLink.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.repairRequest.deleteMany();
  await prisma.maintenanceAlert.deleteMany();
  await prisma.part.deleteMany();
  await prisma.payrollExportBatch.deleteMany();
  await prisma.payrollCounter.deleteMany();
  await prisma.prePayrollMonthlyLine.deleteMany();
  await prisma.prePayrollWeeklyLine.deleteMany();
  await prisma.prePayrollDailyLine.deleteMany();
  await prisma.prePayrollRule.deleteMany();
  await prisma.paymentAllocation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.customerCredit.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.serviceTimeBlock.deleteMany();
  await prisma.serviceDressingRun.deleteMany();
  await prisma.serviceDressingScenario.deleteMany();
  await prisma.planningPublicationBatch.deleteMany();
  await prisma.driverUnavailability.deleteMany();
  await prisma.vehicleUnavailability.deleteMany();
  await prisma.theoreticalAssignment.deleteMany();
  await prisma.rosterSlot.deleteMany();
  await prisma.rosterRotation.deleteMany();
  await prisma.roster.deleteMany();
  await prisma.generatedDocument.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.mission.deleteMany();
  await prisma.order.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.customerComment.deleteMany();
  await prisma.customerDocument.deleteMany();
  await prisma.customerDestination.deleteMany();
  await prisma.customerBankAccount.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.serviceCourseLink.deleteMany();
  await prisma.courseOperation.deleteMany();
  await prisma.courseSegment.deleteMany();
  await prisma.service.deleteMany();
  await prisma.course.deleteMany();
  await prisma.itinerary.deleteMany();
  await prisma.operatingCalendar.deleteMany();
  await prisma.location.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.vehicleCategory.deleteMany();
  await prisma.documentTemplate.deleteMany();
  await prisma.employeeAccountLink.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.groupPermission.deleteMany();
  await prisma.groupMembership.deleteMany();
  await prisma.accountInvitation.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.userAccount.deleteMany();
  await prisma.group.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.opsAlert.deleteMany();
  await prisma.depot.deleteMany();
  await prisma.company.deleteMany();

  const company = await prisma.company.create({
    data: {
      name: 'Autocars Horizon SAS',
      tradeName: 'Horizon Cars (DEMO)',
      siret: '12345678900012',
      vatNumber: 'FR12123456789',
      isDemo: true,
      brandName: 'AUTOCAR OS',
      brandTagline: 'TRANSPORT VOYAGEURS',
      loginHeadline: 'Pilotez vos exploitations en toute sérénité',
      loginSubheadline:
        'Une solution complète pour planifier, exploiter et optimiser votre activité de transport de voyageurs.',
      loginFooterText: 'Gestion d’exploitation transport voyageurs',
      loginHeroImageUrl: '/branding/login-hero-default.svg',
    },
  });

  for (const def of DEFAULT_TEMPLATES) {
    await prisma.documentTemplate.create({
      data: {
        companyId: company.id,
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

  const depotLyon = await prisma.depot.create({
    data: { companyId: company.id, code: 'LYN', name: 'Dépôt Lyon', city: 'Lyon' },
  });
  const depotGrenoble = await prisma.depot.create({
    data: {
      companyId: company.id,
      code: 'GRE',
      name: 'Dépôt Grenoble',
      city: 'Grenoble',
    },
  });

  for (const p of PERMISSION_CATALOG) {
    await prisma.permission.create({
      data: {
        companyId: null,
        key: p.key,
        module: p.module,
        resource: p.resource,
        action: p.action,
        label: p.label,
        sensitive: !!p.sensitive,
      },
    });
  }
  const allPerms = await prisma.permission.findMany();

  const groups: Record<string, { id: string }> = {};
  for (const def of GROUP_DEFS) {
    const g = await prisma.group.create({
      data: {
        companyId: company.id,
        key: def.key,
        name: def.name,
        isSystem: true,
        description: 'Groupe système DEMO',
      },
    });
    groups[def.key] = g;

    const selected = allPerms.filter((p) => {
      if (def.all) return true;
      if (def.extra?.includes(p.key)) return true;
      if (def.permissionPrefixes?.some((pref) => p.key.startsWith(pref + ':'))) {
        return true;
      }
      return false;
    });

    // Driver: only self portal actions via dedicated minimal set
    const driverKeys = new Set([
      'documents:document:list',
      'documents:document:download',
      'quality:incident:create',
      'messaging:thread:create',
      'messaging:thread:list',
    ]);

    for (const p of selected) {
      if (def.key === 'driver' && !driverKeys.has(p.key) && !def.extra?.includes(p.key)) {
        continue;
      }
      const denied = def.deny?.includes(p.key) || false;
      // Remove portal:access:manage from driver if accidentally included
      if (def.key === 'driver' && p.key === 'portal:access:manage') continue;

      await prisma.groupPermission.create({
        data: {
          groupId: g.id,
          permissionId: p.id,
          scope: def.scope || 'company',
          denied,
        },
      });
    }

    // Explicit denies
    if (def.deny) {
      for (const key of def.deny) {
        const p = allPerms.find((x) => x.key === key);
        if (!p) continue;
        await prisma.groupPermission.upsert({
          where: {
            groupId_permissionId: { groupId: g.id, permissionId: p.id },
          },
          create: {
            groupId: g.id,
            permissionId: p.id,
            denied: true,
            scope: def.scope || 'company',
          },
          update: { denied: true },
        });
      }
    }
  }

  // Fix driver group — only portal-usable keys
  const driverGroup = groups.driver;
  await prisma.groupPermission.deleteMany({ where: { groupId: driverGroup.id } });
  for (const key of [
    'documents:document:list',
    'documents:document:download',
    'quality:incident:create',
    'messaging:thread:create',
    'messaging:thread:list',
    'dashboard:widget:list',
  ]) {
    const p = allPerms.find((x) => x.key === key);
    if (p) {
      await prisma.groupPermission.create({
        data: {
          groupId: driverGroup.id,
          permissionId: p.id,
          scope: 'self',
        },
      });
    }
  }

  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  async function createUser(
    email: string,
    name: string,
    groupKey: string,
    depotId?: string,
  ) {
    const u = await prisma.userAccount.create({
      data: {
        companyId: company.id,
        email,
        displayName: name,
        passwordHash,
        status: 'active',
      },
    });
    await prisma.groupMembership.create({
      data: {
        groupId: groups[groupKey].id,
        userId: u.id,
        depotId: depotId || null,
      },
    });
    return u;
  }

  const admin = await createUser('admin@horizon-demo.fr', 'Alice Admin', 'super_admin');
  const exploitant = await createUser(
    'exploitant@horizon-demo.fr',
    'Émile Exploitant',
    'dispatcher',
    depotLyon.id,
  );
  const rh = await createUser('rh@horizon-demo.fr', 'Rita RH', 'hr_manager');
  const commercial = await createUser(
    'commercial@horizon-demo.fr',
    'Camille Commercial',
    'sales',
  );
  const driverUser = await createUser(
    'conducteur@horizon-demo.fr',
    'David Conducteur',
    'driver',
    depotLyon.id,
  );

  const empDriver = await prisma.employee.create({
    data: {
      companyId: company.id,
      depotId: depotLyon.id,
      matricule: 'C-1001',
      firstName: 'David',
      lastName: 'Martin',
      email: 'conducteur@horizon-demo.fr',
      jobTitle: 'Conducteur',
      contractHours: 35,
      sensitiveNotes: 'DONNÉE SENSIBLE DEMO — ne pas exposer aux exploitants',
    },
  });
  const driver = await prisma.driver.create({
    data: {
      companyId: company.id,
      employeeId: empDriver.id,
      depotId: depotLyon.id,
      licenseNumber: 'D-FR-998877',
    },
  });
  await prisma.employeeAccountLink.create({
    data: {
      employeeId: empDriver.id,
      userId: driverUser.id,
      portalRole: 'driver',
    },
  });

  // Second driver without account (for invitation demo)
  const emp2 = await prisma.employee.create({
    data: {
      companyId: company.id,
      depotId: depotLyon.id,
      matricule: 'C-1002',
      firstName: 'Sophie',
      lastName: 'Bernard',
      email: 'sophie.bernard@horizon-demo.fr',
      jobTitle: 'Conducteur',
    },
  });
  await prisma.driver.create({
    data: {
      companyId: company.id,
      employeeId: emp2.id,
      depotId: depotLyon.id,
    },
  });

  const catGt = await prisma.vehicleCategory.create({
    data: {
      companyId: company.id,
      code: 'GT',
      name: 'Grand tourisme 55',
      defaultSeats: 55,
      description: 'Autocar GT 55 places',
    },
  });
  const catStd = await prisma.vehicleCategory.create({
    data: {
      companyId: company.id,
      code: 'STD',
      name: 'Standard 53',
      defaultSeats: 53,
      description: 'Autocar standard 53 places',
    },
  });
  await prisma.vehicleCategory.create({
    data: {
      companyId: company.id,
      code: 'MINI',
      name: 'Minibus 19',
      defaultSeats: 19,
      description: 'Minibus 19 places',
    },
  });

  const v1 = await prisma.vehicle.create({
    data: {
      companyId: company.id,
      depotId: depotLyon.id,
      categoryId: catGt.id,
      fleetNumber: 'A12',
      plate: 'AB-123-CD',
      brand: 'Iveco',
      model: 'Evadys',
      seats: 55,
    },
  });
  await prisma.vehicle.create({
    data: {
      companyId: company.id,
      depotId: depotGrenoble.id,
      categoryId: catStd.id,
      fleetNumber: 'B07',
      plate: 'EF-456-GH',
      brand: 'Setra',
      model: 'S515HD',
      seats: 53,
      status: 'immobilized',
    },
  });

  const depotLoc = await prisma.location.create({
    data: {
      companyId: company.id,
      name: 'Dépôt Lyon',
      type: 'depot',
      city: 'Lyon',
      lat: 45.75,
      lng: 4.85,
    },
  });
  const school = await prisma.location.create({
    data: {
      companyId: company.id,
      name: 'Collège Jean Moulin',
      type: 'school',
      city: 'Villeurbanne',
      lat: 45.77,
      lng: 4.88,
    },
  });

  const calendar = await prisma.operatingCalendar.create({
    data: {
      companyId: company.id,
      name: 'Scolaire 2025-2026 (DEMO)',
      kind: 'school',
      weekdays: '1,2,3,4,5',
      oddEven: 'all',
      exceptionsJson: JSON.stringify([
        { date: '2026-02-16', type: 'holiday', label: 'Vacances hiver' },
      ]),
    },
  });

  const course = await prisma.course.create({
    data: {
      companyId: company.id,
      code: 'SCO-LYN-01',
      name: 'Ligne scolaire Jean Moulin',
      kind: 'school',
      calendarId: calendar.id,
      distanceKm: 18,
      durationMin: 45,
      segments: {
        create: [
          {
            sequence: 1,
            kind: 'start',
            name: 'Dépôt Lyon',
            locationId: depotLoc.id,
            plannedTime: '07:10',
          },
          {
            sequence: 2,
            kind: 'stop',
            name: 'Collège Jean Moulin',
            locationId: school.id,
            plannedTime: '07:55',
          },
        ],
      },
      operations: {
        create: [
          {
            sequence: 1,
            kind: 'positioning',
            label: 'Mise en place dépôt',
            fromLocationId: depotLoc.id,
            toLocationId: depotLoc.id,
            plannedStart: '07:00',
            plannedEnd: '07:10',
            durationMin: 10,
          },
          {
            sequence: 2,
            kind: 'run',
            label: 'Course scolaire',
            fromLocationId: depotLoc.id,
            toLocationId: school.id,
            plannedStart: '07:10',
            plannedEnd: '07:55',
            distanceKm: 18,
            durationMin: 45,
          },
        ],
      },
    },
  });

  await prisma.itinerary.create({
    data: {
      companyId: company.id,
      code: 'IT-SCO-01',
      name: 'Itinéraire Jean Moulin',
      distanceKm: 18,
      durationMin: 45,
      stopsJson: JSON.stringify([
        { name: 'Dépôt Lyon', lat: 45.75, lng: 4.85 },
        { name: 'Collège Jean Moulin', lat: 45.77, lng: 4.88 },
      ]),
    },
  });

  const service = await prisma.service.create({
    data: {
      companyId: company.id,
      code: 'SRV-MATIN-01',
      name: 'Service matin scolaire',
      courseLinks: { create: [{ courseId: course.id, sequence: 1 }] },
    },
  });

  const customer = await prisma.customer.create({
    data: {
      companyId: company.id,
      reference: 'CLI-0001',
      name: 'Mairie de Villeurbanne (DEMO)',
      tradeName: 'Ville de Villeurbanne',
      type: 'collectivity',
      email: 'transport@villeurbanne-demo.fr',
      phone: '04 72 00 00 00',
      siret: '21260979900012',
      vatNumber: 'FR21260979900',
      addressLine1: '3 place Lazare Goujon',
      postalCode: '69100',
      city: 'Villeurbanne',
      country: 'France',
      billingSameAsMain: true,
      paymentTermsDays: 30,
      alertNote: 'Demander bon de commande avant chaque départ scolaire.',
      notes: 'Client collectivité — facturation trimestrielle préférée.',
      preferredVehicleNotes: 'Autocar accessible PMR',
      contacts: {
        create: [
          {
            civility: 'Mme',
            firstName: 'Claire',
            lastName: 'Dupont',
            email: 'claire.dupont@villeurbanne-demo.fr',
            phone: '04 72 00 00 01',
            role: 'Responsable commande',
            department: 'Transport scolaire',
            isPrimary: true,
            isBilling: true,
            isOps: true,
          },
          {
            civility: 'M.',
            firstName: 'Paul',
            lastName: 'Martin',
            email: 'paul.martin@villeurbanne-demo.fr',
            role: 'Comptabilité',
            isBilling: true,
            isOps: false,
          },
        ],
      },
      bankAccounts: {
        create: [
          {
            label: 'Compte principal',
            bankName: 'Banque DEMO',
            iban: 'FR76 3000 6000 0112 3456 7890 189',
            bic: 'AGRIFRPP',
            accountHolder: 'Mairie de Villeurbanne',
            isDefault: true,
          },
        ],
      },
      destinations: {
        create: [
          {
            label: 'Groupe scolaire Anatole France',
            addressLine1: '12 rue Anatole France',
            postalCode: '69100',
            city: 'Villeurbanne',
            country: 'France',
          },
          {
            label: 'Parc de la Tête d’Or',
            city: 'Lyon',
            postalCode: '69006',
            country: 'France',
            notes: 'Dépose parking cars',
          },
        ],
      },
      comments: {
        create: [
          {
            authorName: 'Alice Admin',
            body: 'Client historique DEMO — bien suivre les délais de facturation 30 jours.',
          },
        ],
      },
    },
  });

  // Build a week of published services for the driver
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 5; i++) {
    const day = new Date(today);
    day.setDate(day.getDate() + i);
    if (day.getDay() === 0 || day.getDay() === 6) continue;

    const startsAt = new Date(day);
    startsAt.setHours(7, 0, 0, 0);
    const endsAt = new Date(day);
    endsAt.setHours(9, 30, 0, 0);

    const quote = await prisma.quote.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        salespersonId: commercial.id,
        source: 'email',
        number: `D-2026-${String(100 + i).padStart(4, '0')}`,
        title: `Navette scolaire J+${i}`,
        caseType: 'repetitive',
        status: 'accepted',
        departureAt: startsAt,
        origin: 'Dépôt Lyon',
        destination: 'Collège Jean Moulin',
        vehicleCount: 1,
        vehicleCategoryId: catGt.id,
        passengers: 55,
        amountHt: 220,
        proposedPriceHt: 220,
        amountTtc: 242,
        proposedAt: startsAt,
        validUntil: new Date(startsAt.getTime() + 20 * 86400000),
        acceptedAt: startsAt,
        availabilityNote: 'Seed DEMO',
        availabilityConfidence: 'medium',
      },
    });
    const order = await prisma.order.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        quoteId: quote.id,
        number: `C-2026-${String(100 + i).padStart(4, '0')}`,
        title: quote.title,
        status: 'published',
      },
    });
    const mission = await prisma.mission.create({
      data: {
        companyId: company.id,
        orderId: order.id,
        number: `M-2026-${String(100 + i).padStart(4, '0')}`,
        title: quote.title,
        startsAt,
        endsAt,
        origin: quote.origin,
        destination: quote.destination,
        passengers: 48,
        status: 'published',
        publishedAt: new Date(),
      },
    });
    await prisma.assignment.create({
      data: {
        companyId: company.id,
        missionId: mission.id,
        driverId: driver.id,
        vehicleId: v1.id,
        startsAt,
        endsAt,
        published: true,
        status: 'published',
      },
    });
  }

  // One unpublished mission (must NOT appear on driver portal)
  {
    const startsAt = new Date(today);
    startsAt.setDate(startsAt.getDate() + 3);
    startsAt.setHours(14, 0, 0, 0);
    const endsAt = new Date(startsAt);
    endsAt.setHours(18, 0, 0, 0);
    const quote = await prisma.quote.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        number: 'D-2026-0900',
        title: 'Occasionnel NON PUBLIÉ',
        status: 'accepted',
        departureAt: startsAt,
        origin: 'Lyon Part-Dieu',
        destination: 'Aéroport St-Exupéry',
        passengers: 20,
        amountHt: 380,
        amountTtc: 418,
      },
    });
    const order = await prisma.order.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        quoteId: quote.id,
        number: 'C-2026-0900',
        title: quote.title,
        status: 'planned',
      },
    });
    const mission = await prisma.mission.create({
      data: {
        companyId: company.id,
        orderId: order.id,
        number: 'M-2026-0900',
        title: quote.title,
        startsAt,
        endsAt,
        origin: quote.origin,
        destination: quote.destination,
        passengers: 20,
        status: 'planned',
      },
    });
    await prisma.assignment.create({
      data: {
        companyId: company.id,
        missionId: mission.id,
        driverId: driver.id,
        vehicleId: v1.id,
        startsAt,
        endsAt,
        published: false,
        status: 'draft',
      },
    });
  }

  // Weekly rest
  const restStart = new Date(today);
  restStart.setDate(restStart.getDate() + ((6 - restStart.getDay() + 7) % 7 || 7));
  restStart.setHours(0, 0, 0, 0);
  const restEnd = new Date(restStart);
  restEnd.setDate(restEnd.getDate() + 1);
  await prisma.plannedRest.create({
    data: {
      companyId: company.id,
      driverId: driver.id,
      kind: 'weekly_rest',
      startsAt: restStart,
      endsAt: restEnd,
      published: true,
    },
  });

  // Message + incident + leave sample
  await prisma.messageThread.create({
    data: {
      companyId: company.id,
      subject: 'Question prise de service',
      driverUserId: driverUser.id,
      status: 'new',
      messages: {
        create: {
          authorId: driverUser.id,
          body: 'Bonjour, confirmez-vous le véhicule A12 demain matin ?',
        },
      },
    },
  });

  await prisma.qualityEvent.create({
    data: {
      companyId: company.id,
      reportedById: driverUser.id,
      source: 'driver',
      category: 'retard',
      nature: 'retard',
      precision: 'circulation',
      description: 'Embouteillage A43 — retard estimé 15 min (DEMO)',
      severity: 'low',
    },
  });

  await prisma.leaveRequest.create({
    data: {
      companyId: company.id,
      employeeId: empDriver.id,
      requesterId: driverUser.id,
      type: 'conges',
      startsOn: new Date(today.getTime() + 20 * 86400000),
      endsOn: new Date(today.getTime() + 22 * 86400000),
      comment: 'Congés familiaux (DEMO)',
      status: 'submitted',
    },
  });

  // PDF for first published mission
  const firstMission = await prisma.mission.findFirst({
    where: { companyId: company.id, status: 'published' },
    include: {
      order: { include: { customer: true } },
      assignments: {
        include: { driver: { include: { employee: true } }, vehicle: true },
      },
    },
  });
  if (firstMission) {
    const dir = join(process.cwd(), 'generated-pdfs');
    mkdirSync(dir, { recursive: true });
    const fileName = `billet-${firstMission.number}.pdf`;
    const storagePath = join(dir, fileName);
    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => {
        writeFileSync(storagePath, Buffer.concat(chunks));
        resolve();
      });
      doc.on('error', reject);
      doc.fontSize(16).text('BILLET COLLECTIF (DEMO)');
      doc.text(`Mission ${firstMission.number}`);
      doc.text(`Client ${firstMission.order.customer.name}`);
      doc.end();
    });
    await prisma.generatedDocument.create({
      data: {
        companyId: company.id,
        missionId: firstMission.id,
        kind: 'collective_ticket',
        templateKey: 'billet_collectif',
        templateVersion: 1,
        fileName,
        storagePath,
        snapshotJson: JSON.stringify({ mission: firstMission.number }),
      },
    });
  }

  await prisma.opsAlert.createMany({
    data: [
      {
        companyId: company.id,
        severity: 'warning',
        title: 'Véhicule B07 immobilisé',
        body: 'Dépôt Grenoble — indisponible planning',
        href: '/app/vehicles',
      },
      {
        companyId: company.id,
        severity: 'info',
        title: 'Demande de congé en attente',
        body: 'David Martin — validation RH',
        href: '/app/portal-ops',
      },
    ],
  });

  // Phase 2 — roulement + préaffectation + indispo
  await prisma.roster.create({
    data: {
      companyId: company.id,
      code: 'ROL-SCO-A',
      name: 'Roulement scolaire A/B',
      cycleDays: 14,
      pattern: 'A/B',
      slots: {
        create: [0, 1, 2, 3, 4].map((dayOffset) => ({
          dayOffset,
          label: `Matin scolaire J${dayOffset}`,
          serviceId: service.id,
          driverId: driver.id,
          startTime: '07:00',
          endTime: '09:30',
        })),
      },
      rotations: {
        create: [
          { weekIndex: 0, label: 'Semaine A', driverIdsJson: JSON.stringify([driver.id]) },
          { weekIndex: 1, label: 'Semaine B', driverIdsJson: JSON.stringify([driver.id]) },
        ],
      },
    },
  });

  await prisma.theoreticalAssignment.create({
    data: {
      companyId: company.id,
      serviceId: service.id,
      courseId: course.id,
      driverId: driver.id,
      vehicleId: v1.id,
      weekday: 1,
      notes: 'Titulaire théorique lundi (DEMO)',
    },
  });

  const unavStart = new Date(today);
  unavStart.setDate(unavStart.getDate() + 10);
  unavStart.setHours(0, 0, 0, 0);
  const unavEnd = new Date(unavStart);
  unavEnd.setDate(unavEnd.getDate() + 1);
  await prisma.driverUnavailability.create({
    data: {
      companyId: company.id,
      driverId: driver.id,
      kind: 'formation',
      reason: 'Formation continue (DEMO)',
      startsAt: unavStart,
      endsAt: unavEnd,
    },
  });

  // Phase 3 — scénario habillage + run sur 1ère affectation
  const scenario = await prisma.serviceDressingScenario.create({
    data: {
      companyId: company.id,
      code: 'HAB-STD',
      name: 'Habillage standard dépôt Lyon',
      prepMin: 15,
      finishMin: 10,
      cashMin: 5,
      approachHlpMin: 20,
      returnHlpMin: 20,
      paidBreakMin: 0,
    },
  });

  const firstAssignment = await prisma.assignment.findFirst({
    where: { companyId: company.id, published: true },
    include: { mission: true },
    orderBy: { startsAt: 'asc' },
  });
  if (firstAssignment) {
    const commercialStart = firstAssignment.startsAt;
    const commercialEnd = firstAssignment.endsAt;
    const prepStart = new Date(commercialStart.getTime() - 35 * 60000);
    const blocks = [
      {
        sequence: 1,
        kind: 'duty_start',
        label: 'Prise de service',
        startsAt: prepStart,
        endsAt: new Date(prepStart.getTime() + 15 * 60000),
        distanceKm: 0,
        fromLocation: 'Dépôt Lyon',
        toLocation: 'Dépôt Lyon',
      },
      {
        sequence: 2,
        kind: 'hlp_approach',
        label: 'HLP approche',
        startsAt: new Date(prepStart.getTime() + 15 * 60000),
        endsAt: commercialStart,
        distanceKm: 8,
        fromLocation: 'Dépôt Lyon',
        toLocation: firstAssignment.mission.origin || 'Origine',
      },
      {
        sequence: 3,
        kind: 'commercial',
        label: 'Course commerciale',
        startsAt: commercialStart,
        endsAt: commercialEnd,
        distanceKm: 18,
        fromLocation: firstAssignment.mission.origin || 'Origine',
        toLocation: firstAssignment.mission.destination || 'Dest',
      },
      {
        sequence: 4,
        kind: 'cash',
        label: 'Caisse',
        startsAt: commercialEnd,
        endsAt: new Date(commercialEnd.getTime() + 5 * 60000),
        distanceKm: 0,
        fromLocation: firstAssignment.mission.destination || 'Dest',
        toLocation: firstAssignment.mission.destination || 'Dest',
      },
      {
        sequence: 5,
        kind: 'hlp_return',
        label: 'Retour dépôt',
        startsAt: new Date(commercialEnd.getTime() + 5 * 60000),
        endsAt: new Date(commercialEnd.getTime() + 25 * 60000),
        distanceKm: 8,
        fromLocation: firstAssignment.mission.destination || 'Dest',
        toLocation: 'Dépôt Lyon',
      },
      {
        sequence: 6,
        kind: 'duty_end',
        label: 'Fin de service',
        startsAt: new Date(commercialEnd.getTime() + 25 * 60000),
        endsAt: new Date(commercialEnd.getTime() + 35 * 60000),
        distanceKm: 0,
        fromLocation: 'Dépôt Lyon',
        toLocation: 'Dépôt Lyon',
      },
    ];
    await prisma.serviceDressingRun.create({
      data: {
        companyId: company.id,
        scenarioId: scenario.id,
        assignmentId: firstAssignment.id,
        driverId: firstAssignment.driverId,
        workDate: commercialStart,
        status: 'calculated',
        totalMin: 35 + Math.round((commercialEnd.getTime() - commercialStart.getTime()) / 60000) + 35,
        totalKm: 34,
        blocks: {
          create: blocks.map((b) => ({
            companyId: company.id,
            ...b,
            paid: true,
          })),
        },
      },
    });
  }

  // Phase 5 — règles prépaye DEMO
  await prisma.prePayrollRule.createMany({
    data: [
      {
        companyId: company.id,
        code: 'PRESENCE',
        label: 'Heures de présence',
        period: 'daily',
        formula: 'presence_hours * rate',
        priority: 10,
      },
      {
        companyId: company.id,
        code: 'HS',
        label: 'Heures supplémentaires',
        period: 'daily',
        formula: 'overtime_hours * rate',
        priority: 20,
      },
      {
        companyId: company.id,
        code: 'NUIT',
        label: 'Majorations nuit',
        period: 'daily',
        formula: 'night_hours * rate',
        priority: 30,
      },
    ],
  });

  // Phase 6 — atelier / stocks / carburant
  const v2 = await prisma.vehicle.findFirst({
    where: { companyId: company.id, fleetNumber: 'B07' },
  });
  await prisma.maintenanceAlert.create({
    data: {
      companyId: company.id,
      vehicleId: v1.id,
      kind: 'km',
      title: 'Révision 40 000 km (DEMO)',
      dueKm: 40000,
      priority: 'high',
    },
  });
  await prisma.repairRequest.create({
    data: {
      companyId: company.id,
      vehicleId: v2?.id || v1.id,
      source: 'driver',
      title: 'Bruit freinage arrière',
      description: 'Signalement conducteur — à diagnostiquer (DEMO)',
      priority: 'medium',
    },
  });
  const partPads = await prisma.part.create({
    data: {
      companyId: company.id,
      sku: 'PLAQ-AV-01',
      name: 'Plaquettes frein avant',
      qty: 4,
      minQty: 2,
      unitCost: 48.5,
      location: 'Rayon A1',
    },
  });
  await prisma.part.create({
    data: {
      companyId: company.id,
      sku: 'FILT-HUILE',
      name: 'Filtre à huile',
      qty: 12,
      minQty: 4,
      unitCost: 18,
      location: 'Rayon B2',
    },
  });
  await prisma.purchaseOrder.create({
    data: {
      companyId: company.id,
      number: 'BC-0001',
      supplier: 'Pièces Bus Rhône',
      status: 'ordered',
      linesJson: JSON.stringify([
        { partId: partPads.id, qty: 8, unitCost: 46 },
      ]),
    },
  });
  await prisma.fuelTransaction.create({
    data: {
      companyId: company.id,
      vehicleId: v1.id,
      filledAt: new Date(),
      liters: 280,
      amount: 420,
      odometerKm: 38500,
      source: 'manual',
      status: 'validated',
    },
  });
  await prisma.fuelTransaction.create({
    data: {
      companyId: company.id,
      vehicleId: v2?.id ?? v1.id,
      filledAt: new Date(Date.now() - 86400000),
      liters: 120,
      amount: 185,
      source: 'import',
      status: 'to_check',
      note: 'Import carte carburant DEMO',
    },
  });

  // Phase 7 — qualité hiérarchique + budget
  const src = await prisma.qualityClassification.create({
    data: {
      companyId: company.id,
      level: 'source',
      code: 'DRIVER',
      label: 'Conducteur',
    },
  });
  const nature = await prisma.qualityClassification.create({
    data: {
      companyId: company.id,
      level: 'nature',
      code: 'RETARD',
      label: 'Retard',
      parentId: src.id,
    },
  });
  await prisma.qualityClassification.create({
    data: {
      companyId: company.id,
      level: 'precision',
      code: 'CIRCULATION',
      label: 'Circulation',
      parentId: nature.id,
    },
  });
  await prisma.budget.create({
    data: {
      companyId: company.id,
      name: `Budget ${today.getFullYear()} DEMO`,
      year: today.getFullYear(),
      source: 'manual',
      linesJson: JSON.stringify([
        { label: 'Recettes transport', planned: 120000, actual: 0 },
        { label: 'Coût conducteurs (prépaye)', planned: 55000, actual: 0 },
        { label: 'Énergie', planned: 18000, actual: 0 },
        { label: 'Atelier / pièces', planned: 12000, actual: 0 },
      ]),
    },
  });

  // Phase 8 — demande portail client
  await prisma.clientQuoteRequest.create({
    data: {
      companyId: company.id,
      contactName: 'Comité des fêtes Demo',
      email: 'comite@example-demo.fr',
      phone: '06 00 00 00 00',
      origin: 'Lyon Part-Dieu',
      destination: 'Annecy',
      departureAt: new Date(today.getTime() + 30 * 86400000),
      passengers: 48,
      message: 'Aller-retour journée — demande via portail client (DEMO)',
      status: 'new',
    },
  });

  console.log('Seed OK');
  console.log({
    company: company.name,
    depots: [depotLyon.code, depotGrenoble.code],
    users: [
      admin.email,
      exploitant.email,
      rh.email,
      commercial.email,
      driverUser.email,
    ],
    password: DEMO_PASSWORD,
    portals: {
      driver: '/conducteur',
      client: '/client',
      security: '/app/security',
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
