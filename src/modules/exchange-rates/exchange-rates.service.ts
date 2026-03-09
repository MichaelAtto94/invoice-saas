import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getRequestContext } from '../../common/context/request-context';
import { toFxInt } from '../../common/money/fx';
import { SetRateDto } from './dto/set-rate.dto';

@Injectable()
export class ExchangeRatesService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenantId() {
    const tenantId = getRequestContext()?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Missing tenant context');
    return tenantId;
  }

  async setRate(dto: SetRateDto) {
    const tenantId = this.requireTenantId();

    if (!dto.from || !dto.to) throw new BadRequestException('from/to required');
    if (dto.from === dto.to) throw new BadRequestException('from cannot equal to');
    if (typeof dto.rate !== 'number' || dto.rate <= 0) throw new BadRequestException('rate must be > 0');

    const asOfDate = dto.asOfDate ? new Date(dto.asOfDate) : new Date();

    return this.prisma.exchangeRate.create({
      data: {
        tenantId,
        from: dto.from as any,
        to: dto.to as any,
        rate: toFxInt(dto.rate),
        asOfDate,
      },
    });
  }

  async latest(from: string, to: string) {
    const tenantId = this.requireTenantId();

    return this.prisma.exchangeRate.findFirst({
      where: { tenantId, from: from as any, to: to as any },
      orderBy: { asOfDate: 'desc' },
    });
  }
}
