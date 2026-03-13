import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getRequestContext } from '../../common/context/request-context';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenantId(): string {
    const tenantId = getRequestContext()?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Missing tenant context');
    return tenantId;
  }

  async analytics() {
    const tenantId = this.requireTenantId();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [clientsCount, invoices, receipts, recurringCount, paymentAttempts] =
      await Promise.all([
        this.prisma.client.count({
          where: { tenantId },
        }),

        this.prisma.invoice.findMany({
          where: { tenantId },
          select: {
            id: true,
            status: true,
            total: true,
            amountPaid: true,
            dueDate: true,
            createdAt: true,
          },
        }),

        this.prisma.receipt.findMany({
          where: { tenantId },
          select: {
            id: true,
            amount: true,
            createdAt: true,
          },
        }),

        this.prisma.recurringInvoice.count({
          where: { tenantId },
        }),

        this.prisma.paymentAttempt.findMany({
          where: { tenantId },
          select: {
            id: true,
            status: true,
            amount: true,
            channel: true,
            createdAt: true,
          },
        }),
      ]);

    const invoicesCount = invoices.length;
    const receiptsCount = receipts.length;
    const paymentAttemptsCount = paymentAttempts.length;

    const totalInvoiced = invoices.reduce(
      (sum, inv) => sum + (inv.total ?? 0),
      0,
    );
    const totalPaid = receipts.reduce((sum, r) => sum + (r.amount ?? 0), 0);
    const outstanding = Math.max(0, totalInvoiced - totalPaid);

    const overdueInvoices = invoices.filter(
      (inv) =>
        inv.dueDate &&
        new Date(inv.dueDate).getTime() < Date.now() &&
        inv.status !== 'PAID' &&
        inv.status !== 'VOID',
    );

    const overdueCount = overdueInvoices.length;
    const overdueAmount = overdueInvoices.reduce((sum, inv) => {
      const balance = Math.max(0, (inv.total ?? 0) - (inv.amountPaid ?? 0));
      return sum + balance;
    }, 0);

    const revenueThisMonth = receipts
      .filter((r) => r.createdAt >= monthStart)
      .reduce((sum, r) => sum + (r.amount ?? 0), 0);

    const invoicedThisMonth = invoices
      .filter((inv) => inv.createdAt >= monthStart)
      .reduce((sum, inv) => sum + (inv.total ?? 0), 0);

    const paymentsThisMonth = paymentAttempts.filter(
      (p) => p.createdAt >= monthStart,
    );

    const paymentChannelsMap: Record<
      string,
      { channel: string; count: number; amount: number }
    > = {};

    for (const p of paymentAttempts) {
      const key = p.channel;
      if (!paymentChannelsMap[key]) {
        paymentChannelsMap[key] = {
          channel: key,
          count: 0,
          amount: 0,
        };
      }

      paymentChannelsMap[key].count += 1;
      paymentChannelsMap[key].amount += p.amount ?? 0;
    }

    const paymentChannels = Object.values(paymentChannelsMap).sort(
      (a, b) => b.amount - a.amount,
    );

    return {
      totals: {
        clientsCount,
        invoicesCount,
        receiptsCount,
        recurringCount,
        paymentAttemptsCount,
        totalInvoiced,
        totalPaid,
        outstanding,
      },
      thisMonth: {
        invoiced: invoicedThisMonth,
        revenue: revenueThisMonth,
        paymentAttempts: paymentsThisMonth.length,
      },
      overdue: {
        count: overdueCount,
        amount: overdueAmount,
      },
      paymentChannels,
    };
  }

  async exportPack() {
    const tenantId = this.requireTenantId();

    const [
      tenant,
      clients,
      items,
      quotes,
      invoices,
      receipts,
      recurringInvoices,
    ] = await Promise.all([
      this.prisma.tenant.findFirst({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          slug: true,
          currencyCode: true,
          address: true,
          phone: true,
          email: true,
          logoUrl: true,
          createdAt: true,
        },
      }),

      this.prisma.client.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),

      this.prisma.item.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),

      this.prisma.quote.findMany({
        where: { tenantId },
        include: {
          lines: true,
          client: true,
        },
        orderBy: { createdAt: 'desc' },
      }),

      this.prisma.invoice.findMany({
        where: { tenantId },
        include: {
          lines: true,
          client: true,
          receipts: true,
        },
        orderBy: { createdAt: 'desc' },
      }),

      this.prisma.receipt.findMany({
        where: { tenantId },
        include: {
          invoice: true,
        },
        orderBy: { createdAt: 'desc' },
      }),

      this.prisma.recurringInvoice.findMany({
        where: { tenantId },
        include: {
          lines: true,
          client: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      tenant,
      counts: {
        clients: clients.length,
        items: items.length,
        quotes: quotes.length,
        invoices: invoices.length,
        receipts: receipts.length,
        recurringInvoices: recurringInvoices.length,
      },
      data: {
        clients,
        items,
        quotes,
        invoices,
        receipts,
        recurringInvoices,
      },
    };
  }
}
