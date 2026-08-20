import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateClientApplicationDto {
  @IsString()
  @IsNotEmpty()
  serviceTypeId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  relatedTrackingNumber?: string;
}
