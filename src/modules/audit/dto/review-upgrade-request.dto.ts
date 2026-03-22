import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewUpgradeRequestDto {
  @IsString()
  @IsIn(['APPROVED', 'REJECTED'])
  status: string;

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
