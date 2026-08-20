import { IsOptional, IsString } from 'class-validator';

export class UploadClientRequirementDto {
  @IsOptional()
  @IsString()
  requirementId?: string;
}
