import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OfficesModule } from './offices/offices.module';
import { DocumentsModule } from './documents/documents.module';
import { RoutingModule } from './routing/routing.module';
import { RolesModule } from './roles/roles.module';
import { OrganizationUnitsModule } from './organization-units/organization-units.module';
import { DocumentTypesModule } from './document-types/document-types.module';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsModule } from './notifications/notifications.module';
import { MailModule } from './mail/mail.module';
import { SmsModule } from './sms/sms.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { CommunityModule } from './community/community.module';
import { ClientsModule } from './clients/clients.module';
import { ClientAuthModule } from './client-auth/client-auth.module';
import { ClientApplicationsModule } from './client-applications/client-applications.module';
import { ClientServiceTypesModule } from './client-service-types/client-service-types.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    OfficesModule,
    DocumentsModule,
    RoutingModule,
    RolesModule,
    OrganizationUnitsModule,
    DocumentTypesModule,
    ScheduleModule.forRoot(),
    NotificationsModule,
    MailModule,
    SmsModule,
    ReportsModule,
    SettingsModule,
    CommunityModule,
    ClientsModule,
    ClientAuthModule,
    ClientApplicationsModule,
    ClientServiceTypesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
