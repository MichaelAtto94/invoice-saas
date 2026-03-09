import { Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [TenantController],
  providers: [TenantService, PrismaService],
})
export class TenantModule {}
