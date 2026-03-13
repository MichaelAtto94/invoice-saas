import { Module } from '@nestjs/common';
import { ClientPortalController } from './client-portal.controller';
import { ClientPortalService } from './client-portal.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [ClientPortalController],
  providers: [ClientPortalService, PrismaService],
})
export class ClientPortalModule {}
