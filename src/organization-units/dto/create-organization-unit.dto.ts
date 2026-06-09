import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum OrganizationType {
  REGIONAL = 'REGIONAL',
  PENRO = 'PENRO',
  CENRO = 'CENRO',
}

export class CreateOrganizationUnitDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsEnum(OrganizationType)
  type!: OrganizationType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}
