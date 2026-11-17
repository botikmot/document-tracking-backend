import {
  Body,
  Controller,
  Headers as NestHeaders,
  Post,
  UnauthorizedException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { DocumentsService } from './documents.service';

import { PublicUpdateDocumentStatusDto } from './dto/public-update-document-status.dto';
import { PublicRouteDocumentDto } from './dto/public-route-document.dto';

@Controller('public/documents')
export class PublicDocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly configService: ConfigService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | API KEY VALIDATION
  |--------------------------------------------------------------------------
  */

  private validateApiKey(apiKey: string) {
    const expectedApiKey = this.configService.get<string>(
      'EDATS_PUBLIC_API_KEY',
    );

    if (!expectedApiKey || apiKey !== expectedApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }
  }

  /*
  |--------------------------------------------------------------------------
  | POST - UPDATE DOCUMENT STATUS
  |--------------------------------------------------------------------------
  */

  @Post('status')
  async updateStatus(
    @NestHeaders('x-api-key')
    apiKey: string,

    @Body()
    dto: PublicUpdateDocumentStatusDto,
  ) {
    this.validateApiKey(apiKey);

    return this.documentsService.publicUpdateDocumentStatus(dto);
  }

  /*
  |--------------------------------------------------------------------------
  | POST - ROUTE DOCUMENT
  |--------------------------------------------------------------------------
  */

  @Post('routing')
  async routeDocument(
    @NestHeaders('x-api-key')
    apiKey: string,

    @Body()
    dto: PublicRouteDocumentDto,
  ) {
    this.validateApiKey(apiKey);

    return this.documentsService.publicRouteDocument(dto);
  }
}
