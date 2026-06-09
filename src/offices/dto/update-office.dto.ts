import { IsOptional, IsString } from 'class-validator';

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
}
