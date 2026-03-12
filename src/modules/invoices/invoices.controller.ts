import { Controller, Get, Param, Res, Post, StreamableFile } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { InvoicesService } from './invoices.service';
import type { Response } from 'express';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get()
  list() {
    return this.invoices.list();
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get(':id')
  get(@Param('id') id: string) {
    return this.invoices.getById(id);
  }

  // ✅ PUT THIS HERE (PDF ROUTE)
  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get(':id/pdf')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const { filename, buffer } = await this.invoices.buildInvoicePdf(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    //console.log('PDF buffer length:', buffer.length);
    //console.log('PDF first bytes:', buffer.subarray(0, 10).toString());

    return res.end(buffer); // ✅ important
  }

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Post(':id/send')
  send(@Param('id') id: string) {
    return this.invoices.sendInvoice(id);
  }

  @Post(':id/email')
  email(@Param('id') id: string) {
    return this.invoices.emailInvoice(id);
  }

  @Get(':id/activity')
  activity(@Param('id') id: string) {
    return this.invoices.getInvoiceActivity(id);
  }

  @Get(':id/payments')
  payments(@Param('id') id: string) {
    return this.invoices.getInvoicePayments(id);
  }
}
