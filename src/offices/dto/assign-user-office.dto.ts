import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AssignUserOfficeDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsBoolean()
  isOfficeAdmin?: boolean;
}
