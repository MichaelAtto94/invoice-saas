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
}
