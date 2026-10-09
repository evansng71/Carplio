import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/iam/auth.module';
import { UsersModule } from './modules/iam/users.module';
import { OrgModule } from './modules/org/org.module';
import { CrmModule } from './modules/crm/crm.module';
import { HrModule } from './modules/hr/hr.module';
import { FleetModule } from './modules/fleet/fleet.module';
import { TransportModule } from './modules/transport/transport.module';
import { PlanningModule } from './modules/planning/planning.module';
import { CommercialModule } from './modules/commercial/commercial.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { PortalModule } from './modules/portal/portal.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { RosterModule } from './modules/roster/roster.module';
import { DressingModule } from './modules/dressing/dressing.module';
import { BillingModule } from './modules/billing/billing.module';
import { PrepPayrollModule } from './modules/prepPayroll/prepPayroll.module';
import { WorkshopModule } from './modules/workshop/workshop.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ClientPortalModule } from './modules/clientPortal/clientPortal.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    OrgModule,
    CrmModule,
    HrModule,
    FleetModule,
    TransportModule,
    PlanningModule,
    RosterModule,
    DressingModule,
    BillingModule,
    PrepPayrollModule,
    WorkshopModule,
    AnalyticsModule,
    ClientPortalModule,
    CommercialModule,
    DocumentsModule,
    PortalModule,
    DashboardModule,
  ],
})
export class AppModule {}
