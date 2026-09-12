import { IsOptional, IsString, MaxLength, IsEnum } from 'class-validator';

import { DocumentClassification, DocumentPriority } from '@prisma/client';

export class AcceptClientApplicationDto {
  @IsString()
  documentTypeId!: string;

  @IsOptional()
  @IsEnum(DocumentClassification)
  classification?: DocumentClassification;

  @IsString()
  addressee!: string;

  @IsOptional()
  @IsEnum(DocumentPriority)
  priority?: DocumentPriority;

  @IsOptional()
  @IsString()
  confidentialityLevel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;
}
