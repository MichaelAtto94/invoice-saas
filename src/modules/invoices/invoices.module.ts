import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { MailerService } from '../../common/mailer/mailer.service';

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, MailerService],
})
export class InvoicesModule {}
