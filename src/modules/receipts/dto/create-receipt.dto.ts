import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateReceiptDto {
  @IsUUID()
  invoiceId: string;

  @IsInt()
  @Min(1)
  amount: number; // cents

  @IsOptional()
  @IsEnum(['CASH', 'MOBILE_MONEY', 'BANK', 'CARD'] as const)
  method?: 'CASH' | 'MOBILE_MONEY' | 'BANK' | 'CARD';

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  receivedAt?: string; // ISO date
}
