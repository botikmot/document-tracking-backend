import { IsOptional, IsString } from 'class-validator';

export class ReceiveDocumentDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}
