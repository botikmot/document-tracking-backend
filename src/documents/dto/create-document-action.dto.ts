import { IsOptional, IsString, MaxLength, IsEnum } from 'class-validator';
import { DocumentActionType } from '@prisma/client';

export class CreateDocumentActionDto {
  @IsOptional()
  @IsEnum(DocumentActionType)
  actionType?: DocumentActionType;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comment?: string;
}
