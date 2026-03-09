import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('tenants')
export class TenantsController {
  @Roles('OWNER', 'ADMIN')
  @Get('admin-area')
  adminArea() {
    return { ok: true, message: 'Only OWNER/ADMIN can see this' };
  }
}
