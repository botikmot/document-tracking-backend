import { IsOptional, IsString } from 'class-validator';

export class PublicUpdateDocumentStatusDto {
  @IsString()
  trackingNumber?: string;

  @IsString()
  status!: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
