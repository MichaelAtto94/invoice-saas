import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewUpgradePaymentDto {
  @IsString()
  @IsIn(['CONFIRMED', 'REJECTED'])
  paymentStatus: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  planStartedAt?: string;

  @IsOptional()
  @IsString()
  planExpiresAt?: string;
}
