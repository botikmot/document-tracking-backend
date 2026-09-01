import { Type } from 'class-transformer';

import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { TransactionQueryDto } from './transaction-query.dto';

export const OFFICE_TRANSACTION_BUCKETS = [
  'ALL',

  'INTERNAL',
  'EXTERNAL',

  'PERMIT',
  'SURVEY_RETURN',

  'PENDING',
  'ON_PROCESS',
  'FOR_REVIEW',
  'FOR_APPROVAL',

  'OVERDUE',
  'ACTED',
] as const;

export type OfficeTransactionBucket =
  (typeof OFFICE_TRANSACTION_BUCKETS)[number];

export class OfficeTransactionDocumentsQueryDto extends TransactionQueryDto {
  /*
  |--------------------------------------------------------------------------
  | BUCKET
  |--------------------------------------------------------------------------
  |
  | Used when clicking counts
  | from the Office Summary table.
  |
  | Example:
  |
  | ?bucket=OVERDUE
  | ?bucket=PERMIT
  | ?bucket=INTERNAL
  |
  */

  @IsOptional()
  @IsIn(OFFICE_TRANSACTION_BUCKETS)
  bucket?: OfficeTransactionBucket = 'ALL';

  /*
  |--------------------------------------------------------------------------
  | PAGINATION
  |--------------------------------------------------------------------------
  */

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
