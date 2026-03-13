export class UpdateRecurringDto {
  name?: string;
  interval?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  intervalCount?: number;
  nextRunDate?: string;
  issueDays?: number;
  dueDays?: number;
  active?: boolean;
}
