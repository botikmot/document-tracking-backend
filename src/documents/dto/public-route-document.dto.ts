import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class PublicRouteDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  trackingNumber!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  receivingOfficeCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;
}
