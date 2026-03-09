import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantService } from './tenant.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Controller('tenant')
export class TenantController {
  constructor(private readonly tenant: TenantService) {}

  @Roles('OWNER', 'ADMIN', 'STAFF')
  @Get('me')
  me() {
    return this.tenant.me();
  }

  @Roles('OWNER', 'ADMIN')
  @Patch('me')
  update(@Body() dto: UpdateTenantDto) {
    return this.tenant.update(dto);
  }
}
