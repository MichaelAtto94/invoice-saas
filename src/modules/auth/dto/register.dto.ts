export class RegisterDto {
  companyName: string; // Tenant name
  companySlug: string; // unique e.g. "cloudmotion"
  ownerFullName: string;
  ownerEmail: string;
  ownerPassword: string;
}
