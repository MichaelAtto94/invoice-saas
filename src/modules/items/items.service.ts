import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { getRequestContext } from '../../common/context/request-context';

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenantId(): string {
    const ctx = getRequestContext();
    const tenantId = ctx?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Missing tenant context');
    return tenantId;
  }

  async create(dto: CreateItemDto) {
    const tenantId = this.requireTenantId();

    if (!dto.name?.trim())
      throw new BadRequestException('Item name is required');
    if (
      dto.unitPrice === undefined ||
      dto.unitPrice === null ||
      Number.isNaN(dto.unitPrice)
    ) {
      throw new BadRequestException('unitPrice is required');
    }
    if (dto.unitPrice < 0)
      throw new BadRequestException('unitPrice must be >= 0');

    // Use tenantId server-side (do not take tenantId from request)
    return this.prisma.item.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        unitPrice: dto.unitPrice,
        costPrice: dto.costPrice ?? 0,
      },
      select: {
        id: true,
        name: true,
        description: true,
        unitPrice: true,
        createdAt: true,
        costPrice: true, // ✅ add
      },
    });
  }

  async findAll() {
    return this.prisma.item.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        unitPrice: true,
        costPrice: true, // ✅ add
        createdAt: true,
      },
    });
  }

  async findOne(id: string) {
    if (!id) throw new BadRequestException('id is required');

    const item = await this.prisma.item.findFirst({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        unitPrice: true,
        costPrice: true, // ✅ add
        createdAt: true,
      },
    });

    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async update(id: string, dto: UpdateItemDto) {
    if (!id) throw new BadRequestException('id is required');

    const exists = await this.prisma.item.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Item not found');

    if (dto.unitPrice !== undefined && dto.unitPrice < 0) {
      throw new BadRequestException('unitPrice must be >= 0');
    }

    return this.prisma.item.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        unitPrice: dto.unitPrice,
        costPrice: dto.costPrice ?? undefined,
      },
      select: {
        id: true,
        name: true,
        description: true,
        unitPrice: true,
        createdAt: true,
        costPrice: true,
      },
    });
  }

  async remove(id: string) {
    if (!id) throw new BadRequestException('id is required');

    const exists = await this.prisma.item.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Item not found');

    await this.prisma.item.delete({ where: { id } });
    return { ok: true };
  }

  async archive(id: string) {
    const tenantId = this.requireTenantId();

    if (!id) throw new BadRequestException('id is required');

    const item = await this.prisma.item.findFirst({
      where: { id, tenantId, isArchived: false },
      select: { id: true, name: true },
    });

    if (!item) throw new NotFoundException('Item not found');

    return this.prisma.item.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        isArchived: true,
        archivedAt: true,
      },
    });
  }

  async restore(id: string) {
    const tenantId = this.requireTenantId();

    if (!id) throw new BadRequestException('id is required');

    const item = await this.prisma.item.findFirst({
      where: { id, tenantId, isArchived: true },
      select: { id: true, name: true },
    });

    if (!item) throw new NotFoundException('Archived item not found');

    return this.prisma.item.update({
      where: { id },
      data: {
        isArchived: false,
        archivedAt: null,
      },
      select: {
        id: true,
        name: true,
        isArchived: true,
        archivedAt: true,
      },
    });
  }

  async findArchived() {
    const tenantId = this.requireTenantId();

    return this.prisma.item.findMany({
      where: {
        tenantId,
        isArchived: true,
      },
      orderBy: {
        archivedAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        description: true,
        unitPrice: true,
        costPrice: true,
        isArchived: true,
        archivedAt: true,
        createdAt: true,
      },
    });
  }
}
