import { IsBoolean, IsNotEmpty } from 'class-validator';

export class SetUserActiveStatusDto {
  @IsNotEmpty()
  userId: string;

  @IsBoolean()
  isActive: boolean;
}
