import { OfficeCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateOfficeDto {
  @IsString()
  officeCode!: string;

  @IsString()
  officeName!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  organizationUnitId!: string;

  @IsEnum(OfficeCategory)
  category!: OfficeCategory;
}
