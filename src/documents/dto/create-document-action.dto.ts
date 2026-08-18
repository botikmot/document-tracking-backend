import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDocumentActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comment?: string;
}
