import { IsEmail } from 'class-validator';

export class ResendClientVerificationDto {
  @IsEmail()
  email!: string;
}
