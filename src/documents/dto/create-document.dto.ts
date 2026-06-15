import {
  IsDateString,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateDocumentAttachmentDto } from './create-document-attachment.dto';

export class CreateDocumentDto {
  @IsString()
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
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  confidentialityLevel?: string;

  @IsString()
  classification?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsString()
  addressee?: string;

  @IsOptional()
  @IsString()
  senderType?: string;

  @IsOptional()
  @IsString()
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
  @ValidateNested({ each: true })
  @Type(() => CreateDocumentAttachmentDto)
  attachments?: CreateDocumentAttachmentDto[];
}
