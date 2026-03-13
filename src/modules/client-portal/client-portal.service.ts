import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ClientPortalService {
  constructor(private readonly prisma: PrismaService) {}

  async getByToken(token: string) {
    const client = await this.prisma.client.findFirst({
      where: { portalToken: token },
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        portalToken: true,
        createdAt: true,
      },
    });

    if (!client) throw new NotFoundException('Client portal not found');

    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId: client.tenantId,
        clientId: client.id,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        number: true,
        publicId: true,
        status: true,
        issueDate: true,
        dueDate: true,
        total: true,
        amountPaid: true,
        createdAt: true,
      },
    });

    const receipts = await this.prisma.receipt.findMany({
      where: {
        tenantId: client.tenantId,
        invoice: {
          clientId: client.id,
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        number: true,
        amount: true,
        method: true,
        reference: true,
        createdAt: true,
        invoice: {
          select: {
            id: true,
            number: true,
          },
        },
      },
    });

    const totalInvoiced = invoices.reduce(
      (sum, inv) => sum + (inv.total ?? 0),
      0,
    );
    const totalPaid = receipts.reduce((sum, r) => sum + (r.amount ?? 0), 0);
    const outstanding = Math.max(0, totalInvoiced - totalPaid);

    return {
      client,
      summary: {
        invoicesCount: invoices.length,
        receiptsCount: receipts.length,
        totalInvoiced,
        totalPaid,
        outstanding,
      },
      invoices,
      receipts,
    };
  }
}
