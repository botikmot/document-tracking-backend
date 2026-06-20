import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export enum ReportType {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
  CUSTOM = 'custom',
}

export class ReportFilterDto {
  @IsEnum(ReportType)
  type!: ReportType;

  /*
  |--------------------------------------------------------------------------
  | Monthly / Quarterly / Annual
  |--------------------------------------------------------------------------
  */

  @ValidateIf(
    (o: ReportFilterDto) =>
      o.type === ReportType.MONTHLY ||
      o.type === ReportType.QUARTERLY ||
      o.type === ReportType.ANNUAL,
  )
  @Type(() => Number)
  @IsInt()
  year?: number;

  @ValidateIf((o: ReportFilterDto) => o.type === ReportType.MONTHLY)
  @Type(() => Number)
  @Min(1)
  @Max(12)
  month?: number;

  @ValidateIf((o: ReportFilterDto) => o.type === ReportType.QUARTERLY)
  @Type(() => Number)
  @Min(1)
  @Max(4)
  quarter?: number;

  /*
  |--------------------------------------------------------------------------
  | Custom Date Range
  |--------------------------------------------------------------------------
  */

  @ValidateIf((o: ReportFilterDto) => o.type === ReportType.CUSTOM)
  @IsDateString()
  startDate?: string;

  @ValidateIf((o: ReportFilterDto) => o.type === ReportType.CUSTOM)
  @IsDateString()
  endDate?: string;

  /*
  |--------------------------------------------------------------------------
  | Filters
  |--------------------------------------------------------------------------
  */

  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value) ? value : value ? [value] : undefined,
  )
  officeIds?: string[];

  @IsOptional()
  @IsString()
  documentTypeId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
