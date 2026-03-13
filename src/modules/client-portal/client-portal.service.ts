import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { buildClientStatementPdf } from '../../common/pdf/client-statement-pdf';

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

  async getStatementPdfByToken(token: string) {
    const data = await this.getByToken(token);

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: data.client.tenantId },
      select: {
        name: true,
        currencyCode: true,
        address: true,
        phone: true,
        email: true,
        logoUrl: true,
      },
    });

    const buffer = await buildClientStatementPdf({
      company: {
        name: tenant?.name ?? 'Company',
        address: tenant?.address ?? null,
        phone: tenant?.phone ?? null,
        email: tenant?.email ?? null,
        logoUrl: tenant?.logoUrl ?? null,
      },
      client: {
        name: data.client.name,
        email: data.client.email,
        phone: data.client.phone,
        address: data.client.address,
      },
      period: {
        from: null,
        to: null,
      },
      summary: {
        openingBalance: 0,
        invoiceTotal: data.summary.totalInvoiced,
        receiptTotal: data.summary.totalPaid,
        closingBalance: data.summary.outstanding,
      },
      invoices: data.invoices.map((inv) => ({
        number: inv.number,
        status: inv.status,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        baseTotal: inv.total,
        amountPaid: inv.amountPaid,
      })),
      receipts: data.receipts.map((r) => ({
        number: r.number,
        amount: r.amount,
        method: r.method,
        reference: r.reference,
        createdAt: r.createdAt,
        invoice: r.invoice
          ? {
              number: r.invoice.number,
            }
          : null,
      })),
      currencyCode: tenant?.currencyCode ?? 'ZMW',
    });

    return {
      filename: `client-statement-${data.client.name}.pdf`,
      buffer,
    };
  }
}
