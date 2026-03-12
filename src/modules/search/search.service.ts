import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getRequestContext } from '../../common/context/request-context';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenantId(): string {
    const tenantId = getRequestContext()?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Missing tenant context');
    return tenantId;
  }

  async search(q: string) {
    const tenantId = this.requireTenantId();

    const term = q?.trim();
    if (!term) throw new BadRequestException('q is required');

    const [clients, invoices, quotes, receipts] = await Promise.all([
      this.prisma.client.findMany({
        where: {
          tenantId,
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { phone: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      }),

      this.prisma.invoice.findMany({
        where: {
          tenantId,
          OR: [
            { number: { contains: term, mode: 'insensitive' } },
            { publicId: { contains: term, mode: 'insensitive' } },
            { client: { name: { contains: term, mode: 'insensitive' } } },
          ],
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          number: true,
          publicId: true,
          status: true,
          total: true,
          amountPaid: true,
          client: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),

      this.prisma.quote.findMany({
        where: {
          tenantId,
          OR: [
            { number: { contains: term, mode: 'insensitive' } },
            { client: { name: { contains: term, mode: 'insensitive' } } },
          ],
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          client: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),

      this.prisma.receipt.findMany({
        where: {
          tenantId,
          OR: [
            { number: { contains: term, mode: 'insensitive' } },
            { reference: { contains: term, mode: 'insensitive' } },
            { invoice: { number: { contains: term, mode: 'insensitive' } } },
            {
              invoice: {
                client: { name: { contains: term, mode: 'insensitive' } },
              },
            },
          ],
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          number: true,
          amount: true,
          reference: true,
          invoice: {
            select: {
              id: true,
              number: true,
              client: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      query: term,
      counts: {
        clients: clients.length,
        invoices: invoices.length,
        quotes: quotes.length,
        receipts: receipts.length,
      },
      clients,
      invoices,
      quotes,
      receipts,
    };
  }
}
