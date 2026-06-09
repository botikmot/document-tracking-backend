import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

import {
  DocumentTypesService,
  CreateDocumentTypeDto,
} from './document-types.service';

@Controller('document-types')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentTypesController {
  constructor(private readonly documentTypesService: DocumentTypesService) {}

  @Post()
  @Roles('SUPER_ADMIN')
  create(
    @Body()
    dto: CreateDocumentTypeDto,
  ) {
    return this.documentTypesService.create(dto);
  }

  @Get()
  findAll() {
    return this.documentTypesService.findAll();
  }

  @Get(':id')
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.documentTypesService.findOne(id);
  }
}
