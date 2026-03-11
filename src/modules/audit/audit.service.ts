import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getRequestContext } from '../../common/context/request-context';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenantId(): string {
    const tenantId = getRequestContext()?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Missing tenant context');
    return tenantId;
  }

  async log(params: {
    entityType: string;
    entityId: string;
    action:
      | 'CREATE'
      | 'UPDATE'
      | 'DELETE'
      | 'APPROVE'
      | 'REJECT'
      | 'SEND'
      | 'EXPORT';
    description?: string;
    metadata?: unknown;
  }) {
    const tenantId = this.requireTenantId();
    const userId = getRequestContext()?.userId ?? null;

    return this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action as any,
        description: params.description ?? null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  }

  async list(limit = 50) {
    const tenantId = this.requireTenantId();

    return this.prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
