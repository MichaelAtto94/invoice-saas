import { Module } from '@nestjs/common';
import { RecurringInvoicesService } from './recurring-invoices.service';
import { RecurringInvoicesController } from './recurring-invoices.controller';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [RecurringInvoicesController],
  providers: [RecurringInvoicesService, PrismaService],
})
export class RecurringInvoicesModule {}
