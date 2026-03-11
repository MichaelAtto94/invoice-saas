import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get()
  list(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 50;
    return this.audit.list(Number.isNaN(parsed) ? 50 : parsed);
  }
}
