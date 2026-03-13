import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ClientPortalService } from './client-portal.service';
import { Throttle } from '@nestjs/throttler';

@Controller('public/client-portal')
export class ClientPortalController {
  constructor(private readonly portal: ClientPortalService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get(':token')
  getPortal(@Param('token') token: string) {
    return this.portal.getByToken(token);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get(':token/statement.pdf')
  async getStatementPdf(@Param('token') token: string, @Res() res: Response) {
    const { filename, buffer } =
      await this.portal.getStatementPdfByToken(token);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    return res.end(buffer);
  }

  @Get(':token/invoices')
  listInvoices(@Param('token') token: string) {
    return this.portal.listInvoicesByToken(token);
  }

  @Get(':token/invoices/:publicId')
  getInvoice(
    @Param('token') token: string,
    @Param('publicId') publicId: string,
  ) {
    return this.portal.getInvoiceByTokenAndPublicId(token, publicId);
  }

  @Get(':token/invoices/:publicId/pdf')
  async getInvoicePdf(
    @Param('token') token: string,
    @Param('publicId') publicId: string,
    @Res() res: Response,
  ) {
    const { filename, buffer } =
      await this.portal.getInvoicePdfByTokenAndPublicId(token, publicId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    return res.end(buffer);
  }
}
