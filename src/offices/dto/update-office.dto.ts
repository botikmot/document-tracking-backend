import { OfficeCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateOfficeDto {
  @IsOptional()
  @IsString()
  officeCode?: string;

  @IsOptional()
  @IsString()
  officeName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  parentOfficeId?: string;

  @IsString()
  organizationUnitId!: string;

  @IsEnum(OfficeCategory)
  category!: OfficeCategory;
}
