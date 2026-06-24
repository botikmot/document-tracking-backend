import { IsOptional, IsString, IsDate, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
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
  @IsString()
  documentTypeId?: string;

  @IsOptional()
  @IsString()
  addressee?: string;

  @IsOptional()
  @IsString()
  classification?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  confidentialityLevel?: string;

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
  attachments?: {
    fileName: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
    publicId: string;
  }[];
}
