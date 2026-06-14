import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { PublicTrackingController } from './public-tracking.controller';

@Module({
  controllers: [DocumentsController, PublicTrackingController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
