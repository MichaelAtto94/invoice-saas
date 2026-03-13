import { Controller, Get, Param } from '@nestjs/common';
import { ClientPortalService } from './client-portal.service';

@Controller('public/client-portal')
export class ClientPortalController {
  constructor(private readonly portal: ClientPortalService) {}

  @Get(':token')
  getPortal(@Param('token') token: string) {
    return this.portal.getByToken(token);
  }
}
