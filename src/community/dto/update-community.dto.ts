import { IsOptional } from 'class-validator';

export class UpdateCommunityDto {
  @IsOptional()
  name?: string;

  @IsOptional()
  description?: string;

  @IsOptional()
  isPrivate?: boolean;
}
