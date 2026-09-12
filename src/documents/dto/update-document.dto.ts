import {
  IsArray,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import { Type } from 'class-transformer';

import {
  DocumentMonitoringCategory,
  DocumentSourceClass,
  InternalSourceScope,
  DocumentClassification,
  DocumentPriority,
} from '@prisma/client';

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  deadline?: Date;

  @IsOptional()
  @IsUUID()
  documentTypeId?: string;

  @IsOptional()
  @IsString()
  addressee?: string;

  @IsOptional()
  @IsEnum(DocumentClassification)
  classification?: DocumentClassification;

  @IsOptional()
  @IsEnum(DocumentPriority)
  priority?: DocumentPriority;

  @IsOptional()
  @IsUUID()
  responsibleOfficeId?: string;

  @IsOptional()
  @IsString()
  responsiblePerson?: string;

  @IsOptional()
  @IsString()
  confidentialityLevel?: string;

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
  @IsArray()
  attachments?: {
    fileName: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
    publicId: string;
  }[];
}
