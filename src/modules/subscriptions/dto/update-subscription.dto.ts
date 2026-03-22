import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsString()
  @IsIn(['FREE', 'BASIC', 'PRO'])
  planCode?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE'])
  subscriptionStatus?: string;

  @IsOptional()
  @IsString()
  planStartedAt?: string;

  @IsOptional()
  @IsString()
  planExpiresAt?: string;
}
