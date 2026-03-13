import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getRequestContext } from '../../common/context/request-context';
import { BadRequestException } from '@nestjs/common';
import { ImportPackDto } from './dto/import-pack.dto';

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

  async importPack(dto: ImportPackDto) {
    const tenantId = this.requireTenantId();

    if (!dto?.data) {
      throw new BadRequestException('data is required');
    }

    const clients = dto.data.clients ?? [];
    const items = dto.data.items ?? [];
    const quotes = dto.data.quotes ?? [];
    const invoices = dto.data.invoices ?? [];
    const receipts = dto.data.receipts ?? [];
    const recurringInvoices = dto.data.recurringInvoices ?? [];

    let importedClients = 0;
    let importedItems = 0;
    let importedQuotes = 0;
    let importedInvoices = 0;
    let importedReceipts = 0;
    let importedRecurring = 0;

    // 1) Clients
    for (const c of clients) {
      const exists = await this.prisma.client.findFirst({
        where: {
          tenantId,
          OR: [{ email: c.email ?? undefined }, { name: c.name }],
        },
        select: { id: true },
      });

      if (exists) continue;

      await this.prisma.client.create({
        data: {
          tenantId,
          name: c.name,
          email: c.email ?? null,
          phone: c.phone ?? null,
          address: c.address ?? null,
          portalToken: c.portalToken ?? null,
        },
      });

      importedClients++;
    }

    // 2) Items
    for (const item of items) {
      const exists = await this.prisma.item.findFirst({
        where: {
          tenantId,
          name: item.name,
        },
        select: { id: true },
      });

      if (exists) continue;

      await this.prisma.item.create({
        data: {
          tenantId,
          name: item.name,
          description: item.description ?? null,
          unitPrice: item.unitPrice ?? 0,
          costPrice: item.costPrice ?? 0,
        },
      });

      importedItems++;
    }

    // 3) Quotes
    for (const q of quotes) {
      const exists = await this.prisma.quote.findFirst({
        where: {
          tenantId,
          number: q.number,
        },
        select: { id: true },
      });

      if (exists) continue;

      const client = await this.prisma.client.findFirst({
        where: {
          tenantId,
          name: q.client?.name ?? '',
        },
        select: { id: true },
      });

      if (!client) continue;

      await this.prisma.quote.create({
        data: {
          tenantId,
          number: q.number,
          clientId: client.id,
          status: q.status ?? 'DRAFT',
          issueDate: q.issueDate ? new Date(q.issueDate) : new Date(),
          dueDate: q.dueDate ? new Date(q.dueDate) : null,
          notes: q.notes ?? null,
          subtotal: q.subtotal ?? 0,
          taxTotal: q.taxTotal ?? 0,
          total: q.total ?? 0,
          lines: {
            create: (q.lines ?? []).map((l: any) => ({
              tenantId,
              itemId: null,
              name: l.name,
              description: l.description ?? null,
              quantity: l.quantity ?? 1,
              unitPrice: l.unitPrice ?? 0,
              costPrice: l.costPrice ?? 0,
              lineTotal: l.lineTotal ?? 0,
            })),
          },
        },
      });

      importedQuotes++;
    }

    // 4) Invoices
    for (const inv of invoices) {
      const exists = await this.prisma.invoice.findFirst({
        where: {
          tenantId,
          number: inv.number,
        },
        select: { id: true },
      });

      if (exists) continue;

      const client = await this.prisma.client.findFirst({
        where: {
          tenantId,
          name: inv.client?.name ?? '',
        },
        select: { id: true },
      });

      if (!client) continue;

      await this.prisma.invoice.create({
        data: {
          tenantId,
          number: inv.number,
          publicId:
            inv.publicId ??
            `inv_import_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          clientId: client.id,
          status: inv.status ?? 'DRAFT',
          currencyCode: inv.currencyCode ?? 'ZMW',
          issueDate: inv.issueDate ? new Date(inv.issueDate) : new Date(),
          dueDate: inv.dueDate ? new Date(inv.dueDate) : null,
          subtotal: inv.subtotal ?? 0,
          taxTotal: inv.taxTotal ?? 0,
          total: inv.total ?? 0,
          baseTotal: inv.baseTotal ?? inv.total ?? 0,
          amountPaid: inv.amountPaid ?? 0,
          lines: {
            create: (inv.lines ?? []).map((l: any) => ({
              tenantId,
              itemId: null,
              name: l.name,
              description: l.description ?? null,
              quantity: l.quantity ?? 1,
              unitPrice: l.unitPrice ?? 0,
              costPrice: l.costPrice ?? 0,
              lineTotal: l.lineTotal ?? 0,
            })),
          },
        },
      });

      importedInvoices++;
    }

    // 5) Receipts
    for (const r of receipts) {
      const exists = await this.prisma.receipt.findFirst({
        where: {
          tenantId,
          number: r.number,
        },
        select: { id: true },
      });

      if (exists) continue;

      const invoice = await this.prisma.invoice.findFirst({
        where: {
          tenantId,
          number: r.invoice?.number ?? '',
        },
        select: { id: true },
      });

      if (!invoice) continue;

      await this.prisma.receipt.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          number: r.number,
          amount: r.amount ?? 0,
          method: r.method ?? 'OTHER',
          reference: r.reference ?? null,
          notes: r.notes ?? null,
        },
      });

      importedReceipts++;
    }

    // 6) Recurring invoices
    for (const ri of recurringInvoices) {
      const exists = await this.prisma.recurringInvoice.findFirst({
        where: {
          tenantId,
          name: ri.name,
        },
        select: { id: true },
      });

      if (exists) continue;

      const client = await this.prisma.client.findFirst({
        where: {
          tenantId,
          name: ri.client?.name ?? '',
        },
        select: { id: true },
      });

      if (!client) continue;

      await this.prisma.recurringInvoice.create({
        data: {
          tenantId,
          clientId: client.id,
          name: ri.name,
          currencyCode: ri.currencyCode ?? 'ZMW',
          interval: ri.interval ?? 'MONTHLY',
          intervalCount: ri.intervalCount ?? 1,
          nextRunDate: ri.nextRunDate ? new Date(ri.nextRunDate) : new Date(),
          issueDays: ri.issueDays ?? 0,
          dueDays: ri.dueDays ?? 7,
          active: ri.active ?? true,
          subtotal: ri.subtotal ?? 0,
          taxTotal: ri.taxTotal ?? 0,
          total: ri.total ?? 0,
          lines: {
            create: (ri.lines ?? []).map((l: any) => ({
              itemId: null,
              name: l.name,
              description: l.description ?? null,
              quantity: l.quantity ?? 1,
              unitPrice: l.unitPrice ?? 0,
              costPrice: l.costPrice ?? 0,
              lineTotal: l.lineTotal ?? 0,
            })),
          },
        },
      });

      importedRecurring++;
    }

    return {
      ok: true,
      imported: {
        clients: importedClients,
        items: importedItems,
        quotes: importedQuotes,
        invoices: importedInvoices,
        receipts: importedReceipts,
        recurringInvoices: importedRecurring,
      },
    };
  }
}
