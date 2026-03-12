import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getRequestContext } from '../../common/context/request-context';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenantId(): string {
    const tenantId = getRequestContext()?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Missing tenant context');
    return tenantId;
  }

  async create(params: {
    type: string;
    title: string;
    message?: string;
    entityType?: string;
    entityId?: string;
    userId?: string | null;
  }) {
    const tenantId = this.requireTenantId();

    return this.prisma.notification.create({
      data: {
        tenantId,
        userId: params.userId ?? null,
        type: params.type,
        title: params.title,
        message: params.message ?? null,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
      },
    });
  }

  async list() {
    const tenantId = this.requireTenantId();
    const userId = getRequestContext()?.userId ?? null;

    return this.prisma.notification.findMany({
      where: {
        tenantId,
        OR: [{ userId: null }, { userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async unreadCount() {
    const tenantId = this.requireTenantId();
    const userId = getRequestContext()?.userId ?? null;

    const count = await this.prisma.notification.count({
      where: {
        tenantId,
        isRead: false,
        OR: [{ userId: null }, { userId }],
      },
    });

    return { unread: count };
  }

  async markRead(id: string) {
    const tenantId = this.requireTenantId();
    if (!id) throw new BadRequestException('id is required');

    return this.prisma.notification.updateMany({
      where: {
        id,
        tenantId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllRead() {
    const tenantId = this.requireTenantId();
    const userId = getRequestContext()?.userId ?? null;

    return this.prisma.notification.updateMany({
      where: {
        tenantId,
        isRead: false,
        OR: [{ userId: null }, { userId }],
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }
}
