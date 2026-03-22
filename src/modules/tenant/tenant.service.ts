import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getRequestContext } from '../../common/context/request-context';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenantId(): string {
    const tenantId = getRequestContext()?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Missing tenant context');
    return tenantId;
  }

  async me() {
    const tenantId = this.requireTenantId();

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        currencyCode: true,
        address: true,
        phone: true,
        email: true,
        logoUrl: true,
        bankName: true,
        accountName: true,
        accountNumber: true,
        branchName: true,
        airtelMoneyNumber: true,
        mtnMoneyNumber: true,
        paymentDisplayName: true,
        createdAt: true,
      },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async update(dto: UpdateTenantDto) {
    const tenantId = this.requireTenantId();

    const exists = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { id: true },
    });

    if (!exists) throw new NotFoundException('Tenant not found');

    if (dto.email && !dto.email.includes('@')) {
      throw new BadRequestException('Invalid email');
    }

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: dto.name?.trim() || undefined,
        address: dto.address?.trim() || undefined,
        phone: dto.phone?.trim() || undefined,
        email: dto.email?.trim() || undefined,
        logoUrl: dto.logoUrl?.trim() || undefined,
        currencyCode: dto.currencyCode || undefined,
        bankName: dto.bankName?.trim() || undefined,
        accountName: dto.accountName?.trim() || undefined,
        accountNumber: dto.accountNumber?.trim() || undefined,
        branchName: dto.branchName?.trim() || undefined,
        airtelMoneyNumber: dto.airtelMoneyNumber?.trim() || undefined,
        mtnMoneyNumber: dto.mtnMoneyNumber?.trim() || undefined,
        paymentDisplayName: dto.paymentDisplayName?.trim() || undefined,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        currencyCode: true,
        address: true,
        phone: true,
        email: true,
        logoUrl: true,
        bankName: true,
        accountName: true,
        accountNumber: true,
        branchName: true,
        airtelMoneyNumber: true,
        mtnMoneyNumber: true,
        paymentDisplayName: true,
        createdAt: true,
      },
    });
  }
}
