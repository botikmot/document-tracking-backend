import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AcceptClientApplicationDto {
  @IsString()
  documentTypeId!: string;

  @IsString()
  classification!: string;

  @IsString()
  addressee!: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  confidentialityLevel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;
}
