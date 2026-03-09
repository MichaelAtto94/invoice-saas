export class SetRateDto {
  from: 'ZMW' | 'USD' | 'ZAR' | 'EUR' | 'GBP';
  to: 'ZMW' | 'USD' | 'ZAR' | 'EUR' | 'GBP';
  rate: number; // e.g 27.35 means 1 from = 27.35 to
  asOfDate?: string; // ISO date optional
}
