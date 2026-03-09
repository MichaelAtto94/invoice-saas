import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getRequestContext } from '../../common/context/request-context';
import ExcelJS from 'exceljs';

function parseDate(s?: string) {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid date');
  return d;
}

@Injectable()
export class ExportsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenantId() {
    const tenantId = getRequestContext()?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Missing tenant context');
    return tenantId;
  }

  async invoicesXlsx(from?: string, to?: string) {
    const tenantId = this.requireTenantId();
    const fromD = parseDate(from);
    const toD = parseDate(to);

    const where: any = { tenantId };
    if (fromD || toD) where.createdAt = {};
    if (fromD) where.createdAt.gte = fromD;
    if (toD) where.createdAt.lte = toD;

    const invoices = await this.prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { client: true },
      take: 5000,
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Invoices');

    ws.columns = [
      { header: 'Invoice ID', key: 'id', width: 38 },
      { header: 'Number', key: 'number', width: 14 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Client', key: 'client', width: 28 },
      { header: 'Client Email', key: 'email', width: 28 },
      { header: 'Total (cents)', key: 'total', width: 14 },
      { header: 'Amount Paid (cents)', key: 'paid', width: 18 },
      { header: 'Issue Date', key: 'issueDate', width: 16 },
      { header: 'Due Date', key: 'dueDate', width: 16 },
      { header: 'Created At', key: 'createdAt', width: 22 },
    ];

    for (const inv of invoices) {
      ws.addRow({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        client: inv.client?.name ?? '',
        email: inv.client?.email ?? '',
        total: inv.total,
        paid: inv.amountPaid,
        issueDate: inv.issueDate?.toISOString().slice(0, 10),
        dueDate: inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : '',
        createdAt: inv.createdAt.toISOString(),
      });
    }

    ws.getRow(1).font = { bold: true };

    const buffer = await wb.xlsx.writeBuffer();
    return { filename: `invoices.xlsx`, buffer: Buffer.from(buffer) };
  }

  async receiptsXlsx(from?: string, to?: string) {
    const tenantId = this.requireTenantId();
    const fromD = parseDate(from);
    const toD = parseDate(to);

    const where: any = { tenantId };
    if (fromD || toD) where.createdAt = {};
    if (fromD) where.createdAt.gte = fromD;
    if (toD) where.createdAt.lte = toD;

    const receipts = await this.prisma.receipt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { invoice: { include: { client: true } } },
      take: 5000,
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Receipts');

    ws.columns = [
      { header: 'Receipt ID', key: 'id', width: 38 },
      { header: 'Receipt Number', key: 'number', width: 16 },
      { header: 'Invoice Number', key: 'invoice', width: 16 },
      { header: 'Client', key: 'client', width: 28 },
      { header: 'Amount (cents)', key: 'amount', width: 14 },
      { header: 'Method', key: 'method', width: 16 },
      { header: 'Reference', key: 'reference', width: 20 },
      { header: 'Created At', key: 'createdAt', width: 22 },
    ];

    for (const r of receipts) {
      ws.addRow({
        id: r.id,
        number: r.number,
        invoice: r.invoice?.number ?? '',
        client: r.invoice?.client?.name ?? '',
        amount: r.amount,
        method: r.method ?? '',
        reference: r.reference ?? '',
        createdAt: r.createdAt.toISOString(),
      });
    }

    ws.getRow(1).font = { bold: true };

    const buffer = await wb.xlsx.writeBuffer();
    return { filename: `receipts.xlsx`, buffer: Buffer.from(buffer) };
  }
}
