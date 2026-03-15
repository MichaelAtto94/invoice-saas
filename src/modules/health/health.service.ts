import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check() {
    let database = 'up';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      database = 'down';
    }

    return {
      ok: database === 'up',
      api: 'up',
      database,
      time: new Date().toISOString(),
    };
  }
}
