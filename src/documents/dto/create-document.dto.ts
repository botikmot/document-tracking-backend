import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

import {
  DocumentMonitoringCategory,
  DocumentSourceClass,
  InternalSourceScope,
  DocumentClassification,
  DocumentPriority,
} from '@prisma/client';

import { CreateDocumentAttachmentDto } from './create-document-attachment.dto';

export class CreateDocumentDto {
  @IsUUID()
  documentTypeId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsEnum(DocumentPriority)
  priority?: DocumentPriority;

  @IsOptional()
  @IsString()
  confidentialityLevel?: string;

  @IsOptional()
  @IsEnum(DocumentClassification)
  classification?: DocumentClassification;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  addressee?: string;

  @IsOptional()
  @IsUUID()
  responsibleOfficeId?: string;

  @IsOptional()
  @IsString()
  responsiblePerson?: string;

  // =====================================================
  // DOCUMENT SOURCE CLASSIFICATION
  // =====================================================

  @IsOptional()
  @IsEnum(DocumentSourceClass)
  sourceClass?: DocumentSourceClass;

  @IsOptional()
  @IsEnum(InternalSourceScope)
  internalSourceScope?: InternalSourceScope;

  @IsOptional()
  @IsEnum(DocumentMonitoringCategory)
  monitoringCategory?: DocumentMonitoringCategory;

  // =====================================================
  // SENDER
  // =====================================================

  @IsOptional()
  @IsString()
  senderType?: string;

  @IsOptional()
  @IsUUID()
  senderOfficeId?: string;

  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsString()
  senderOrganization?: string;

  @IsOptional()
  @IsString()
  senderContact?: string;

  @IsOptional()
  @IsUUID()
  currentOfficeId?: string;

  // =====================================================
  // ATTACHMENTS
  // =====================================================

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDocumentAttachmentDto)
  attachments?: CreateDocumentAttachmentDto[];
}
