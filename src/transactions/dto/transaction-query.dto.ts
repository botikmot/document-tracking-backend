import {
  DocumentMonitoringCategory,
  DocumentSourceClass,
} from '@prisma/client';

import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class TransactionQueryDto {
  /*
  |--------------------------------------------------------------------------
  | REPORT PERIOD
  |--------------------------------------------------------------------------
  |
  | Based on document received / created date.
  |
  | Example:
  |
  | ?from=2026-08-01
  | &to=2026-08-31
  |
  */

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  /*
  |--------------------------------------------------------------------------
  | SEARCH
  |--------------------------------------------------------------------------
  */

  @IsOptional()
  @IsString()
  search?: string;

  /*
  |--------------------------------------------------------------------------
  | OFFICE
  |--------------------------------------------------------------------------
  */

  @IsOptional()
  @IsString()
  officeId?: string;

  /*
  |--------------------------------------------------------------------------
  | DOCUMENT SOURCE
  |--------------------------------------------------------------------------
  */

  @IsOptional()
  @IsEnum(DocumentSourceClass)
  sourceClass?: DocumentSourceClass;

  /*
  |--------------------------------------------------------------------------
  | MONITORING CATEGORY
  |--------------------------------------------------------------------------
  */

  @IsOptional()
  @IsEnum(DocumentMonitoringCategory)
  monitoringCategory?: DocumentMonitoringCategory;

  /*
  |--------------------------------------------------------------------------
  | CURRENT DOCUMENT STATUS
  |--------------------------------------------------------------------------
  */

  @IsOptional()
  @IsString()
  status?: string;
}
