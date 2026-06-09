import { IsOptional, IsString } from 'class-validator';

export class ReturnDocumentDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}
