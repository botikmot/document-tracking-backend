import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectClientApplicationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}
