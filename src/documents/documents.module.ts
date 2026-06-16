import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { PublicTrackingController } from './public-tracking.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [DocumentsController, PublicTrackingController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
