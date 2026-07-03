import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreateCommunityDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsBoolean()
  isPrivate!: boolean;
}
