import { IsEmail, IsString } from 'class-validator';

export class LoginClientDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
