export class UpdateTenantDto {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  currencyCode?: 'ZMW' | 'USD' | 'ZAR' | 'EUR' | 'GBP';

  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  branchName?: string;
  airtelMoneyNumber?: string;
  mtnMoneyNumber?: string;
  paymentDisplayName?: string;
}
