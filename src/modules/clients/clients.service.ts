import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { buildClientStatementPdf } from '../../common/pdf/client-statement-pdf';
import { PrismaService } from '../../database/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { getRequestContext } from '../../common/context/request-context';
import { ClientStatementDto } from './dto/client-statement.dto';
import { randomBytes } from 'crypto';


function generatePublicId() {
  return 'inv_' + randomBytes(5).toString('hex');
}

function generatePortalToken() {
  return 'cpt_' + randomBytes(8).toString('hex');
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenantId(): string {
    const ctx = getRequestContext();
    const tenantId = ctx?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Missing tenant context');
    return tenantId;
  }

  async create(dto: CreateClientDto) {
    const tenantId = this.requireTenantId();

    if (!dto.name || dto.name.trim().length === 0) {
      throw new BadRequestException('Client name is required');
    }

    // Use tenantId directly (UncheckedCreateInput), do NOT take it from user input
    return this.prisma.client.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        address: dto.address?.trim() || null,
        portalToken: generatePortalToken(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        createdAt: true,
      },
    });
  }

  async findAll() {
    // tenant scoping also exists, but we can keep it simple:
    return this.prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        createdAt: true,
        portalToken: true,
      },
    });
  }

  async findOne(id: string) {
    if (!id) throw new BadRequestException('id is required');

    const client = await this.prisma.client.findFirst({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        createdAt: true,
      },
    });

    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async update(id: string, dto: UpdateClientDto) {
    if (!id) throw new BadRequestException('id is required');

    const exists = await this.prisma.client.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Client not found');

    return this.prisma.client.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        email: dto.email?.trim(),
        phone: dto.phone?.trim(),
        address: dto.address?.trim(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        createdAt: true,
      },
    });
  }

  async remove(id: string) {
    if (!id) throw new BadRequestException('id is required');

    const exists = await this.prisma.client.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Client not found');

    await this.prisma.client.delete({ where: { id } });
    return { ok: true };
  }


  async statementPdf(id: string, query: ClientStatementDto) {
    const tenantId = this.requireTenantId();

    const [data, tenant] = await Promise.all([
      this.statement(id, query),
      this.prisma.tenant.findFirst({
        where: { id: tenantId },
        select: {
          name: true,
          currencyCode: true,
          address: true,
          phone: true,
          email: true,
          logoUrl: true,
        },
      }),
    ]);

    const buffer = await buildClientStatementPdf({
      company: {
        name: tenant?.name ?? 'Cloud Motion Ltd',
        address: tenant?.address,
        phone: tenant?.phone,
        email: tenant?.email,
        logoUrl: tenant?.logoUrl,
      },
      client: data.client,
      period: data.period,
      summary: data.summary,
      invoices: data.invoices,
      receipts: data.receipts,
      currencyCode: tenant?.currencyCode ?? 'ZMW',
    });

    const fromPart = query.from ?? 'all';
    const toPart = query.to ?? 'now';

    return {
      filename: `statement-${id}-${fromPart}-${toPart}.pdf`,
      buffer,
    };
  }

  async statement(id: string, query: ClientStatementDto) {
    const tenantId = this.requireTenantId();

    if (!id) throw new BadRequestException('id is required');

    const client = await this.prisma.client.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        createdAt: true,
      },
    });

    if (!client) throw new NotFoundException('Client not found');

    const fromDate = query.from ? new Date(query.from) : null;
    const toDate = query.to ? new Date(query.to) : null;

    if (fromDate && Number.isNaN(fromDate.getTime())) {
      throw new BadRequestException('Invalid from date');
    }

    if (toDate && Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid to date');
    }

    // Opening balance = invoices before fromDate - receipts before fromDate
    let openingBalance = 0;

    if (fromDate) {
      const [openingInvoices, openingReceipts] = await Promise.all([
        this.prisma.invoice.aggregate({
          where: {
            tenantId,
            clientId: id,
            issueDate: { lt: fromDate },
          },
          _sum: { baseTotal: true },
        }),
        this.prisma.receipt.aggregate({
          where: {
            tenantId,
            invoice: {
              clientId: id,
            },
            createdAt: { lt: fromDate },
          },
          _sum: { amount: true },
        }),
      ]);

      openingBalance =
        (openingInvoices._sum.baseTotal ?? 0) -
        (openingReceipts._sum.amount ?? 0);
    }

    const invoiceWhere: any = {
      tenantId,
      clientId: id,
    };

    if (fromDate || toDate) {
      invoiceWhere.issueDate = {};
      if (fromDate) invoiceWhere.issueDate.gte = fromDate;
      if (toDate) invoiceWhere.issueDate.lte = toDate;
    }

    const receiptWhere: any = {
      tenantId,
      invoice: {
        clientId: id,
      },
    };

    if (fromDate || toDate) {
      receiptWhere.createdAt = {};
      if (fromDate) receiptWhere.createdAt.gte = fromDate;
      if (toDate) receiptWhere.createdAt.lte = toDate;
    }

    const [invoices, receipts] = await Promise.all([
      this.prisma.invoice.findMany({
        where: invoiceWhere,
        orderBy: { issueDate: 'asc' },
        select: {
          id: true,
          number: true,
          status: true,
          currencyCode: true,
          issueDate: true,
          dueDate: true,
          total: true,
          baseTotal: true,
          amountPaid: true,
        },
      }),
      this.prisma.receipt.findMany({
        where: receiptWhere,
        orderBy: { createdAt: 'asc' },
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
      }),
    ]);

    const invoiceTotal = invoices.reduce(
      (sum, inv) => sum + (inv.baseTotal ?? 0),
      0,
    );
    const receiptTotal = receipts.reduce((sum, r) => sum + (r.amount ?? 0), 0);
    const closingBalance = openingBalance + invoiceTotal - receiptTotal;

    return {
      client,
      period: {
        from: fromDate,
        to: toDate,
      },
      summary: {
        openingBalance,
        invoiceTotal,
        receiptTotal,
        closingBalance,
      },
      invoices,
      receipts,
    };

    const ledger = this.buildLedger(invoices, receipts, openingBalance);
  }

  private buildLedger(
    invoices: any[],
    receipts: any[],
    openingBalance: number,
  ) {
    const entries: any[] = [];

    for (const inv of invoices) {
      entries.push({
        date: inv.issueDate,
        type: 'INVOICE',
        description: `Invoice ${inv.number}`,
        debit: inv.baseTotal ?? 0,
        credit: 0,
      });
    }

    for (const r of receipts) {
      entries.push({
        date: r.createdAt,
        type: 'RECEIPT',
        description: `Receipt ${r.number}`,
        debit: 0,
        credit: r.amount ?? 0,
      });
    }

    entries.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    let balance = openingBalance;

    for (const e of entries) {
      balance += e.debit;
      balance -= e.credit;
      e.balance = balance;
    }

    return entries;
  }

  async dashboard(id: string) {
    const tenantId = this.requireTenantId();

    if (!id) throw new BadRequestException('id is required');

    const client = await this.prisma.client.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        createdAt: true,
      },
    });

    if (!client) throw new NotFoundException('Client not found');

    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId, clientId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        number: true,
        status: true,
        issueDate: true,
        dueDate: true,
        total: true,
        amountPaid: true,
        publicId: true,
        createdAt: true,
      },
    });

    const receipts = await this.prisma.receipt.findMany({
      where: {
        tenantId,
        invoice: {
          clientId: id,
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

    const overdueInvoices = invoices.filter(
      (inv) =>
        inv.dueDate &&
        new Date(inv.dueDate).getTime() < Date.now() &&
        inv.status !== 'PAID' &&
        inv.status !== 'VOID',
    );

    return {
      client,
      summary: {
        invoicesCount: invoices.length,
        receiptsCount: receipts.length,
        overdueCount: overdueInvoices.length,
        totalInvoiced,
        totalPaid,
        outstanding,
      },
      invoices,
      receipts,
      overdueInvoices,
    };
  }

  async regeneratePortalToken(id: string) {
    const tenantId = this.requireTenantId();

    if (!id) throw new BadRequestException('id is required');

    const client = await this.prisma.client.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!client) throw new NotFoundException('Client not found');

    return this.prisma.client.update({
      where: { id },
      data: {
        portalToken: generatePortalToken(),
      },
      select: {
        id: true,
        name: true,
        portalToken: true,
      },
    });
  }
}
