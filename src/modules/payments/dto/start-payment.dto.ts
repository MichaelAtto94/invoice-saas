export class StartPaymentDto {
  invoicePublicId!: string;
  channel!: 'MOBILE_MONEY' | 'BANK_TRANSFER' | 'CASH' | 'OTHER';
  amount!: number;
  payerName?: string;
  payerPhone?: string;
}
