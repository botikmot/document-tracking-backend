import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { PublicTrackingController } from './public-tracking.controller';
import { PublicDocumentsController } from './public-documents.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, NotificationsModule, ConfigModule],
  controllers: [
    DocumentsController,
    PublicTrackingController,
    PublicDocumentsController,
  ],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
