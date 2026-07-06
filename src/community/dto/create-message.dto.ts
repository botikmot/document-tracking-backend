import { IsString, IsOptional } from 'class-validator';

export class CreateMessageDto {
  @IsOptional()
  @IsString()
  message!: string;
}
