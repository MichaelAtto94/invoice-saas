import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Roles('OWNER', 'ADMIN')
  @Get('analytics')
  analytics() {
    return this.admin.analytics();
  }

  @Roles('OWNER', 'ADMIN')
  @Get('export-pack')
  exportPack() {
    return this.admin.exportPack();
  }
}
