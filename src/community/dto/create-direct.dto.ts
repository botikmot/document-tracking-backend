import { IsString } from 'class-validator';

export class CreateDirectDto {
  @IsString()
  targetUserId!: string;
}
