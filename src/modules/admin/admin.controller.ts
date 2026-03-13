import { Body, Controller, Get, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { ImportPackDto } from './dto/import-pack.dto';

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

  @Roles('OWNER', 'ADMIN')
  @Post('import-pack')
  importPack(@Body() dto: ImportPackDto) {
    return this.admin.importPack(dto);
  }
}
