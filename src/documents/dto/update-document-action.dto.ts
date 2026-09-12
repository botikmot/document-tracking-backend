import { PartialType } from '@nestjs/mapped-types';
import { CreateDocumentActionDto } from './create-document-action.dto';

export class UpdateDocumentActionDto extends PartialType(
  CreateDocumentActionDto,
) {}
