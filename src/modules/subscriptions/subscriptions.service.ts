import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getRequestContext } from '../../common/context/request-context';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { RequestUpgradeDto } from './dto/request-upgrade.dto';
import { SubmitUpgradePaymentDto } from './dto/submit-upgrade-payment.dto';

type PlanLimits = {
  invoicesPerMonth: number;
  quotesPerMonth: number;
  users: number;
  clients: number;
};

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenantId(): string {
    const tenantId = getRequestContext()?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Missing tenant context');
    return tenantId;
  }

  private getPlanLimits(planCode: string): PlanLimits {
    switch ((planCode || 'FREE').toUpperCase()) {
      case 'BASIC':
        return {
          invoicesPerMonth: 100,
          quotesPerMonth: 100,
          users: 3,
          clients: 100,
        };
      case 'PRO':
        return {
          invoicesPerMonth: 100000,
          quotesPerMonth: 100000,
          users: 1000,
          clients: 100000,
        };
      case 'FREE':
      default:
        return {
          invoicesPerMonth: 10,
          quotesPerMonth: 10,
          users: 1,
          clients: 20,
        };
    }
  }

  async getCurrentPlan() {
    const tenantId = this.requireTenantId();

   const tenant = await this.prisma.tenant.findFirst({
     where: { id: tenantId },
     select: {
       id: true,
       name: true,
       planCode: true,
       subscriptionStatus: true,
       planStartedAt: true,
       planExpiresAt: true,
     },
   });

    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

    const limits = this.getPlanLimits(tenant.planCode);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [invoicesThisMonth, quotesThisMonth, users, clients, pendingUpgrade] =
      await Promise.all([
        this.prisma.invoice.count({
          where: {
            tenantId,
            createdAt: { gte: monthStart },
          },
        }),
        this.prisma.quote.count({
          where: {
            tenantId,
            createdAt: { gte: monthStart },
          },
        }),
        this.prisma.tenantUser.count({
          where: { tenantId },
        }),
        this.prisma.client.count({
          where: {
            tenantId,
            isArchived: false,
          },
        }),
        this.prisma.subscriptionUpgradeRequest.findFirst({
          where: {
            tenantId,
            status: 'PENDING',
          },
          orderBy: {
            requestedAt: 'desc',
          },
          select: {
            id: true,
            requestedPlanCode: true,
            status: true,
            notes: true,
            requestedAt: true,
          },
        }),
      ]);

    const warnings: Array<{ code: string; message: string }> = [];

    if (invoicesThisMonth >= limits.invoicesPerMonth * 0.8) {
      warnings.push({
        code: 'INVOICE_LIMIT_NEAR',
        message: `You have used ${invoicesThisMonth} of ${limits.invoicesPerMonth} invoices this month.`,
      });
    }

    if (quotesThisMonth >= limits.quotesPerMonth * 0.8) {
      warnings.push({
        code: 'QUOTE_LIMIT_NEAR',
        message: `You have used ${quotesThisMonth} of ${limits.quotesPerMonth} quotes this month.`,
      });
    }

    if (tenant.planExpiresAt) {
      const daysLeft = Math.ceil(
        (tenant.planExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );

      if (daysLeft >= 0 && daysLeft <= 7) {
        warnings.push({
          code: 'PLAN_EXPIRING',
          message: `Your subscription expires in ${daysLeft} day(s).`,
        });
      }
    }

    return {
      ...tenant,
      limits,
      usage: {
        invoicesThisMonth,
        quotesThisMonth,
        users,
        clients,
      },
      remaining: {
        invoices: Math.max(0, limits.invoicesPerMonth - invoicesThisMonth),
        quotes: Math.max(0, limits.quotesPerMonth - quotesThisMonth),
        users: Math.max(0, limits.users - users),
        clients: Math.max(0, limits.clients - clients),
      },
      warnings,
      pendingUpgradeRequest: pendingUpgrade,
    };
  }

  async updateMySubscription(dto: UpdateSubscriptionDto) {
    const tenantId = this.requireTenantId();

    const exists = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { id: true },
    });

    if (!exists) {
      throw new BadRequestException('Tenant not found');
    }

    const planStartedAt = dto.planStartedAt
      ? new Date(dto.planStartedAt)
      : undefined;

    const planExpiresAt = dto.planExpiresAt
      ? new Date(dto.planExpiresAt)
      : undefined;

    if (dto.planStartedAt && Number.isNaN(planStartedAt?.getTime())) {
      throw new BadRequestException('Invalid planStartedAt');
    }

    if (dto.planExpiresAt && Number.isNaN(planExpiresAt?.getTime())) {
      throw new BadRequestException('Invalid planExpiresAt');
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        planCode: dto.planCode ?? undefined,
        subscriptionStatus: dto.subscriptionStatus ?? undefined,
        planStartedAt,
        planExpiresAt,
      },
      select: {
        id: true,
        name: true,
        planCode: true,
        subscriptionStatus: true,
        planStartedAt: true,
        planExpiresAt: true,
      },
    });

    return {
      ...updated,
      limits: this.getPlanLimits(updated.planCode),
    };
  }

  async requestUpgrade(dto: RequestUpgradeDto) {
    const tenantId = this.requireTenantId();

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: {
        id: true,
        planCode: true,
        name: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (dto.requestedPlanCode === tenant.planCode) {
      throw new BadRequestException('Requested plan is already active');
    }

    const existingPending =
      await this.prisma.subscriptionUpgradeRequest.findFirst({
        where: {
          tenantId,
          status: 'PENDING',
        },
        select: { id: true },
      });

    if (existingPending) {
      throw new BadRequestException(
        'There is already a pending upgrade request',
      );
    }

    return this.prisma.subscriptionUpgradeRequest.create({
      data: {
        tenantId,
        requestedPlanCode: dto.requestedPlanCode,
        currentPlanCode: tenant.planCode,
        notes: dto.notes?.trim() || null,
      },
      select: {
        id: true,
        tenantId: true,
        currentPlanCode: true,
        requestedPlanCode: true,
        status: true,
        notes: true,
        requestedAt: true,
      },
    });
  }

  async listMyUpgradeRequests() {
    const tenantId = this.requireTenantId();

    return this.prisma.subscriptionUpgradeRequest.findMany({
      where: { tenantId },
      orderBy: { requestedAt: 'desc' },
      select: {
        id: true,
        currentPlanCode: true,
        requestedPlanCode: true,
        status: true,
        notes: true,
        requestedAt: true,
        reviewedAt: true,
        reviewedByUserId: true,
        paymentStatus: true,
        paymentMethod: true,
        paymentReference: true,
        paymentProofUrl: true,
        paymentNotes: true,
        paymentSubmittedAt: true,
        paymentReviewedAt: true,
      },
      take: 50,
    });
  }

  async assertCanCreateInvoice() {
    const tenantId = this.requireTenantId();

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: {
        planCode: true,
        subscriptionStatus: true,
        planExpiresAt: true,
      },
    });

    if (!tenant) throw new BadRequestException('Tenant not found');
    if (tenant.subscriptionStatus !== 'ACTIVE') {
      throw new BadRequestException('Subscription is not active');
    }
    if (tenant.planExpiresAt && tenant.planExpiresAt < new Date()) {
      throw new BadRequestException('Subscription has expired');
    }

    const limits = this.getPlanLimits(tenant.planCode);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const count = await this.prisma.invoice.count({
      where: {
        tenantId,
        createdAt: { gte: monthStart },
      },
    });

    if (count >= limits.invoicesPerMonth) {
      throw new BadRequestException(
        `Invoice monthly limit reached for ${tenant.planCode} plan`,
      );
    }
  }

  async assertCanCreateQuote() {
    const tenantId = this.requireTenantId();

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: {
        planCode: true,
        subscriptionStatus: true,
        planExpiresAt: true,
      },
    });

    if (!tenant) throw new BadRequestException('Tenant not found');
    if (tenant.subscriptionStatus !== 'ACTIVE') {
      throw new BadRequestException('Subscription is not active');
    }
    if (tenant.planExpiresAt && tenant.planExpiresAt < new Date()) {
      throw new BadRequestException('Subscription has expired');
    }

    const limits = this.getPlanLimits(tenant.planCode);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const count = await this.prisma.quote.count({
      where: {
        tenantId,
        createdAt: { gte: monthStart },
      },
    });

    if (count >= limits.quotesPerMonth) {
      throw new BadRequestException(
        `Quote monthly limit reached for ${tenant.planCode} plan`,
      );
    }
  }

  async assertCanCreateUser() {
    const tenantId = this.requireTenantId();

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: {
        planCode: true,
        subscriptionStatus: true,
        planExpiresAt: true,
      },
    });

    if (!tenant) throw new BadRequestException('Tenant not found');
    if (tenant.subscriptionStatus !== 'ACTIVE') {
      throw new BadRequestException('Subscription is not active');
    }
    if (tenant.planExpiresAt && tenant.planExpiresAt < new Date()) {
      throw new BadRequestException('Subscription has expired');
    }

    const limits = this.getPlanLimits(tenant.planCode);

    const count = await this.prisma.tenantUser.count({
      where: { tenantId },
    });

    if (count >= limits.users) {
      throw new BadRequestException(
        `User limit reached for ${tenant.planCode} plan`,
      );
    }
  }

  async assertCanCreateClient() {
    const tenantId = this.requireTenantId();

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: {
        planCode: true,
        subscriptionStatus: true,
        planExpiresAt: true,
      },
    });

    if (!tenant) throw new BadRequestException('Tenant not found');
    if (tenant.subscriptionStatus !== 'ACTIVE') {
      throw new BadRequestException('Subscription is not active');
    }
    if (tenant.planExpiresAt && tenant.planExpiresAt < new Date()) {
      throw new BadRequestException('Subscription has expired');
    }

    const limits = this.getPlanLimits(tenant.planCode);

    const count = await this.prisma.client.count({
      where: {
        tenantId,
        isArchived: false,
      },
    });

    if (count >= limits.clients) {
      throw new BadRequestException(
        `Client limit reached for ${tenant.planCode} plan`,
      );
    }
  }

  async submitUpgradePayment(requestId: string, dto: SubmitUpgradePaymentDto) {
    const tenantId = this.requireTenantId();

    if (!requestId) {
      throw new BadRequestException('requestId is required');
    }

    const request = await this.prisma.subscriptionUpgradeRequest.findFirst({
      where: {
        id: requestId,
        tenantId,
      },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        requestedPlanCode: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Upgrade request not found');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        'Only pending requests can accept payment details',
      );
    }

    if (request.paymentStatus === 'CONFIRMED') {
      throw new BadRequestException('Payment already confirmed');
    }

    return this.prisma.subscriptionUpgradeRequest.update({
      where: { id: requestId },
      data: {
        paymentStatus: 'SUBMITTED',
        paymentMethod: dto.paymentMethod,
        paymentReference: dto.paymentReference?.trim() || null,
        paymentProofUrl: dto.paymentProofUrl?.trim() || null,
        paymentNotes: dto.paymentNotes?.trim() || null,
        paymentSubmittedAt: new Date(),
      },
      select: {
        id: true,
        requestedPlanCode: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        paymentReference: true,
        paymentProofUrl: true,
        paymentNotes: true,
        paymentSubmittedAt: true,
      },
    });
  }
}
