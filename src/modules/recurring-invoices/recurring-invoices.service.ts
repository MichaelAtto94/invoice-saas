import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getRequestContext } from '../../common/context/request-context';
import { CreateRecurringDto } from './dto/create-recurring.dto';
import { Cron } from '@nestjs/schedule';
import { randomBytes } from 'crypto';

function generatePublicId() {
  return 'inv_' + randomBytes(5).toString('hex');
}

@Injectable()
export class RecurringInvoicesService {
  constructor(private prisma: PrismaService) {}

  private requireTenantId() {
    const tenantId = getRequestContext()?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Missing tenant context');
    return tenantId;
  }

  async create(dto: CreateRecurringDto) {
    const tenantId = this.requireTenantId();

    let subtotal = 0;

    for (const l of dto.lines) {
      subtotal += l.quantity * l.unitPrice;
    }

    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, tenantId },
      select: { id: true },
    });

    if (!client) {
      throw new BadRequestException('Client not found');
    }

    const total = subtotal;

    return this.prisma.recurringInvoice.create({
      data: {
        tenantId,
        clientId: dto.clientId,
        name: dto.name,
        currencyCode: 'ZMW',

        interval: dto.interval,
        intervalCount: dto.intervalCount ?? 1,

        nextRunDate: new Date(dto.nextRunDate),

        issueDays: dto.issueDays ?? 0,
        dueDays: dto.dueDays ?? 7,

        subtotal,
        taxTotal: 0,
        total,

        lines: {
          create: dto.lines.map((l) => ({
            itemId: l.itemId ?? null,
            name: l.name,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            costPrice: l.costPrice ?? 0,
            lineTotal: l.quantity * l.unitPrice,
          })),
        },
      },
    });
  }

  async runRecurring() {
    const tenantId = this.requireTenantId();
    const today = new Date();

    const templates = await this.prisma.recurringInvoice.findMany({
      where: {
        tenantId,
        active: true,
        nextRunDate: { lte: today },
      },
      include: { lines: true },
    });

    let created = 0;

    for (const template of templates) {
      // generate invoice number
      const seq = await this.prisma.documentSequence.upsert({
        where: { tenantId },
        create: { tenantId },
        update: {},
        select: { invoiceNext: true },
      });

      const invoiceNumber = `INV-${String(seq.invoiceNext).padStart(5, '0')}`;

      await this.prisma.documentSequence.update({
        where: { tenantId },
        data: { invoiceNext: seq.invoiceNext + 1 },
      });

      const createdInvoice = await this.prisma.invoice.create({
        data: {
          tenantId,
          clientId: template.clientId,
          number: invoiceNumber,
          publicId: generatePublicId(),
          status: 'DRAFT',

          currencyCode: template.currencyCode as any,
          baseTotal: template.total,
          amountPaid: 0,

          issueDate: template.nextRunDate,
          dueDate: new Date(
            template.nextRunDate.getTime() +
              template.dueDays * 24 * 60 * 60 * 1000,
          ),

          subtotal: template.subtotal,
          taxTotal: template.taxTotal,
          total: template.total,

          lines: {
            create: template.lines.map((l) => ({
              tenantId,
              itemId: l.itemId,
              name: l.name,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              costPrice: l.costPrice,
              lineTotal: l.lineTotal,
            })),
          },
        },
      });

      await this.prisma.invoiceActivity.create({
        data: {
          tenantId,
          invoiceId: createdInvoice.id,
          action: 'CREATED',
          description: 'Invoice created from recurring template',
        },
      });

      created++;

      const next = new Date(template.nextRunDate);

      switch (template.interval) {
        case 'DAILY':
          next.setDate(next.getDate() + template.intervalCount);
          break;
        case 'WEEKLY':
          next.setDate(next.getDate() + 7 * template.intervalCount);
          break;
        case 'MONTHLY':
          next.setMonth(next.getMonth() + template.intervalCount);
          break;
        case 'YEARLY':
          next.setFullYear(next.getFullYear() + template.intervalCount);
          break;
      }

      await this.prisma.recurringInvoice.update({
        where: { id: template.id },
        data: {
          lastRunDate: today,
          nextRunDate: next,
        },
      });
    }

    return {
      templatesProcessed: templates.length,
      invoicesCreated: created,
    };
  }

  @Cron('0 1 * * *') // every day at 1:00 AM
  async handleRecurringCron() {
    // no request context in cron jobs, so process all active due templates
    const today = new Date();

    const templates = await this.prisma.recurringInvoice.findMany({
      where: {
        active: true,
        nextRunDate: { lte: today },
      },
      include: { lines: true },
    });

    let created = 0;

    for (const template of templates) {
      const tenantId = template.tenantId;

      const seq = await this.prisma.documentSequence.upsert({
        where: { tenantId },
        create: { tenantId },
        update: {},
        select: { invoiceNext: true },
      });

      const invoiceNumber = `INV-${String(seq.invoiceNext).padStart(5, '0')}`;

      await this.prisma.documentSequence.update({
        where: { tenantId },
        data: { invoiceNext: seq.invoiceNext + 1 },
      });

      const createdInvoice = await this.prisma.invoice.create({
        data: {
          tenantId,
          clientId: template.clientId,
          number: invoiceNumber,
          publicId: generatePublicId(),
          status: 'DRAFT',

          currencyCode: template.currencyCode as any,
          baseTotal: template.total,
          amountPaid: 0,

          issueDate: template.nextRunDate,
          dueDate: new Date(
            template.nextRunDate.getTime() +
              template.dueDays * 24 * 60 * 60 * 1000,
          ),

          subtotal: template.subtotal,
          taxTotal: template.taxTotal,
          total: template.total,

          lines: {
            create: template.lines.map((l) => ({
              tenantId,
              itemId: l.itemId,
              name: l.name,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              costPrice: l.costPrice,
              lineTotal: l.lineTotal,
            })),
          },
        },
      });

      await this.prisma.invoiceActivity.create({
        data: {
          tenantId,
          invoiceId: createdInvoice.id,
          action: 'CREATED',
          description: 'Invoice created from recurring template',
        },
      });

      created++;

      const next = new Date(template.nextRunDate);

      switch (template.interval) {
        case 'DAILY':
          next.setDate(next.getDate() + template.intervalCount);
          break;
        case 'WEEKLY':
          next.setDate(next.getDate() + 7 * template.intervalCount);
          break;
        case 'MONTHLY':
          next.setMonth(next.getMonth() + template.intervalCount);
          break;
        case 'YEARLY':
          next.setFullYear(next.getFullYear() + template.intervalCount);
          break;
      }

      await this.prisma.recurringInvoice.update({
        where: { id: template.id },
        data: {
          lastRunDate: today,
          nextRunDate: next,
        },
      });
    }

    console.log(
      `[Recurring Cron] processed=${templates.length}, invoicesCreated=${created}`,
    );
  }

  async list() {
    const tenantId = this.requireTenantId();

    return this.prisma.recurringInvoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        lines: true,
      },
    });
  }

  async getById(id: string) {
    const tenantId = this.requireTenantId();

    if (!id) throw new BadRequestException('id is required');

    const recurring = await this.prisma.recurringInvoice.findFirst({
      where: { id, tenantId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        lines: true,
      },
    });

    if (!recurring)
      throw new BadRequestException('Recurring invoice not found');

    return recurring;
  }

  async update(id: string, dto: any) {
    const tenantId = this.requireTenantId();

    if (!id) throw new BadRequestException('id is required');

    const existing = await this.prisma.recurringInvoice.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!existing) throw new BadRequestException('Recurring invoice not found');

    return this.prisma.recurringInvoice.update({
      where: { id },
      data: {
        name: dto.name?.trim() || undefined,
        interval: dto.interval ?? undefined,
        intervalCount: dto.intervalCount ?? undefined,
        nextRunDate: dto.nextRunDate ? new Date(dto.nextRunDate) : undefined,
        issueDays: dto.issueDays ?? undefined,
        dueDays: dto.dueDays ?? undefined,
        active: dto.active ?? undefined,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        lines: true,
      },
    });
  }

  async pause(id: string) {
    const tenantId = this.requireTenantId();

    const existing = await this.prisma.recurringInvoice.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!existing) throw new BadRequestException('Recurring invoice not found');

    return this.prisma.recurringInvoice.update({
      where: { id },
      data: { active: false },
      select: {
        id: true,
        name: true,
        active: true,
      },
    });
  }

  async resume(id: string) {
    const tenantId = this.requireTenantId();

    const existing = await this.prisma.recurringInvoice.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!existing) throw new BadRequestException('Recurring invoice not found');

    return this.prisma.recurringInvoice.update({
      where: { id },
      data: { active: true },
      select: {
        id: true,
        name: true,
        active: true,
      },
    });
  }

  async remove(id: string) {
    const tenantId = this.requireTenantId();

    if (!id) throw new BadRequestException('id is required');

    const existing = await this.prisma.recurringInvoice.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!existing) throw new BadRequestException('Recurring invoice not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.recurringInvoiceLine.deleteMany({
        where: { recurringInvoiceId: id },
      });

      await tx.recurringInvoice.delete({
        where: { id },
      });
    });

    return { ok: true };
  }
}
