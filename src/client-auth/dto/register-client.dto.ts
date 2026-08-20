import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterClientDto {
  @IsString()
  firstName!: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  suffix?: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  mobileNumber?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  organizationName?: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
