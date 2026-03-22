import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './pdf/invoice-pdf.service';
import { PrismaService } from '../../database/prisma.service';
import { MailerModule } from '../mailer/mailer.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [MailerModule, SubscriptionsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicePdfService, PrismaService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
