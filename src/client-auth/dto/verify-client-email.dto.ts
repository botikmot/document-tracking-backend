import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyClientEmailDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
