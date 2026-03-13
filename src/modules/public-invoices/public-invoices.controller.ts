import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PublicInvoicesService } from './public-invoices.service';
import { buildInvoicePdf } from '../../common/pdf/invoice-pdf';
import { Throttle } from '@nestjs/throttler';

@Controller('public/invoices')
export class PublicInvoicesController {
  constructor(private readonly service: PublicInvoicesService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':publicId')
  getInvoice(@Param('publicId') publicId: string) {
    return this.service.findByPublicId(publicId);
  }

  @Get(':publicId/views')
  getInvoiceViews(@Param('publicId') publicId: string) {
    return this.service.getViewStats(publicId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':publicId/pdf')
  async getInvoicePdf(
    @Param('publicId') publicId: string,
    @Res() res: Response,
  ) {
    const { invoice, tenant } =
      await this.service.findPdfDataByPublicId(publicId);

    const buffer = await buildInvoicePdf({
      company: {
        name: tenant?.name ?? 'Company',
        address: tenant?.address ?? null,
        phone: tenant?.phone ?? null,
        email: tenant?.email ?? null,
        logoUrl: tenant?.logoUrl ?? null,
      },
      invoiceNumber: invoice.number,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      currencyCode: invoice.currencyCode,
      clientName: invoice.client.name,
      clientEmail: invoice.client.email,
      clientPhone: invoice.client.phone,
      clientAddress: invoice.client.address,
      subtotal: invoice.subtotal,
      taxTotal: invoice.taxTotal,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      lines: invoice.lines.map((l) => ({
        name: l.name,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
      })),
    });

    const filename = `${invoice.number}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    return res.end(buffer);
  }
}
