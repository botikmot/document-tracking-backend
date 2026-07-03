import { IsOptional, IsString } from 'class-validator';

export class RegisterUserDto {
  @IsString()
  userId!: string;

  @IsString()
  firstName!: string;

  @IsOptional()
  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  office?: string;

  @IsOptional()
  @IsString()
  profileImage?: string;
}
