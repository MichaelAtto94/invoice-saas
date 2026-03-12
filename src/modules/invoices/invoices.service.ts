import {
  BadRequestException,
  UnauthorizedException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { buildInvoicePdf } from '../../common/pdf/invoice-pdf';
import { getRequestContext } from '../../common/context/request-context';
import { MailerService } from '../../common/mailer/mailer.service';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  async list() {
    const tenantId = this.requireTenantId();

    return this.prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        number: true,
        status: true,
        issueDate: true,
        dueDate: true,
        total: true,
        amountPaid: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
      },
    });
  }

  private requireTenantId(): string {
    const tenantId = getRequestContext()?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Missing tenant context');
    return tenantId;
  }

  async sendInvoice(id: string) {
    const tenantId = this.requireTenantId();
    if (!id) throw new BadRequestException('id is required');

    const inv = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true, number: true },
    });

    if (!inv) throw new NotFoundException('Invoice not found');
    if (inv.status === 'VOID')
      throw new BadRequestException('Cannot send a VOID invoice');

    // only allow DRAFT -> SENT
    if (inv.status !== 'DRAFT') {
      return {
        ok: true,
        message: `Invoice already ${inv.status}`,
        invoice: inv,
      };
    }

    const updated = await this.prisma.invoice.update({
      where: { id: inv.id },
      data: { status: 'SENT' as any },
      select: { id: true, number: true, status: true },
    });

    await this.prisma.invoiceActivity.create({
      data: {
        tenantId,
        invoiceId: updated.id,
        action: 'SENT',
        description: 'Invoice sent to client',
      },
    });

    return { ok: true, message: 'Invoice sent', invoice: updated };
  }

  async getById(id: string) {
    const tenantId = this.requireTenantId();

    if (!id) throw new BadRequestException('id is required');

    const inv = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: { client: true, lines: true, quote: true, receipts: true },
    });

    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }

  async emailInvoice(id: string) {
    const tenantId = this.requireTenantId();
    if (!id) throw new BadRequestException('id is required');

    const inv = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: { client: true, lines: true },
    });

    if (!inv) throw new NotFoundException('Invoice not found');
    if (!inv.client.email) throw new BadRequestException('Client has no email');

    // build PDF using your existing PDF builder
    const { filename, buffer } = await this.buildInvoicePdf(inv.id);

    // IMPORTANT: if buffer is empty, stop here
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('PDF generation failed (empty buffer)');
    }

    const subject = `Invoice ${inv.number} from ${inv.client.name}`;
    const html = `
    <p>Hello ${inv.client.name},</p>
    <p>Please find attached invoice <b>${inv.number}</b>.</p>
    <p>Total: <b>${(inv.total / 100).toFixed(2)}</b></p>
    <p>Thank you.</p>
  `;

    await this.mailer.sendMail({
      to: inv.client.email,
      subject,
      html,
      filename,
      pdfBuffer: buffer,
    });

    return { ok: true, sentTo: inv.client.email, invoiceNumber: inv.number };
  }

  // ✅ Build PDF
  async buildInvoicePdf(
    id: string,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const tenantId = this.requireTenantId();

    if (!id) throw new BadRequestException('id is required');

    const inv = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: {
        client: true,
        lines: true,
      },
    });

    if (!inv) throw new NotFoundException('Invoice not found');

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: {
        name: true,
        slug: true,
        address: true,
        phone: true,
        email: true,
        logoUrl: true,
      },
    });

    const buffer = await buildInvoicePdf({
      company: {
        name: tenant?.name ?? 'Company',
        address: tenant?.address ?? null,
        phone: tenant?.phone ?? null,
        email: tenant?.email ?? null,
        logoUrl: tenant?.logoUrl ?? null,
      },
      invoiceNumber: inv.number,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      status: inv.status,
      currencyCode: inv.currencyCode,
      clientName: inv.client.name,
      clientEmail: inv.client.email,
      clientPhone: inv.client.phone,
      clientAddress: inv.client.address,
      lines: inv.lines.map((l) => ({
        name: l.name,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
      })),
      subtotal: inv.subtotal,
      taxTotal: inv.taxTotal,
      total: inv.total,
      amountPaid: inv.amountPaid,
    });

    return { filename: `${inv.number}.pdf`, buffer };
  }

  async getInvoiceActivity(invoiceId: string) {
    const tenantId = this.requireTenantId();

    if (!invoiceId) throw new BadRequestException('invoiceId is required');

    return this.prisma.invoiceActivity.findMany({
      where: {
        tenantId,
        invoiceId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
