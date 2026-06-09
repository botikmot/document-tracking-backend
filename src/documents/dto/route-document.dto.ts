import { IsOptional, IsString } from 'class-validator';

export class RouteDocumentDto {
  @IsString()
  toOfficeId!: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
