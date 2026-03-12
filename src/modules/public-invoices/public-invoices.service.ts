import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PublicInvoicesService {
  constructor(private prisma: PrismaService) {}

  async findByPublicId(publicId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { publicId },
      include: {
        client: true,
        lines: true,
        paymentAttempts: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            channel: true,
            amount: true,
            createdAt: true,
            reference: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    await this.prisma.invoiceView.create({
      data: {
        tenantId: invoice.tenantId,
        invoiceId: invoice.id,
        publicId: invoice.publicId!,
      },
    });

    const balance = Math.max(
      0,
      (invoice.total ?? 0) - (invoice.amountPaid ?? 0),
    );
    const isPaid = balance <= 0;

    return {
      ...invoice,
      payment: {
        enabled: !isPaid,
        balance,
        isPaid,
        allowedChannels: ['MOBILE_MONEY', 'BANK_TRANSFER', 'CASH', 'OTHER'],
        instructions: !isPaid
          ? 'Use the payment start endpoint to submit your payment.'
          : 'This invoice is fully paid.',
        startPaymentEndpoint: `/public/payments/start`,
        recentAttempts: invoice.paymentAttempts,
      },
    };
  }

  async findPdfDataByPublicId(publicId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { publicId },
      include: {
        client: true,
        lines: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: invoice.tenantId },
      select: {
        name: true,
        address: true,
        phone: true,
        email: true,
        logoUrl: true,
        currencyCode: true,
      },
    });

    return { invoice, tenant };
  }

  async getViewStats(publicId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { publicId },
      select: {
        id: true,
        tenantId: true,
        publicId: true,
        number: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const views = await this.prisma.invoiceView.findMany({
      where: { invoiceId: invoice.id },
      orderBy: { viewedAt: 'desc' },
      take: 20,
    });

    return {
      invoiceId: invoice.id,
      publicId: invoice.publicId,
      number: invoice.number,
      totalViews: views.length,
      lastViewedAt: views.length ? views[0].viewedAt : null,
      recentViews: views,
    };
  }
}
