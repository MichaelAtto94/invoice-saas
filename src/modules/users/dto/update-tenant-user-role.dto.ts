import { IsNotEmpty } from 'class-validator';

export class UpdateTenantUserRoleDto {
  @IsNotEmpty()
  userId: string;

  @IsNotEmpty()
  roleName: string; // OWNER | ADMIN | STAFF
}
