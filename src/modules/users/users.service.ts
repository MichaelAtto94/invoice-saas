import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { UpdateTenantUserRoleDto } from './dto/update-tenant-user-role.dto';
import { SetUserActiveStatusDto } from './dto/set-user-active-status.dto';
import type { CurrentUserType } from '../../common/types/current-user.type';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
  ) { }

  async createTenantUser(
    dto: CreateTenantUserDto,
    currentUser: CurrentUserType,
  ) {
    const email = dto.email.trim().toLowerCase();
    const fullName = dto.fullName.trim();
    const roleName = dto.roleName.trim().toUpperCase();

    if (!['OWNER', 'ADMIN', 'STAFF'].includes(roleName)) {
      throw new BadRequestException('Invalid roleName');
    }

    if (roleName === 'OWNER' && currentUser.role !== 'OWNER') {
      throw new BadRequestException('Only OWNER can create another OWNER');
    }

    const role = await this.prisma.role.findFirst({
      where: {
        tenantId: currentUser.tenantId,
        name: roleName,
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found for this tenant');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      const existingMembership = await this.prisma.tenantUser.findFirst({
        where: {
          tenantId: currentUser.tenantId,
          userId: existingUser.id,
        },
      });

      if (existingMembership) {
        throw new BadRequestException('User already belongs to this tenant');
      }

      await this.prisma.tenantUser.create({
        data: {
          tenantId: currentUser.tenantId,
          userId: existingUser.id,
          roleId: role.id,
        },
      });

      return {
        message: 'Existing user added to tenant successfully',
        user: {
          id: existingUser.id,
          email: existingUser.email,
          fullName: existingUser.fullName,
        },
        role: role.name,
      };
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName,
          email,
          passwordHash,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      });

      await tx.tenantUser.create({
        data: {
          tenantId: currentUser.tenantId,
          userId: user.id,
          roleId: role.id,
        },
      });

      return user;
    });

    return {
      message: 'Tenant user created successfully',
      user: created,
      role: role.name,
    };
  }

  async findTenantUsers(currentUser: CurrentUserType) {
    return this.prisma.tenantUser.findMany({
      where: {
        tenantId: currentUser.tenantId,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            isActive: true,
            createdAt: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateTenantUserRole(
    dto: UpdateTenantUserRoleDto,
    currentUser: CurrentUserType,
  ) {
    const roleName = dto.roleName.trim().toUpperCase();

    if (!['OWNER', 'ADMIN', 'STAFF'].includes(roleName)) {
      throw new BadRequestException('Invalid roleName');
    }

    if (dto.userId === currentUser.userId && roleName !== currentUser.role) {
      throw new BadRequestException('You cannot change your own role');
    }

    const membership = await this.prisma.tenantUser.findFirst({
      where: {
        tenantId: currentUser.tenantId,
        userId: dto.userId,
      },
      include: {
        role: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            isActive: true,
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Tenant user not found');
    }

    if (membership.role.name === 'OWNER' && currentUser.role !== 'OWNER') {
      throw new BadRequestException('Only OWNER can change OWNER role');
    }

    if (roleName === 'OWNER' && currentUser.role !== 'OWNER') {
      throw new BadRequestException('Only OWNER can assign OWNER role');
    }

    const targetRole = await this.prisma.role.findFirst({
      where: {
        tenantId: currentUser.tenantId,
        name: roleName,
      },
    });

    if (!targetRole) {
      throw new NotFoundException('Target role not found in this tenant');
    }

    await this.prisma.tenantUser.update({
      where: {
        tenantId_userId: {
          tenantId: currentUser.tenantId,
          userId: dto.userId,
        },
      },
      data: {
        roleId: targetRole.id,
      },
    });

    return {
      message: 'User role updated successfully',
      user: membership.user,
      oldRole: membership.role.name,
      newRole: targetRole.name,
    };
  }

  async setUserActiveStatus(
    dto: SetUserActiveStatusDto,
    currentUser: CurrentUserType,
  ) {
    if (dto.userId === currentUser.userId) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    const membership = await this.prisma.tenantUser.findFirst({
      where: {
        tenantId: currentUser.tenantId,
        userId: dto.userId,
      },
      include: {
        role: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            isActive: true,
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Tenant user not found');
    }

    if (membership.role.name === 'OWNER' && currentUser.role !== 'OWNER') {
      throw new BadRequestException('Only OWNER can deactivate an OWNER');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: dto.userId },
      data: { isActive: dto.isActive },
      select: {
        id: true,
        fullName: true,
        email: true,
        isActive: true,
      },
    });

    return {
      message: dto.isActive
        ? 'User activated successfully'
        : 'User deactivated successfully',
      user: updatedUser,
    };
  }
}
