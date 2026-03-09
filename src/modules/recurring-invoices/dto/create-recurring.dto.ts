export class CreateRecurringDto {
  clientId: string;
  name: string;

  interval: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  intervalCount?: number;

  nextRunDate: string;

  issueDays?: number;
  dueDays?: number;

  lines: {
    itemId?: string;
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    costPrice?: number;
  }[];
}
