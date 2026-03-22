import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { env } from '../../config/env';

type TransactionResult = {
  tenant: { id: string; name: string; slug: string };
  user: { id: string; fullName: string; email: string };
  role: { name: string };
};

function parseExpiresToDate(value: string): Date {
  const match = /^(\d+)([smhd])$/i.exec(value.trim());

  if (!match) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  const n = Number(match[1]);
  const unit = match[2].toLowerCase();

  const ms =
    unit === 's'
      ? n * 1000
      : unit === 'm'
        ? n * 60 * 1000
        : unit === 'h'
          ? n * 60 * 60 * 1000
          : n * 24 * 60 * 60 * 1000;

  return new Date(Date.now() + ms);
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async registerTenantOwner(dto: RegisterDto) {
    const {
      companyName,
      companySlug,
      ownerFullName,
      ownerEmail,
      ownerPassword,
    } = dto;

    if (
      !companyName ||
      !companySlug ||
      !ownerFullName ||
      !ownerEmail ||
      !ownerPassword
    ) {
      throw new BadRequestException('All fields are required');
    }

    const normalizedEmail = ownerEmail.trim().toLowerCase();
    const normalizedSlug = companySlug.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }

    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: normalizedSlug },
    });
    if (existingTenant) {
      throw new BadRequestException('Company slug already in use');
    }

    const passwordHash = await bcrypt.hash(ownerPassword, 10);

    const result: TransactionResult = await this.prisma.$transaction(
      async (tx): Promise<TransactionResult> => {
        const tenant = await tx.tenant.create({
          data: { name: companyName, slug: normalizedSlug },
          select: { id: true, name: true, slug: true },
        });

        const ownerRole = await tx.role.create({
          data: { tenantId: tenant.id, name: 'OWNER' },
          select: { id: true, name: true },
        });

        await tx.role.createMany({
          data: [
            { tenantId: tenant.id, name: 'ADMIN' },
            { tenantId: tenant.id, name: 'STAFF' },
          ],
          skipDuplicates: true,
        });

        const user = await tx.user.create({
          data: {
            fullName: ownerFullName,
            email: normalizedEmail,
            passwordHash,
          },
          select: { id: true, fullName: true, email: true },
        });

        await tx.tenantUser.create({
          data: {
            tenantId: tenant.id,
            userId: user.id,
            roleId: ownerRole.id,
          },
        });

        await tx.documentSequence.create({
          data: { tenantId: tenant.id },
        });

        return {
          tenant,
          user,
          role: { name: ownerRole.name },
        };
      },
    );

    const tokens = await this.issueTokens({
      userId: result.user.id,
      email: result.user.email,
      tenantId: result.tenant.id,
      tenantSlug: result.tenant.slug,
      role: result.role.name,
    });

    await this.storeRefreshToken(
      result.user.id,
      result.tenant.id,
      tokens.refreshToken,
    );

    return { tenant: result.tenant, user: result.user, tokens };
  }

  async login(dto: LoginDto) {
    const email = dto.email?.trim().toLowerCase();
    const password = dto.password;
    const tenantSlug = dto.tenantSlug?.trim().toLowerCase();

    if (!email || !password || !tenantSlug) {
      throw new BadRequestException('email, password, tenantSlug are required');
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });
    if (!tenant) {
      throw new UnauthorizedException('Invalid tenant');
    }

    const membership = await this.prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
      include: { role: true },
    });

    if (!membership) {
      throw new UnauthorizedException('User not a member of this tenant');
    }

    const tokens = await this.issueTokens({
      userId: user.id,
      email: user.email,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      role: membership.role.name,
    });

    await this.storeRefreshToken(user.id, tenant.id, tokens.refreshToken);

    return {
      user: { id: user.id, fullName: user.fullName, email: user.email },
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      tokens,
    };
  }

  async refresh(dto: RefreshDto) {
    const { refreshToken } = dto;
    if (!refreshToken) {
      throw new BadRequestException('refreshToken is required');
    }

    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const userId: string = payload.sub;
    const tenantId: string = payload.tenantId;

    const tokenRows = await this.prisma.refreshToken.findMany({
      where: { userId, tenantId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        tokenHash: true,
        expiresAt: true,
      },
    });

    const match = await this.findMatchingStoredToken(refreshToken, tokenRows);
    if (!match) {
      throw new UnauthorizedException('Refresh token revoked or not found');
    }

    await this.prisma.refreshToken.update({
      where: { id: match.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User no longer active');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new UnauthorizedException('Invalid tenant');
    }

    const membership = await this.prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      include: { role: true },
    });

    if (!membership) {
      throw new UnauthorizedException('User not a member of this tenant');
    }

    const tokens = await this.issueTokens({
      userId,
      email: user.email,
      tenantId,
      tenantSlug: tenant.slug,
      role: membership.role.name,
    });

    await this.storeRefreshToken(userId, tenantId, tokens.refreshToken);

    return tokens;
  }

  private async storeRefreshToken(
    userId: string,
    tenantId: string,
    refreshToken: string,
  ) {
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = parseExpiresToDate(env.JWT_REFRESH_EXPIRES);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tenantId,
        tokenHash,
        expiresAt,
      },
    });
  }

  private async findMatchingStoredToken(
    refreshToken: string,
    stored: { id: string; tokenHash: string; expiresAt: Date }[],
  ) {
    const now = new Date();

    for (const row of stored) {
      if (row.expiresAt < now) continue;
      const ok = await bcrypt.compare(refreshToken, row.tokenHash);
      if (ok) return row;
    }

    return null;
  }

  private async issueTokens(payload: {
    userId: string;
    email: string;
    tenantId: string;
    tenantSlug: string;
    role: string;
  }) {
    const accessPayload = {
      sub: payload.userId,
      email: payload.email,
      tenantId: payload.tenantId,
      tenantSlug: payload.tenantSlug,
      role: payload.role,
    };

    const refreshPayload = {
      sub: payload.userId,
      tenantId: payload.tenantId,
    };

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: env.JWT_ACCESS_SECRET,
      expiresIn: env.JWT_ACCESS_EXPIRES as any,
    });

    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: env.JWT_REFRESH_SECRET,
      expiresIn: env.JWT_REFRESH_EXPIRES as any,
    });

    return { accessToken, refreshToken };
  }
}
