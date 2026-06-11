import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateDocumentAttachmentDto {
  @IsString()
  fileName!: string;

  @IsString()
  filePath!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  fileSize?: number;

  @IsString()
  publicId!: string;
}
