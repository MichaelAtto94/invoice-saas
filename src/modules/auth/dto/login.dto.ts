export class LoginDto {
  email: string;
  password: string;
  tenantSlug: string; // user selects which company to login into
}
