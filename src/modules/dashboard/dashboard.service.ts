import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getRequestContext } from '../../common/context/request-context';

function formatMoney(cents: number, currencyCode: string) {
  const amount = (cents ?? 0) / 100;
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(amount);
}

function pctChange(current: number, previous: number) {
  if (previous <= 0 && current <= 0) return 0;
  if (previous <= 0 && current > 0) return 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenantId(): string {
    const tenantId = getRequestContext()?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Missing tenant context');
    return tenantId;
  }

  private startOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  private addMonths(d: Date, months: number) {
    return new Date(d.getFullYear(), d.getMonth() + months, 1);
  }

  async stats() {
    const tenantId = this.requireTenantId();

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { currencyCode: true, name: true },
    });
    const currencyCode = tenant?.currencyCode ?? 'ZMW';

    // 1) All-time totals in base currency
    const [invoiceAgg, receiptAgg, taxAgg] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { tenantId },
        _sum: { baseTotal: true },
        _count: { _all: true },
      }),
      this.prisma.receipt.aggregate({
        where: { tenantId },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.aggregate({
        where: { tenantId },
        _sum: { taxTotal: true },
      }),
    ]);

    const totalInvoiced = invoiceAgg._sum.baseTotal ?? 0;
    const totalReceipted = receiptAgg._sum.amount ?? 0;
    const outstanding = Math.max(0, totalInvoiced - totalReceipted);
    const taxCollectedAllTime = taxAgg._sum.taxTotal ?? 0;

    // 2) Status breakdown in base currency
    const statuses = await this.prisma.invoice.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { _all: true },
      _sum: { baseTotal: true },
    });

    // 3) Revenue and tax last 6 months
    const now = new Date();
    const from6 = this.startOfMonth(this.addMonths(now, -5));

    const [receipts, invoicesForTax] = await Promise.all([
      this.prisma.receipt.findMany({
        where: { tenantId, createdAt: { gte: from6 } },
        select: { amount: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.invoice.findMany({
        where: { tenantId, createdAt: { gte: from6 } },
        select: { taxTotal: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const monthBucketsRevenue: Record<string, number> = {};
    const monthBucketsTax: Record<string, number> = {};

    for (let i = 0; i < 6; i++) {
      const m = this.addMonths(this.startOfMonth(now), -5 + i);
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
      monthBucketsRevenue[key] = 0;
      monthBucketsTax[key] = 0;
    }

    for (const r of receipts) {
      const dt = r.createdAt;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      if (key in monthBucketsRevenue) monthBucketsRevenue[key] += r.amount ?? 0;
    }

    for (const inv of invoicesForTax) {
      const dt = inv.createdAt;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      if (key in monthBucketsTax) monthBucketsTax[key] += inv.taxTotal ?? 0;
    }

    const revenueLast6Months = Object.entries(monthBucketsRevenue).map(
      ([month, amount]) => ({
        month,
        amount,
        amountFormatted: formatMoney(amount, currencyCode),
      }),
    );

    const taxLast6Months = Object.entries(monthBucketsTax).map(
      ([month, amount]) => ({
        month,
        amount,
        amountFormatted: formatMoney(amount, currencyCode),
      }),
    );

    // 4) Top clients by invoiced total
    const lastInvoices = await this.prisma.invoice.findMany({
      where: { tenantId },
      select: {
        baseTotal: true,
        clientId: true,
        client: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const clientMap: Record<
      string,
      { clientId: string; name: string; total: number }
    > = {};

    for (const inv of lastInvoices) {
      const id = inv.clientId;
      if (!clientMap[id]) {
        clientMap[id] = {
          clientId: id,
          name: inv.client?.name ?? 'Client',
          total: 0,
        };
      }
      clientMap[id].total += inv.baseTotal ?? 0;
    }

    const topClients = Object.values(clientMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((c) => ({
        ...c,
        totalFormatted: formatMoney(c.total, currencyCode),
      }));

    // 5) Overdue summary
    const overdueAgg = await this.prisma.invoice.aggregate({
      where: {
        tenantId,
        dueDate: { lt: new Date() },
        status: { in: ['DRAFT', 'SENT', 'PARTIALLY_PAID'] },
      },
      _sum: { baseTotal: true },
      _count: { _all: true },
    });

    const overdueCount = overdueAgg._count._all ?? 0;
    const overdueTotal = overdueAgg._sum.baseTotal ?? 0;

    // 6) This month + comparisons
    const monthStart = this.startOfMonth(new Date());
    const lastMonthStart = this.startOfMonth(this.addMonths(new Date(), -1));
    const sameMonthLastYearStart = this.startOfMonth(
      new Date(new Date().getFullYear() - 1, new Date().getMonth(), 1),
    );

    const [
      thisMonthInvoicedAgg,
      thisMonthReceiptedAgg,
      thisMonthTaxAgg,
      lastMonthReceiptedAgg,
      lastYearSameMonthReceiptedAgg,
    ] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { tenantId, createdAt: { gte: monthStart } },
        _sum: { baseTotal: true },
        _count: { _all: true },
      }),
      this.prisma.receipt.aggregate({
        where: { tenantId, createdAt: { gte: monthStart } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.aggregate({
        where: { tenantId, createdAt: { gte: monthStart } },
        _sum: { taxTotal: true },
      }),
      this.prisma.receipt.aggregate({
        where: { tenantId, createdAt: { gte: lastMonthStart, lt: monthStart } },
        _sum: { amount: true },
      }),
      this.prisma.receipt.aggregate({
        where: {
          tenantId,
          createdAt: {
            gte: sameMonthLastYearStart,
            lt: this.addMonths(sameMonthLastYearStart, 1),
          },
        },
        _sum: { amount: true },
      }),
    ]);

    const thisMonthInvoiced = thisMonthInvoicedAgg._sum.baseTotal ?? 0;
    const thisMonthReceipted = thisMonthReceiptedAgg._sum.amount ?? 0;
    const taxCollectedThisMonth = thisMonthTaxAgg._sum.taxTotal ?? 0;

    const lastMonthReceipted = lastMonthReceiptedAgg._sum.amount ?? 0;
    const lastYearSameMonthReceipted =
      lastYearSameMonthReceiptedAgg._sum.amount ?? 0;

    const momRevenueChangePct = pctChange(
      thisMonthReceipted,
      lastMonthReceipted,
    );
    const yoyRevenueChangePct = pctChange(
      thisMonthReceipted,
      lastYearSameMonthReceipted,
    );

    // 7) Recent open invoices
    const recentOpenInvoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: { in: ['DRAFT', 'SENT', 'PARTIALLY_PAID'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        baseTotal: true,
        amountPaid: true,
        currencyCode: true,
        dueDate: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
      },
    });

    // 8) Profit summary
    const invoicesWithLines = await this.prisma.invoice.findMany({
      where: { tenantId },
      select: {
        lines: {
          select: {
            quantity: true,
            unitPrice: true,
            costPrice: true,
          },
        },
      },
      take: 500,
      orderBy: { createdAt: 'desc' },
    });

    let profitRevenue = 0;
    let profitCost = 0;

    for (const inv of invoicesWithLines) {
      for (const line of inv.lines) {
        const qty = line.quantity ?? 0;
        const revenue = (line.unitPrice ?? 0) * qty;
        const cost = (line.costPrice ?? 0) * qty;
        profitRevenue += revenue;
        profitCost += cost;
      }
    }

    const grossProfit = profitRevenue - profitCost;
    const marginPct =
      profitRevenue > 0
        ? Math.round((grossProfit / profitRevenue) * 1000) / 10
        : 0;

    // 9) Profit per client
    const invoicesForClientProfit = await this.prisma.invoice.findMany({
      where: { tenantId },
      select: {
        clientId: true,
        client: { select: { name: true } },
        lines: {
          select: {
            quantity: true,
            unitPrice: true,
            costPrice: true,
          },
        },
      },
      take: 1000,
      orderBy: { createdAt: 'desc' },
    });

    const clientProfitMap: Record<
      string,
      {
        clientId: string;
        name: string;
        revenue: number;
        cost: number;
      }
    > = {};

    for (const inv of invoicesForClientProfit) {
      const id = inv.clientId;

      if (!clientProfitMap[id]) {
        clientProfitMap[id] = {
          clientId: id,
          name: inv.client?.name ?? 'Client',
          revenue: 0,
          cost: 0,
        };
      }

      for (const line of inv.lines) {
        const qty = line.quantity ?? 0;
        const revenue = (line.unitPrice ?? 0) * qty;
        const cost = (line.costPrice ?? 0) * qty;

        clientProfitMap[id].revenue += revenue;
        clientProfitMap[id].cost += cost;
      }
    }

    const clientProfit = Object.values(clientProfitMap)
      .map((c) => {
        const profit = c.revenue - c.cost;
        const margin =
          c.revenue > 0 ? Math.round((profit / c.revenue) * 1000) / 10 : 0;

        return {
          clientId: c.clientId,
          name: c.name,
          revenue: c.revenue,
          revenueFormatted: formatMoney(c.revenue, currencyCode),
          cost: c.cost,
          costFormatted: formatMoney(c.cost, currencyCode),
          profit,
          profitFormatted: formatMoney(profit, currencyCode),
          marginPct: margin,
        };
      })
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);

    // 10) Profit per item
    const invoicesForItemProfit = await this.prisma.invoice.findMany({
      where: { tenantId },
      select: {
        lines: {
          select: {
            itemId: true,
            name: true,
            quantity: true,
            unitPrice: true,
            costPrice: true,
          },
        },
      },
      take: 1000,
      orderBy: { createdAt: 'desc' },
    });

    const itemProfitMap: Record<
      string,
      {
        itemId: string;
        name: string;
        revenue: number;
        cost: number;
        quantity: number;
      }
    > = {};

    for (const inv of invoicesForItemProfit) {
      for (const line of inv.lines) {
        const key = line.itemId ?? `manual:${line.name}`;
        if (!itemProfitMap[key]) {
          itemProfitMap[key] = {
            itemId: key,
            name: line.name ?? 'Item',
            revenue: 0,
            cost: 0,
            quantity: 0,
          };
        }

        const qty = line.quantity ?? 0;
        const revenue = (line.unitPrice ?? 0) * qty;
        const cost = (line.costPrice ?? 0) * qty;

        itemProfitMap[key].revenue += revenue;
        itemProfitMap[key].cost += cost;
        itemProfitMap[key].quantity += qty;
      }
    }

    const itemProfit = Object.values(itemProfitMap)
      .map((i) => {
        const profit = i.revenue - i.cost;
        const margin =
          i.revenue > 0 ? Math.round((profit / i.revenue) * 1000) / 10 : 0;

        return {
          itemId: i.itemId,
          name: i.name,
          quantity: i.quantity,
          revenue: i.revenue,
          revenueFormatted: formatMoney(i.revenue, currencyCode),
          cost: i.cost,
          costFormatted: formatMoney(i.cost, currencyCode),
          profit,
          profitFormatted: formatMoney(profit, currencyCode),
          marginPct: margin,
        };
      })
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);

    // 11) Monthly profit trend
    const fromProfit = this.startOfMonth(this.addMonths(new Date(), -5));

    const invoicesForMonthlyProfit = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        createdAt: { gte: fromProfit },
      },
      select: {
        createdAt: true,
        lines: {
          select: {
            quantity: true,
            unitPrice: true,
            costPrice: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const monthlyProfitBuckets: Record<
      string,
      { revenue: number; cost: number; profit: number }
    > = {};

    for (let i = 0; i < 6; i++) {
      const m = this.addMonths(this.startOfMonth(new Date()), -5 + i);
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
      monthlyProfitBuckets[key] = { revenue: 0, cost: 0, profit: 0 };
    }

    for (const inv of invoicesForMonthlyProfit) {
      const dt = inv.createdAt;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;

      if (!(key in monthlyProfitBuckets)) continue;

      for (const line of inv.lines) {
        const qty = line.quantity ?? 0;
        const revenue = (line.unitPrice ?? 0) * qty;
        const cost = (line.costPrice ?? 0) * qty;

        monthlyProfitBuckets[key].revenue += revenue;
        monthlyProfitBuckets[key].cost += cost;
        monthlyProfitBuckets[key].profit += revenue - cost;
      }
    }

    const profitLast6Months = Object.entries(monthlyProfitBuckets).map(
      ([month, vals]) => ({
        month,
        revenue: vals.revenue,
        revenueFormatted: formatMoney(vals.revenue, currencyCode),
        cost: vals.cost,
        costFormatted: formatMoney(vals.cost, currencyCode),
        profit: vals.profit,
        profitFormatted: formatMoney(vals.profit, currencyCode),
      }),
    );

    // 12) Aging
    const openInvoicesForAging = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        dueDate: { not: null, lt: new Date() },
        status: { in: ['DRAFT', 'SENT', 'PARTIALLY_PAID'] },
      },
      select: {
        id: true,
        number: true,
        dueDate: true,
        baseTotal: true,
        amountPaid: true,
        client: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const aging = {
      bucket_0_30: { count: 0, amount: 0 },
      bucket_31_60: { count: 0, amount: 0 },
      bucket_61_90: { count: 0, amount: 0 },
      bucket_90_plus: { count: 0, amount: 0 },
      invoices: [] as Array<{
        id: string;
        number: string;
        clientName: string;
        dueDate: Date | null;
        daysOverdue: number;
        balance: number;
        balanceFormatted: string;
      }>,
    };

    const today = new Date();

    for (const inv of openInvoicesForAging) {
      if (!inv.dueDate) continue;

      const msPerDay = 1000 * 60 * 60 * 24;
      const daysOverdue = Math.floor(
        (today.getTime() - inv.dueDate.getTime()) / msPerDay,
      );

      const balance = Math.max(0, (inv.baseTotal ?? 0) - (inv.amountPaid ?? 0));
      if (balance <= 0) continue;

      if (daysOverdue <= 30) {
        aging.bucket_0_30.count += 1;
        aging.bucket_0_30.amount += balance;
      } else if (daysOverdue <= 60) {
        aging.bucket_31_60.count += 1;
        aging.bucket_31_60.amount += balance;
      } else if (daysOverdue <= 90) {
        aging.bucket_61_90.count += 1;
        aging.bucket_61_90.amount += balance;
      } else {
        aging.bucket_90_plus.count += 1;
        aging.bucket_90_plus.amount += balance;
      }

      aging.invoices.push({
        id: inv.id,
        number: inv.number,
        clientName: inv.client?.name ?? 'Client',
        dueDate: inv.dueDate,
        daysOverdue,
        balance,
        balanceFormatted: formatMoney(balance, currencyCode),
      });
    }

    const agingSummary = {
      bucket_0_30: {
        ...aging.bucket_0_30,
        amountFormatted: formatMoney(aging.bucket_0_30.amount, currencyCode),
      },
      bucket_31_60: {
        ...aging.bucket_31_60,
        amountFormatted: formatMoney(aging.bucket_31_60.amount, currencyCode),
      },
      bucket_61_90: {
        ...aging.bucket_61_90,
        amountFormatted: formatMoney(aging.bucket_61_90.amount, currencyCode),
      },
      bucket_90_plus: {
        ...aging.bucket_90_plus,
        amountFormatted: formatMoney(aging.bucket_90_plus.amount, currencyCode),
      },
      invoices: aging.invoices,
    };

    // 13) Collections
    const unpaidInvoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: { in: ['DRAFT', 'SENT', 'PARTIALLY_PAID'] },
      },
      select: {
        id: true,
        number: true,
        status: true,
        dueDate: true,
        baseTotal: true,
        amountPaid: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const nowDate = new Date();
    const collectionPriority = unpaidInvoices
      .map((inv) => {
        const balance = Math.max(
          0,
          (inv.baseTotal ?? 0) - (inv.amountPaid ?? 0),
        );

        let daysOverdue = 0;
        if (inv.dueDate) {
          const msPerDay = 1000 * 60 * 60 * 24;
          daysOverdue = Math.max(
            0,
            Math.floor((nowDate.getTime() - inv.dueDate.getTime()) / msPerDay),
          );
        }

        const priorityScore = balance + daysOverdue * 1000;

        return {
          id: inv.id,
          number: inv.number,
          status: inv.status,
          clientId: inv.client?.id ?? null,
          clientName: inv.client?.name ?? 'Client',
          dueDate: inv.dueDate,
          daysOverdue,
          balance,
          balanceFormatted: formatMoney(balance, currencyCode),
          priorityScore,
        };
      })
      .filter((inv) => inv.balance > 0)
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 10);

    const topUnpaidByBalance = [...collectionPriority]
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10);

    const oldestUnpaid = [...collectionPriority]
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 10);

    // 14) Cashflow forecast
    const futureOpenInvoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        dueDate: { not: null },
        status: { in: ['DRAFT', 'SENT', 'PARTIALLY_PAID'] },
      },
      select: {
        number: true,
        dueDate: true,
        baseTotal: true,
        amountPaid: true,
        client: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 500,
    });

    const forecastBuckets: Record<
      string,
      { expectedInflow: number; invoices: number }
    > = {};

    for (let i = 0; i < 6; i++) {
      const m = this.addMonths(this.startOfMonth(new Date()), i);
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
      forecastBuckets[key] = { expectedInflow: 0, invoices: 0 };
    }

    const cashflowForecastInvoices: Array<{
      number: string;
      clientName: string;
      dueDate: Date;
      balance: number;
      balanceFormatted: string;
    }> = [];

    for (const inv of futureOpenInvoices) {
      if (!inv.dueDate) continue;

      const balance = Math.max(0, (inv.baseTotal ?? 0) - (inv.amountPaid ?? 0));
      if (balance <= 0) continue;

      const key = `${inv.dueDate.getFullYear()}-${String(inv.dueDate.getMonth() + 1).padStart(2, '0')}`;

      if (key in forecastBuckets) {
        forecastBuckets[key].expectedInflow += balance;
        forecastBuckets[key].invoices += 1;
      }

      cashflowForecastInvoices.push({
        number: inv.number,
        clientName: inv.client?.name ?? 'Client',
        dueDate: inv.dueDate,
        balance,
        balanceFormatted: formatMoney(balance, currencyCode),
      });
    }

    const cashflowForecast = Object.entries(forecastBuckets).map(
      ([month, vals]) => ({
        month,
        expectedInflow: vals.expectedInflow,
        expectedInflowFormatted: formatMoney(vals.expectedInflow, currencyCode),
        invoices: vals.invoices,
      }),
    );

    return {
      tenant: {
        name: tenant?.name ?? 'Company',
        currencyCode,
      },

      totals: {
        totalInvoiced,
        totalInvoicedFormatted: formatMoney(totalInvoiced, currencyCode),
        totalReceipted,
        totalReceiptedFormatted: formatMoney(totalReceipted, currencyCode),
        outstanding,
        outstandingFormatted: formatMoney(outstanding, currencyCode),
        invoicesCount: invoiceAgg._count._all ?? 0,
        receiptsCount: receiptAgg._count._all ?? 0,
      },

      overdue: {
        count: overdueCount,
        total: overdueTotal,
        totalFormatted: formatMoney(overdueTotal, currencyCode),
      },

      aging: agingSummary,

      tax: {
        collectedAllTime: taxCollectedAllTime,
        collectedAllTimeFormatted: formatMoney(
          taxCollectedAllTime,
          currencyCode,
        ),
        collectedThisMonth: taxCollectedThisMonth,
        collectedThisMonthFormatted: formatMoney(
          taxCollectedThisMonth,
          currencyCode,
        ),
        last6Months: taxLast6Months,
      },

      cashflowForecast: {
        monthly: cashflowForecast,
        invoices: cashflowForecastInvoices.slice(0, 20),
      },

      comparisons: {
        revenueThisMonth: thisMonthReceipted,
        revenueThisMonthFormatted: formatMoney(
          thisMonthReceipted,
          currencyCode,
        ),
        revenueLastMonth: lastMonthReceipted,
        revenueLastMonthFormatted: formatMoney(
          lastMonthReceipted,
          currencyCode,
        ),
        momChangePct: momRevenueChangePct,
        revenueSameMonthLastYear: lastYearSameMonthReceipted,
        revenueSameMonthLastYearFormatted: formatMoney(
          lastYearSameMonthReceipted,
          currencyCode,
        ),
        yoyChangePct: yoyRevenueChangePct,
      },

      thisMonth: {
        invoiced: thisMonthInvoiced,
        invoicedFormatted: formatMoney(thisMonthInvoiced, currencyCode),
        receipted: thisMonthReceipted,
        receiptedFormatted: formatMoney(thisMonthReceipted, currencyCode),
      },

      collections: {
        topPriority: collectionPriority,
        topUnpaidByBalance,
        oldestUnpaid,
      },

      byStatus: statuses.map((s) => ({
        status: s.status,
        count: s._count._all,
        total: s._sum.baseTotal ?? 0,
        totalFormatted: formatMoney(s._sum.baseTotal ?? 0, currencyCode),
      })),

      profit: {
        revenue: profitRevenue,
        revenueFormatted: formatMoney(profitRevenue, currencyCode),
        cost: profitCost,
        costFormatted: formatMoney(profitCost, currencyCode),
        grossProfit,
        grossProfitFormatted: formatMoney(grossProfit, currencyCode),
        marginPct,
      },

      revenueLast6Months,
      topClients,
      clientProfit,
      itemProfit,
      profitLast6Months,

      recentOpenInvoices: recentOpenInvoices.map((inv) => ({
        ...inv,
        totalFormatted: formatMoney(
          inv.total ?? 0,
          inv.currencyCode ?? currencyCode,
        ),
        baseTotalFormatted: formatMoney(inv.baseTotal ?? 0, currencyCode),
        amountPaidFormatted: formatMoney(
          inv.amountPaid ?? 0,
          inv.currencyCode ?? currencyCode,
        ),
      })),
    };
  }
}
