import { IsEnum, IsOptional } from 'class-validator';

export enum CurrencyCodeDto {
  ZMW = 'ZMW',
  USD = 'USD',
  ZAR = 'ZAR',
  EUR = 'EUR',
  GBP = 'GBP',
}

export class ConvertQuoteDto {
  @IsOptional()
  @IsEnum(CurrencyCodeDto)
  currencyCode?: CurrencyCodeDto;
}
