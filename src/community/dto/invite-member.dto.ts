import { IsString } from 'class-validator';

export class InviteMemberDto {
  @IsString()
  userId!: string;
}
