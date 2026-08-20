import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { ClientsModule } from '../clients/clients.module';
import { ClientAuthModule } from '../client-auth/client-auth.module';

import { ClientApplicationsController } from './client-applications.controller';
import { ClientApplicationsService } from './client-applications.service';
import { ClientServiceTypesModule } from '../client-service-types/client-service-types.module';
import { RecordsClientApplicationsController } from './records-client-applications.controller';
import { DocumentsModule } from '../documents/documents.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    PrismaModule,
    ClientsModule,
    ClientAuthModule,
    ClientServiceTypesModule,
    DocumentsModule,
    MailModule,
  ],

  controllers: [
    ClientApplicationsController,
    RecordsClientApplicationsController,
  ],

  providers: [ClientApplicationsService],

  exports: [ClientApplicationsService],
})
export class ClientApplicationsModule {}
