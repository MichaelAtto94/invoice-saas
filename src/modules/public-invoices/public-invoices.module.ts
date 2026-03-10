import { Module } from '@nestjs/common';
import { PublicInvoicesController } from './public-invoices.controller';
import { PublicInvoicesService } from './public-invoices.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [PublicInvoicesController],
  providers: [PublicInvoicesService, PrismaService],
})
export class PublicInvoicesModule {}
