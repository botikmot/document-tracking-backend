import { Controller, Get, Param } from '@nestjs/common';

import { DocumentsService } from './documents.service';

@Controller('track')
export class PublicTrackingController {
  constructor(private readonly documentsService: DocumentsService) {}

  /*
   |--------------------------------------------------------------------------
   | PUBLIC TRACK DOCUMENT
   |--------------------------------------------------------------------------
   */

  @Get(':trackingNumber')
  trackDocument(
    @Param('trackingNumber')
    trackingNumber: string,
  ) {
    return this.documentsService.trackDocument(trackingNumber);
  }
}
