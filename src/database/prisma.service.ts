import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { getRequestContext } from '../common/context/request-context';

const TENANT_MODELS = new Set<string>([
  'Client',
  'Item',
  'Role',
  'TenantUser',
  'DocumentSequence',
  'RefreshToken',
]);

function addTenantToWhere(where: any, tenantId: string) {
  if (!where) return { tenantId };
  if (typeof where === 'object' && where.tenantId) return where;
  return { ...where, tenantId };
}

function addTenantToData(data: any, tenantId: string) {
  if (!data) return { tenantId };
  if (typeof data === 'object' && data.tenantId) return data;
  return { ...data, tenantId };
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('Missing required environment variable: DATABASE_URL');
    }

    const adapter = new PrismaPg({ connectionString });
    super({ adapter });

    // Prisma v7 tenant scoping using query extensions
    const extended = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const ctx = getRequestContext();
            const tenantId = ctx?.tenantId;

            // No tenant context (public routes) -> no scoping
            if (!tenantId) return query(args);

            // Only scope specific tenant-owned models
            if (!model || !TENANT_MODELS.has(model)) return query(args);

            // Treat args as any inside this generic hook (avoids TS union issues)
            const a: any = args ?? {};

            // For tenant-scoped models, don't allow findUnique (unless you add compound unique with tenantId)
            if (
              operation === 'findUnique' ||
              operation === 'findUniqueOrThrow'
            ) {
              throw new Error(
                `Tenant scoping: do not use ${operation} on ${model}. Use findFirst/findMany instead.`,
              );
            }

            // READ
            if (
              operation === 'findMany' ||
              operation === 'findFirst' ||
              operation === 'findFirstOrThrow'
            ) {
              a.where = addTenantToWhere(a.where, tenantId);
              return query(a);
            }

            // CREATE
            if (operation === 'create') {
              a.data = addTenantToData(a.data, tenantId);
              return query(a);
            }

            if (operation === 'createMany') {
              if (Array.isArray(a.data)) {
                a.data = a.data.map((row: any) =>
                  addTenantToData(row, tenantId),
                );
              } else {
                a.data = addTenantToData(a.data, tenantId);
              }
              return query(a);
            }

            // UPDATE / DELETE (single)
            if (operation === 'update' || operation === 'delete') {
              a.where = addTenantToWhere(a.where, tenantId);
              return query(a);
            }

            // UPDATE / DELETE (many)
            if (operation === 'updateMany' || operation === 'deleteMany') {
              a.where = addTenantToWhere(a.where, tenantId);
              return query(a);
            }

            // UPSERT
            if (operation === 'upsert') {
              a.where = addTenantToWhere(a.where, tenantId);
              a.create = addTenantToData(a.create, tenantId);
              // a.update stays as-is; we don’t want tenantId changes
              return query(a);
            }

            return query(a);
          },
        },
      },
    });

    // Apply extended behavior to this service instance
    Object.assign(this, extended);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
