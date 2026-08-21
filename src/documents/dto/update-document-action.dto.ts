// dto/update-document-action.dto.ts

import { IsOptional, IsString } from 'class-validator';

export class UpdateDocumentActionDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
