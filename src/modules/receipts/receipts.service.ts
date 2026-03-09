import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getRequestContext } from '../../common/context/request-context';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { buildReceiptPdf } from '../../common/pdf/receipt-pdf';

function pad5(n: number) {
  return String(n).padStart(5, '0');
}

@Injectable()
export class ReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenantId(): string {
    const tenantId = getRequestContext()?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Missing tenant context');
    return tenantId;
  }

  async list() {
    const tenantId = this.requireTenantId();
    return this.prisma.receipt.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        invoice: { select: { id: true, number: true } },
      },
    });
  }

  async getById(id: string) {
    const tenantId = this.requireTenantId();
    if (!id) throw new BadRequestException('id is required');

    const r = await this.prisma.receipt.findFirst({
      where: { id, tenantId },
      include: {
        invoice: { include: { client: true } },
      },
    });

    if (!r) throw new NotFoundException('Receipt not found');
    return r;
  }

  async create(dto: CreateReceiptDto) {
    const tenantId = this.requireTenantId();

    if (!dto.invoiceId) throw new BadRequestException('invoiceId is required');
    if (!Number.isInteger(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException(
        'amount must be a positive integer (cents)',
      );
    }

    const method = dto.method ?? 'CASH';
    const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.findFirst({
        where: { id: dto.invoiceId, tenantId },
        include: { client: true },
      });
      if (!inv) throw new NotFoundException('Invoice not found');

      // Get receipt sequence for this tenant
      const seq = await tx.documentSequence.upsert({
        where: { tenantId },
        create: { tenantId },
        update: {},
        select: { receiptNext: true },
      });

      const receiptNumber = `REC-${pad5(seq.receiptNext)}`;

      await tx.documentSequence.update({
        where: { tenantId },
        data: { receiptNext: seq.receiptNext + 1 },
      });

      // Create receipt row
      const receipt = await tx.receipt.create({
        data: {
          tenantId,
          invoiceId: inv.id,
          number: receiptNumber,
          amount: dto.amount,
          method,
          reference: dto.reference?.trim() || null,
          notes: dto.notes?.trim() || null,
        },
      });

      // Update invoice amountPaid + status
      const newPaid = inv.amountPaid + dto.amount;

      let newStatus: string = inv.status;
      if (newPaid <= 0) newStatus = inv.status;
      else if (newPaid >= inv.total) newStatus = 'PAID';
      else newStatus = 'PARTIALLY_PAID';

      await tx.invoice.update({
        where: { id: inv.id },
        data: {
          amountPaid: newPaid,
          status: newStatus as any,
        },
      });

      return {
        receipt,
        invoice: {
          id: inv.id,
          number: inv.number,
          status: newStatus,
          amountPaid: newPaid,
          total: inv.total,
        },
      };
    });
  }

  async buildReceiptPdf(
    id: string,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const tenantId = this.requireTenantId();
    if (!id) throw new BadRequestException('id is required');

    const r = await this.prisma.receipt.findFirst({
      where: { id, tenantId },
      include: {
        invoice: { include: { client: true } },
      },
    });

    if (!r) throw new NotFoundException('Receipt not found');

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { name: true },
    });

    const buffer = await buildReceiptPdf({
      receiptNumber: r.number,
      receivedAt: (r as any).receivedAt ?? r.createdAt,
      tenantName: tenant?.name ?? 'Company',
      invoiceNumber: r.invoice.number,
      clientName: r.invoice.client.name,
      amount: r.amount,
      method: r.method ?? 'CASH',
      reference: r.reference,
      notes: r.notes,
    });

    return { filename: `${r.number}.pdf`, buffer };
  }
}
