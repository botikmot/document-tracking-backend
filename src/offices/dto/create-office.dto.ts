import { IsOptional, IsString } from 'class-validator';

export class CreateOfficeDto {
  @IsString()
  officeCode!: string;

  @IsString()
  officeName!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  organizationUnitId!: string;
}
