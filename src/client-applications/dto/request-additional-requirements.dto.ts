import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RequestAdditionalRequirementsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  remarks!: string;
}
