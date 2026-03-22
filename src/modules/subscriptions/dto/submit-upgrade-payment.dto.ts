import { IsIn, IsOptional, IsString } from 'class-validator';

export class SubmitUpgradePaymentDto {
  @IsString()
  @IsIn(['MOBILE_MONEY', 'BANK_TRANSFER', 'CASH', 'OTHER'])
  paymentMethod: string;

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsString()
  paymentProofUrl?: string;

  @IsOptional()
  @IsString()
  paymentNotes?: string;
}
