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

@Controller('public/documents')
export class PublicDocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('status')
  async updateStatus(
    @NestHeaders('x-api-key')
    apiKey: string,

    @Body()
    dto: PublicUpdateDocumentStatusDto,
  ) {
    const expectedApiKey = this.configService.get<string>(
      'EDATS_PUBLIC_API_KEY',
    );

    if (!expectedApiKey || apiKey !== expectedApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    return this.documentsService.publicUpdateDocumentStatus(dto);
  }
}
