import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class CreateTenantUserDto {
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;

  @IsNotEmpty()
  roleName: string; // OWNER | ADMIN | STAFF
}
