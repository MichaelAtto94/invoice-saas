import { IsIn, IsOptional, IsString } from 'class-validator';

export class RequestUpgradeDto {
  @IsString()
  @IsIn(['BASIC', 'PRO'])
  requestedPlanCode: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
