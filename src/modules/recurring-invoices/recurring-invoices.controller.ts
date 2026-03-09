import { Body, Controller, Post } from '@nestjs/common';
import { RecurringInvoicesService } from './recurring-invoices.service';
import { CreateRecurringDto } from './dto/create-recurring.dto';

@Controller('recurring-invoices')
export class RecurringInvoicesController {
  constructor(private readonly service: RecurringInvoicesService) {}

  @Post()
  create(@Body() dto: CreateRecurringDto) {
    return this.service.create(dto);
  }

  @Post('run')
  run() {
    return this.service.runRecurring();
  }
}
