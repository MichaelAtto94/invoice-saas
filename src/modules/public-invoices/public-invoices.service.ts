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

    return invoice;
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
