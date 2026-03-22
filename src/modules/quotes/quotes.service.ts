import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getRequestContext } from '../../common/context/request-context';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { applyFx } from '../../common/money/fx';
import { ConvertQuoteDto } from './dto/convert-quote';
import { randomBytes } from 'crypto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';


function pad5(n: number) {
  return String(n).padStart(5, '0');
}

function generatePublicId() {
  return 'inv_' + randomBytes(5).toString('hex');
}

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  // ✅ Ensure tenant exists in request context
  private requireTenantId(): string {
    const tenantId = getRequestContext()?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Missing tenant context');
    return tenantId;
  }

  // ✅ Calculate totals
  private calcTotals(lines: { quantity: number; unitPrice: number }[]) {
    let subtotal = 0;

    for (const l of lines) {
      subtotal += l.quantity * l.unitPrice;
    }

    const taxTotal = 0;
    const total = subtotal + taxTotal;

    return { subtotal, taxTotal, total };
  }



  // ✅ CREATE QUOTE
  async create(dto: CreateQuoteDto) {

      await this.subscriptions.assertCanCreateQuote();
    const tenantId = this.requireTenantId();

    if (!dto.clientId) throw new BadRequestException('clientId is required');
    if (!dto.lines || dto.lines.length === 0)
      throw new BadRequestException('lines are required');

    // Validate lines
    for (const [i, line] of dto.lines.entries()) {
      if (!line.name?.trim())
        throw new BadRequestException(`lines[${i}].name is required`);

      if (!Number.isInteger(line.quantity) || line.quantity <= 0)
        throw new BadRequestException(
          `lines[${i}].quantity must be a positive integer`,
        );

      if (!Number.isInteger(line.unitPrice) || line.unitPrice < 0)
        throw new BadRequestException(
          `lines[${i}].unitPrice must be >= 0 (cents)`,
        );
    }

    // Ensure client exists (tenant scoped)
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, tenantId },
      select: { id: true },
    });

    if (!client) throw new NotFoundException('Client not found');

    const { subtotal, taxTotal, total } = this.calcTotals(dto.lines);

    return this.prisma.$transaction(async (tx) => {
      const seq = await tx.documentSequence.upsert({
        where: { tenantId },
        create: { tenantId },
        update: {},
        select: { quoteNext: true },
      });

      const quoteNumber = `QUO-${pad5(seq.quoteNext)}`;

      await tx.documentSequence.update({
        where: { tenantId },
        data: { quoteNext: seq.quoteNext + 1 },
      });

      // Pull costPrice for item lines (tenant scoped)
      const itemIds = dto.lines
        .filter((l) => !!l.itemId)
        .map((l) => l.itemId as string);

      const items = itemIds.length
        ? await this.prisma.item.findMany({
            where: { tenantId, id: { in: itemIds } },
            select: { id: true, costPrice: true },
          })
        : [];

      const costMap = new Map(items.map((i) => [i.id, i.costPrice]));

      return tx.quote.create({
        data: {
          tenantId,
          number: quoteNumber,
          clientId: dto.clientId,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          notes: dto.notes?.trim() || null,
          subtotal,
          taxTotal,
          total,
          lines: {
            create: dto.lines.map((l) => ({
              tenantId,
              itemId: l.itemId || null,
              name: l.name.trim(),
              description: l.description?.trim() || null,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              costPrice: l.itemId
                ? (costMap.get(l.itemId) ?? 0)
                : (l.costPrice ?? 0),
              lineTotal: l.quantity * l.unitPrice,
            })),
          },
        },
        include: {
          client: {
            select: { id: true, name: true, email: true, phone: true },
          },
          lines: true,
        },
      });
    });
  }

  // ✅ LIST QUOTES
  async list() {
    const tenantId = this.requireTenantId();

    return this.prisma.quote.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        number: true,
        status: true,
        issueDate: true,
        dueDate: true,
        total: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
      },
    });
  }

  // ✅ GET QUOTE BY ID
  async getById(id: string) {
    const tenantId = this.requireTenantId();

    if (!id) throw new BadRequestException('id is required');

    const quote = await this.prisma.quote.findFirst({
      where: { id, tenantId },
      include: { client: true, lines: true },
    });

    if (!quote) throw new NotFoundException('Quote not found');

    return quote;
  }

  // ✅ CONVERT QUOTE TO INVOICE
  async convertToInvoice(quoteId: string, dto: ConvertQuoteDto) {
    const tenantId = this.requireTenantId();
    if (!quoteId) throw new BadRequestException('quoteId is required');

    return this.prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findFirst({
        where: { id: quoteId, tenantId },
        include: { lines: true, client: true },
      });
      if (!quote) throw new NotFoundException('Quote not found');

      // tenant base currency
      const tenant = await tx.tenant.findFirst({
        where: { id: tenantId },
        select: { currencyCode: true },
      });
      const baseCurrency = tenant?.currencyCode ?? 'ZMW';

      // invoice currency (defaults to tenant base)
      const currencyCode = (dto?.currencyCode ?? baseCurrency) as any;

      // FX snapshot (only if currency differs)
      let fxRateInt: number | null = null;
      let fxFrom: any = null;

      if (currencyCode !== baseCurrency) {
        const rate = await tx.exchangeRate.findFirst({
          where: {
            tenantId,
            from: baseCurrency as any,
            to: currencyCode as any,
          },
          orderBy: { asOfDate: 'desc' },
        });
        if (!rate) {
          throw new BadRequestException(
            `No exchange rate found for ${baseCurrency} -> ${currencyCode}`,
          );
        }
        fxRateInt = rate.rate;
        fxFrom = baseCurrency as any;
      }

      // sequences
      const seq = await tx.documentSequence.upsert({
        where: { tenantId },
        create: { tenantId },
        update: {},
        select: { invoiceNext: true },
      });

      const invoiceNumber = `INV-${String(seq.invoiceNext).padStart(5, '0')}`;

      await tx.documentSequence.update({
        where: { tenantId },
        data: { invoiceNext: seq.invoiceNext + 1 },
      });

      // convert money if needed
      const convertMoney = (cents: number) =>
        fxRateInt ? applyFx(cents, fxRateInt) : cents;

      const invoiceSubtotal = convertMoney(quote.subtotal);
      const invoiceTax = convertMoney(quote.taxTotal);
      const invoiceTotal = convertMoney(quote.total);

      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          number: invoiceNumber,
          clientId: quote.clientId,
          quoteId: quote.id,
          publicId: generatePublicId(),

          currencyCode,
          fxRate: fxRateInt,
          fxFrom,

          issueDate: new Date(),
          dueDate: quote.dueDate,
          notes: quote.notes,

          subtotal: invoiceSubtotal,
          taxTotal: invoiceTax,
          total: invoiceTotal,

          amountPaid: 0,

          lines: {
            create: quote.lines.map((l) => {
              const unitPrice = convertMoney(l.unitPrice);
              const lineTotal = convertMoney(l.lineTotal);

              return {
                tenantId,
                itemId: l.itemId,
                name: l.name,
                description: l.description,
                quantity: l.quantity,
                unitPrice,
                costPrice: l.costPrice ?? 0, // ✅ add this
                lineTotal,
              };
            }),
          },
        },
        include: { client: true, lines: true },
      });

      // mark quote accepted/converted
      await tx.quote.update({
        where: { id: quote.id },
        data: {
          status: 'SENT',
          convertedToInvoiceId: invoice.id,
          convertedAt: new Date(),
        } as any,
      });

      await tx.invoiceActivity.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          action: 'CREATED',
          description: 'Invoice created from quote',
        },
      });

      return invoice;
    });
  }
}
