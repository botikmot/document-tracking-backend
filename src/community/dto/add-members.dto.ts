import { ArrayUnique, IsArray, IsString } from 'class-validator';

export class AddMembersDto {
  @IsArray()
  @ArrayUnique()
  @IsString({
    each: true,
  })
  memberIds!: string[];
}
