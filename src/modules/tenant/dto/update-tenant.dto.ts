export class UpdateTenantDto {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  currencyCode?: 'ZMW' | 'USD' | 'ZAR' | 'EUR' | 'GBP';
}
