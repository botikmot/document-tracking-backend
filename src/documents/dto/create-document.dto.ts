import { IsDateString, IsOptional, IsString } from 'class-validator';

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

  @IsOptional()
  @IsDateString()
  deadline?: string;
}
