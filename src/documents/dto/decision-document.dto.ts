import { IsOptional, IsString } from 'class-validator';

export class DecisionDocumentDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}
