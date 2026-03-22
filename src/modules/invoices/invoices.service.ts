import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { CurrentUserType } from '../../common/types/current-user.type';
import { MailerService } from '../mailer/mailer.service';
import { InvoicePdfService } from './pdf/invoice-pdf.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly invoicePdfService: InvoicePdfService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async findAll(tenantId: string) {
    return this.prisma.invoice.findMany({
      where: { tenantId },
      include: {
        client: true,
        receipts: true,
        lines: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        client: true,
        lines: true,
        receipts: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  private async generateInvoiceNumber(tenantId: string, tx?: any) {
    const prisma = tx ?? this.prisma;

    const sequence = await prisma.documentSequence.findFirst({
      where: { tenantId },
      select: {
        tenantId: true,
        invoicePrefix: true,
        invoiceNext: true,
      },
    });

    if (!sequence) {
      throw new NotFoundException('Document sequence not found for tenant');
    }

    const number = `${sequence.invoicePrefix}${sequence.invoiceNext}`;

    await prisma.documentSequence.update({
      where: { tenantId },
      data: {
        invoiceNext: {
          increment: 1,
        },
      },
    });

    return number;
  }

  async create(dto: any, user: CurrentUserType) {

      await this.subscriptions.assertCanCreateInvoice();

    if (!dto.clientId || typeof dto.clientId !== 'string') {
      throw new BadRequestException('clientId is required');
    }

    const client = await this.prisma.client.findFirst({
      where: {
        id: dto.clientId,
        tenantId: user.tenantId,
      },
    });

    if (!client) {
      throw new NotFoundException(
        'Client not found for this tenant. Use a valid clientId.',
      );
    }

    const subtotal = Number(dto.subtotal ?? 0);
    const taxTotal = Number(dto.taxTotal ?? 0);
    const total = Number(dto.total ?? subtotal + taxTotal);
    const amountPaid = Number(dto.amountPaid ?? 0);

    return this.prisma.$transaction(async (tx) => {
      let invoiceNumber = dto.number?.trim();

      if (invoiceNumber) {
        const existingInvoice = await tx.invoice.findFirst({
          where: {
            tenantId: user.tenantId,
            number: invoiceNumber,
          },
          select: { id: true },
        });

        if (existingInvoice) {
          throw new BadRequestException('Invoice number already exists');
        }
      } else {
        invoiceNumber = await this.generateInvoiceNumber(user.tenantId, tx);
      }

      return tx.invoice.create({
        data: {
          tenantId: user.tenantId,
          number: invoiceNumber,
          clientId: dto.clientId,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          notes: dto.notes ?? null,
          subtotal,
          taxTotal,
          total,
          amountPaid,
          status: dto.status ?? 'DRAFT',
          currencyCode: dto.currencyCode ?? 'ZMW',
          lines:
            Array.isArray(dto.lines) && dto.lines.length > 0
              ? {
                  create: dto.lines.map((line: any) => ({
                    tenantId: user.tenantId,
                    itemId: line.itemId ?? null,
                    name: line.name,
                    description: line.description ?? null,
                    quantity: Number(line.quantity ?? 1),
                    unitPrice: Number(line.unitPrice ?? 0),
                    costPrice: Number(line.costPrice ?? 0),
                    lineTotal: Number(
                      line.lineTotal ??
                        Number(line.quantity ?? 1) *
                          Number(line.unitPrice ?? 0),
                    ),
                  })),
                }
              : undefined,
        },
        include: {
          client: true,
          lines: true,
        },
      });
    });
  }

  async send(id: string, user: CurrentUserType) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
      include: {
        client: true,
        lines: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (!invoice.client?.email) {
      throw new BadRequestException('Client email is missing');
    }

    const pdfBuffer = await this.invoicePdfService.generateInvoicePdf(
      invoice.id,
      user.tenantId,
    );

    await this.mailer.sendMail({
      to: invoice.client.email,
      subject: `Invoice ${invoice.number}`,
      html: `
        <p>Hello ${invoice.client.name},</p>
        <p>Please find attached your invoice <strong>${invoice.number}</strong>.</p>
        <p>Total: ${invoice.total}</p>
        <p>Thank you.</p>
      `,
      filename: `${invoice.number}.pdf`,
      pdfBuffer,
    });

    return this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'SENT',
      },
    });
  }
}
