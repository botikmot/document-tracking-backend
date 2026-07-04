import {
  IsOptional,
  IsString,
  IsBoolean,
  IsArray,
  ArrayUnique,
} from 'class-validator';

export class CreateCommunityDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsBoolean()
  isPrivate!: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  memberIds?: string[];
}
